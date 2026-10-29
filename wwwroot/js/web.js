// ============================================================
// Web app: the dashboard as a web page for the group, not the Edge widget.
//
// Three pages behind hash routes, so any of them can be bookmarked or sent:
//   #overview                 standings, gains, about to level, most killed
//   #player-<name>            one member in full
//   #compare / #compare-bosses  everyone side by side
//
// Every page renders from one multi-player fetch, so moving between them
// costs no requests. The kiosk (kiosk.js) shares the data layer and the 99 /
// 200M treatments with this file and nothing else.
// ============================================================

import { applyConfigToDocument, config } from "./config.js";
import { loadPlayers } from "./api.js";
import { snapshot } from "./history.js";
import { el, img } from "./dom.js";
import { refreshIcon } from "./components.js";
import { formatClock } from "./format.js";
import { overviewPage } from "./web/overview.js";
import { playerPage } from "./web/player.js";
import { comparePage } from "./web/compare.js";
import { link, notice, playerSlug } from "./web/parts.js";

const APP_NAME = "Group Ironman";
const CLOCK_TICK_MS = 30 * 1000;

const NAV = [
  { id: "overview", label: "Overview", href: "#overview" },
  { id: "player", label: "Players", href: null },
  { id: "compare", label: "Compare", href: "#compare" }
];

const state = {
  // Roster order, one entry per player: { name, data, result }.
  members: config.players.map(function (name) { return { name: name, data: null, result: null }; }),
  loading: true,
  refreshing: false,
  loadedAt: null,
  // True when the last load got nothing live and every number is from cache.
  savedOnly: false,
  route: null
};

const ui = {};
let inflight = null;
let pollTimer = null;

export function start() {
  applyConfigToDocument();
  buildShell();

  // A link like ?player=IronBengal with no hash opens that player's page.
  if (!location.hash && new URLSearchParams(location.search).get("player")) {
    history.replaceState(null, "", "#player-" + playerSlug(config.player));
  }

  window.addEventListener("hashchange", function () {
    render();
    window.scrollTo(0, 0);
  });
  document.addEventListener("visibilitychange", onVisibility);
  setInterval(updateStatus, CLOCK_TICK_MS);

  render();
  load();
  startPolling();
}

// --- Shell -----------------------------------------------------------------

function buildShell() {
  const app = document.getElementById("app");

  const bar = el("header", "appbar");
  const barWrap = el("div", "wrap");

  const brand = link("#overview", "brand");
  brand.appendChild(img("wwwroot/icons/skills/total.png", "", "ico"));
  brand.appendChild(el("span", null, APP_NAME));
  barWrap.appendChild(brand);

  const nav = el("nav", "nav");
  nav.setAttribute("aria-label", "Pages");
  ui.nav = {};
  NAV.forEach(function (item) {
    const a = link(item.href || "#player-" + playerSlug(config.player), null, item.label);
    ui.nav[item.id] = a;
    nav.appendChild(a);
  });
  barWrap.appendChild(nav);

  const status = el("div", "updated");
  ui.when = el("span", "when");
  ui.when.setAttribute("aria-live", "polite");
  status.appendChild(ui.when);
  ui.refresh = el("button", "iconbtn");
  ui.refresh.type = "button";
  ui.refresh.title = "Refresh";
  ui.refresh.setAttribute("aria-label", "Refresh");
  ui.refresh.addEventListener("click", function () { load(); });
  status.appendChild(ui.refresh);
  barWrap.appendChild(status);

  bar.appendChild(barWrap);

  const main = el("main", "wrap");
  ui.view = el("div", "page");
  main.appendChild(ui.view);

  app.replaceChildren(bar, main);
}

// --- Routing ---------------------------------------------------------------

function parseRoute() {
  const hash = location.hash.replace(/^#/, "");
  if (hash.indexOf("player-") === 0) {
    const slug = hash.slice("player-".length);
    const member = state.members.find(function (m) { return playerSlug(m.name) === slug; })
      || state.members.find(function (m) { return m.name === config.player; })
      || state.members[0];
    return { page: "player", member: member };
  }
  if (hash === "compare-bosses") return { page: "compare", mode: "bosses" };
  if (hash === "compare") return { page: "compare", mode: "skills" };
  return { page: "overview" };
}

function render() {
  const route = parseRoute();
  state.route = route;

  Object.keys(ui.nav).forEach(function (id) {
    if (id === route.page) ui.nav[id].setAttribute("aria-current", "page");
    else ui.nav[id].removeAttribute("aria-current");
  });
  // "Players" returns to whoever was last opened.
  if (route.page === "player") ui.nav.player.href = "#player-" + playerSlug(route.member.name);

  const title = route.page === "player" ? route.member.name
    : route.page === "compare" ? "Compare" : "Overview";
  document.title = title + " \u00B7 " + APP_NAME;

  updateStatus();

  if (state.loading && !state.loadedAt) {
    const wait = el("div", "loading");
    wait.appendChild(el("div", "ring"));
    wait.appendChild(el("span", null, "Loading hiscores\u2026"));
    ui.view.replaceChildren(wait);
    return;
  }

  const parts = [];
  // A missing player's own page explains itself; don't say it twice.
  const warning = healthNotice(route.page === "player" ? route.member : null);
  if (warning) parts.push(warning);

  if (route.page === "player") parts.push(playerPage(state.members, route.member));
  else if (route.page === "compare") parts.push(comparePage(state.members, route.mode));
  else parts.push(overviewPage(state.members));

  ui.view.replaceChildren(...parts);
}

// Says which numbers are not live, so hours-old data is never passed off as
// current.
function healthNotice(except) {
  const stale = state.members.filter(function (m) { return m.result && m.result.stale; });
  const missing = state.members.filter(function (m) { return m.result && !m.data && m !== except; });
  if (!stale.length && !missing.length) return null;

  const sentences = [];
  if (stale.length) {
    const oldest = Math.min(...stale.map(function (m) { return m.result.fetchedAt; }));
    sentences.push("Couldn't refresh " + names(stale) + "; showing saved numbers from " + formatClock(oldest) + ".");
  }
  if (missing.length) {
    sentences.push("Couldn't load " + names(missing) + ".");
  }
  return notice(sentences.join(" "), state.members.every(function (m) { return !m.data; }));
}

function names(members) {
  const list = members.map(function (m) { return m.name; });
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
}

function updateStatus() {
  const busy = state.loading || state.refreshing;
  ui.refresh.disabled = busy;
  ui.refresh.replaceChildren(refreshIcon(busy));
  ui.when.textContent = busy && !state.loadedAt ? "Loading\u2026"
    : busy ? "Refreshing\u2026"
    : state.loadedAt ? (state.savedOnly ? "Saved " : "Updated ") + ago(state.loadedAt)
    : "Not loaded";
}

function ago(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.floor(mins / 60);
  return hours + (hours === 1 ? " hour ago" : " hours ago");
}

// --- Data ------------------------------------------------------------------

function load() {
  if (inflight) inflight.abort();
  const controller = new AbortController();
  inflight = controller;

  if (state.loadedAt) state.refreshing = true;
  else state.loading = true;
  updateStatus();

  loadPlayers(config.players, controller.signal)
    .then(function (results) {
      if (inflight !== controller) return;
      results.forEach(function (r, i) {
        const member = state.members[i];
        // A failed refresh with nothing cached keeps what this page already
        // showed rather than blanking a player who loaded fine a minute ago.
        if (!r.data && member.data) {
          member.result = Object.assign({}, r, {
            data: member.data, fetchedAt: member.result.fetchedAt, stale: true
          });
        } else {
          member.result = r;
          member.data = r.data;
        }
        if (r.data && !r.stale) snapshot(member.name, r.data);
      });

      const fresh = results.filter(function (r) { return r.data && !r.stale; });
      state.savedOnly = fresh.length === 0;
      if (fresh.length) state.loadedAt = Date.now();
      else if (!state.loadedAt) {
        // Nothing live: the clock reflects the newest saved data instead.
        const saved = results.map(function (r) { return r.fetchedAt || 0; });
        state.loadedAt = Math.max(...saved) || null;
      }
    })
    .catch(function (err) {
      if (err && (err.name === "AbortError" || err.name === "TimeoutError")) return;
      console.error("[web] load failed", err);
    })
    .finally(function () {
      if (inflight !== controller) return;
      inflight = null;
      state.loading = false;
      state.refreshing = false;
      render();
    });
}

// Ten minutes by default (?refresh=), and never while the tab is hidden.
function startPolling() {
  stopPolling();
  if (config.refreshMs <= 0) return;
  pollTimer = setInterval(function () {
    if (!document.hidden) load();
  }, config.refreshMs);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function onVisibility() {
  if (document.hidden) {
    stopPolling();
    return;
  }
  startPolling();
  // Back after a while: catch up now rather than at the next tick.
  if (config.refreshMs > 0 && (!state.loadedAt || Date.now() - state.loadedAt >= config.refreshMs)) load();
  else updateStatus();
}