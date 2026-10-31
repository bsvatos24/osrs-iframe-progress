// ============================================================
// XP gains on the web pages, from Wise Old Man history (wom.js) measured up
// to the live hiscores (gains.js):
//
//   trainingCard    Overview: each player's XP gained and where it went
//   gainingCard     Players: XP per day, and every skill gained in
//   weeklyGains     Players: this week's gain per skill, for the tiles
//   compareGains    Compare: skills by players, shaded by XP gained
//   activityPage    Activity: level-ups and big XP days, by day
//
// Each member carries `history`: undefined while loading, else the result of
// wom.loadHistory. The Today / 7 days choice is shared by every view and
// remembered per browser.
// ============================================================

import { el } from "../dom.js";
import { SKILL_GRID_ORDER } from "../constants.js";
import { playerTier, MAX_SKILL_LEVEL } from "../osrs.js";
import { formatCompact, iconForSkill } from "../format.js";
import { dailyXp, events, livePoint, skillGains, startOfDay, timeline, PERIODS } from "../gains.js";
import { womProfileUrl, WOM_SITE } from "../wom.js";
import { card, icon, link, pageHead, playerHref, toolCard } from "./parts.js";

const PERIOD_KEY = "osrsgim.web.gainsPeriod";
const TRAINING_KEY = "osrsgim.web.onlyTraining";
const CHIP_LIMIT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

let period = readSetting(PERIOD_KEY, "week");
if (!PERIODS[period]) period = "week";
let onlyTraining = readSetting(TRAINING_KEY, "0") === "1";
let rerender = function () {};

// web.js hands over its render so a toggle can redraw the page.
export function onSettingChange(fn) {
  rerender = fn;
}

function readSetting(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // A remembered toggle is a convenience; storage can be off.
  }
}

// --- Shared ----------------------------------------------------------------

function toggle(label, options, current, onPick) {
  const group = el("div", "seg");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  options.forEach(function (opt) {
    const b = el("button", null, opt[1]);
    b.type = "button";
    b.setAttribute("aria-pressed", String(opt[0] === current));
    b.addEventListener("click", function () {
      if (opt[0] !== current) onPick(opt[0]);
    });
    group.appendChild(b);
  });
  return group;
}

function periodToggle() {
  return toggle("Period", [["today", PERIODS.today.label], ["week", PERIODS.week.label]], period, function (v) {
    period = v;
    writeSetting(PERIOD_KEY, v);
    rerender();
  });
}

function memberTimeline(member) {
  const history = member.history;
  const live = member.data && member.result ? livePoint(member.data, member.result.fetchedAt || Date.now()) : null;
  return timeline(history && history.points, live);
}

function memberGains(member, which) {
  return skillGains(memberTimeline(member), PERIODS[which].since(Date.now()));
}

function periodWords(which) {
  return which === "today" ? "today" : "in the last 7 days";
}

// "since Tue 3:00 PM" for a window history does not fully cover.
function sinceText(ms) {
  const d = new Date(ms);
  const day = startOfDay(ms) === startOfDay(Date.now()) ? "today"
    : d.toLocaleDateString(undefined, { weekday: "short" });
  return "since " + day + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Why a member has no gains to show, or null when they can.
function blocker(member) {
  if (!member.data) return "Hiscores unavailable";
  const h = member.history;
  if (!h) return "Loading history\u2026";
  if (h.status === "untracked") return "Now tracked on Wise Old Man; gains start from its next update";
  if (h.status === "error") return h.error || "History unavailable";
  return null;
}

function allCapped(member) {
  return member.data && playerTier(member.data.skills) === "200";
}

function womCredit() {
  const a = link(WOM_SITE, "credit", "History from Wise Old Man");
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

function skillChip(name, xp) {
  const chip = el("span", "gchip");
  chip.appendChild(icon(iconForSkill(name), name));
  chip.appendChild(el("span", null, name));
  chip.appendChild(el("b", "gain", "+" + formatCompact(xp)));
  return chip;
}

// Total XP gained in a period, for the Standings columns:
// { xp, since } or null when Wise Old Man has nothing for this member.
export function totalGain(member, which) {
  if (blocker(member)) return null;
  const g = memberGains(member, which);
  return {
    xp: g.total,
    since: new Date(g.from).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })
  };
}

// --- 1. Overview: Training -------------------------------------------------

export function trainingCard(members) {
  const rows = members.map(function (m) {
    const blocked = blocker(m);
    const g = blocked ? null : memberGains(m, period);
    return { member: m, blocked: blocked, gains: g };
  });
  // Most XP first; players with nothing to show keep roster order below.
  rows.sort(function (a, b) {
    return (b.gains ? b.gains.total : -1) - (a.gains ? a.gains.total : -1);
  });

  const list = el("div", "train");
  rows.forEach(function (row) { list.appendChild(trainingRow(row)); });

  const section = toolCard("Training", "XP gained " + periodWords(period) + ", by skill", periodToggle(), list);
  section.appendChild(womCredit());
  return section;
}

function trainingRow(row) {
  const m = row.member;
  const node = el("div", "tr-row");

  const who = el("div", "tr-who");
  who.appendChild(link(playerHref(m.name), "tr-name", m.name));
  if (row.gains && row.gains.partial && row.gains.total > 0) {
    who.appendChild(el("span", "tr-since", sinceText(row.gains.from)));
  }
  node.appendChild(who);

  const skills = el("div", "tr-skills");
  if (allCapped(m)) {
    node.appendChild(el("div", "tr-total dimnum", "\u2013"));
    skills.appendChild(el("span", "prism", "Every skill at 200M, nothing left to gain"));
  } else if (row.blocked) {
    node.appendChild(el("div", "tr-total dimnum", "\u2013"));
    skills.appendChild(el("span", "tr-empty", row.blocked));
  } else if (!row.gains.total) {
    node.appendChild(el("div", "tr-total dimnum", "0"));
    skills.appendChild(el("span", "tr-empty", "No XP " + periodWords(period)));
  } else {
    const total = el("div", "tr-total gain", "+" + formatCompact(row.gains.total));
    total.title = row.gains.total.toLocaleString() + " XP";
    node.appendChild(total);
    row.gains.skills.slice(0, CHIP_LIMIT).forEach(function (s) { skills.appendChild(skillChip(s.name, s.xp)); });
    const more = row.gains.skills.length - CHIP_LIMIT;
    if (more > 0) skills.appendChild(link(playerHref(m.name), "gchip more-chip", "+" + more + " more"));
  }
  node.appendChild(skills);
  return node;
}

// --- 2. Players: Gaining XP --------------------------------------------------

export function gainingCard(member) {
  const blocked = blocker(member);
  const profile = link(womProfileUrl(member.name), "credit", "View on Wise Old Man");
  profile.target = "_blank";
  profile.rel = "noopener";

  if (allCapped(member)) {
    const section = card("Gaining XP", null,
      el("p", "empty prism", "Every skill at 200M. There is no XP left to gain."));
    section.appendChild(profile);
    return section;
  }
  if (blocked) {
    const section = card("Gaining XP", null, el("p", "empty", blocked));
    section.appendChild(profile);
    return section;
  }

  const points = memberTimeline(member);
  const g = skillGains(points, PERIODS[period].since(Date.now()));
  const blurb = (period === "today" ? "Today" : "Last 7 days")
    + (g.partial && g.total ? " (" + sinceText(g.from) + ")" : "");

  const body = el("div", "gp");
  body.appendChild(dailyChart(dailyXp(points, Date.now(), 7)));

  const list = el("div", "list");
  if (!g.skills.length) {
    list.appendChild(el("p", "empty", "No XP " + periodWords(period) + "."));
  } else {
    const top = g.skills[0].xp;
    g.skills.forEach(function (s) { list.appendChild(gainRow(s, top)); });
  }
  body.appendChild(list);

  const section = toolCard("Gaining XP", blurb, periodToggle(), body);
  section.appendChild(profile);
  return section;
}

function gainRow(s, top) {
  const row = el("div", "li");
  row.appendChild(icon(iconForSkill(s.name), s.name));
  const text = el("div");
  text.style.minWidth = "0";
  text.appendChild(el("div", "main", s.name));
  text.appendChild(el("div", "sub", s.toLevel > s.fromLevel
    ? "Level " + s.fromLevel + " \u2192 " + s.toLevel
    : "Level " + s.toLevel + (s.toLevel >= MAX_SKILL_LEVEL ? " \u00B7 counting to 200M" : "")));
  row.appendChild(text);
  const track = el("div", "meter");
  const fill = el("i");
  fill.style.width = Math.max(2, (s.xp / top) * 100).toFixed(1) + "%";
  track.appendChild(fill);
  row.appendChild(track);
  const val = el("div", "val gain", "+" + formatCompact(s.xp));
  val.title = s.xp.toLocaleString() + " XP";
  row.appendChild(val);
  return row;
}

function dailyChart(days) {
  const wrap = el("div", "daily");
  wrap.appendChild(el("span", "label", "XP per day"));
  const chart = el("div", "days");
  chart.setAttribute("role", "img");
  const max = Math.max(1, ...days.map(function (d) { return d.xp || 0; }));
  const today = startOfDay(Date.now());
  const said = [];

  days.forEach(function (d) {
    const name = new Date(d.day).toLocaleDateString(undefined, { weekday: "short" });
    const col = el("div", "day" + (d.day === today ? " today" : ""));
    col.appendChild(el("span", "v", d.xp == null ? "\u2013" : formatCompact(d.xp)));
    const bar = el("div", "col" + (d.xp ? "" : " zero"));
    // Bars use 80% of the height so the tallest still has room for its label.
    bar.style.height = d.xp ? Math.max(3, (d.xp / max) * 80).toFixed(1) + "%" : "3px";
    col.appendChild(bar);
    col.appendChild(el("span", "d", name));
    chart.appendChild(col);
    said.push(name + " " + (d.xp == null ? "no data" : d.xp.toLocaleString() + " XP"));
  });

  chart.setAttribute("aria-label", "XP per day: " + said.join(", "));
  wrap.appendChild(chart);
  return wrap;
}

// --- 3. Players: skill tiles -------------------------------------------------

// This week's XP per skill name, or null when there is no history to use.
export function weeklyGains(member) {
  if (blocker(member)) return null;
  const map = new Map();
  memberGains(member, "week").skills.forEach(function (s) { map.set(s.name, s.xp); });
  return map;
}

export function isOnlyTraining() {
  return onlyTraining;
}

export function trainingToggle() {
  return toggle("Highlight", [["0", "All skills"], ["1", "Only show training"]], onlyTraining ? "1" : "0", function (v) {
    onlyTraining = v === "1";
    writeSetting(TRAINING_KEY, v);
    rerender();
  });
}

// --- 4. Compare: Gains -------------------------------------------------------

export function compareGains(members) {
  const per = members.map(function (m) {
    return blocker(m) ? null : memberGains(m, period);
  });

  const byName = per.map(function (g) {
    const map = new Map();
    if (g) g.skills.forEach(function (s) { map.set(s.name, s.xp); });
    return map;
  });
  const skills = SKILL_GRID_ORDER.filter(function (name) {
    return byName.some(function (map) { return map.has(name); });
  });
  const max = Math.max(1, ...byName.map(function (map) { return Math.max(0, ...map.values()); }));

  const table = el("table", "matrix");
  const thead = el("thead");
  const hr = el("tr");
  hr.appendChild(el("th", "corner"));
  members.forEach(function (m) {
    const th = el("th");
    th.scope = "col";
    th.appendChild(link(playerHref(m.name), null, m.name));
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el("tbody");
  if (!skills.length) {
    const tr = el("tr");
    const td = el("td", "empty", members.some(function (m) { return !m.history; })
      ? "Loading history\u2026" : "Nobody has gained XP " + periodWords(period) + ".");
    td.colSpan = members.length + 1;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  skills.forEach(function (name) {
    const tr = el("tr");
    const th = el("th", "rowhead");
    th.scope = "row";
    th.appendChild(icon(iconForSkill(name), name));
    th.appendChild(document.createTextNode(name));
    tr.appendChild(th);
    members.forEach(function (m, i) {
      const td = el("td");
      const xp = byName[i].get(name);
      const cell = el("div", "lvcell heat" + (xp ? "" : " dimnum"), xp ? formatCompact(xp) : "\u2013");
      if (xp) {
        // Shade by share of the biggest gain in the table, with a floor so a
        // small gain still reads as "something".
        cell.style.setProperty("--heat-a", (0.14 + 0.58 * (xp / max)).toFixed(2));
        cell.title = m.name + " \u00B7 " + name + ": +" + xp.toLocaleString() + " XP";
      } else {
        cell.title = per[i] ? m.name + " \u00B7 " + name + ": no XP" : m.name + ": " + blocker(m);
      }
      td.appendChild(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const tfoot = el("tfoot");
  const fr = el("tr");
  const fh = el("th", "rowhead", "Total gained");
  fh.scope = "row";
  fr.appendChild(fh);
  per.forEach(function (g) {
    fr.appendChild(g && g.total
      ? el("td", "gain", "+" + formatCompact(g.total))
      : el("td", "dimnum", g ? "0" : "\u2013"));
  });
  tfoot.appendChild(fr);
  table.appendChild(tfoot);

  const wrap = el("div", "tablewrap");
  wrap.appendChild(table);
  const section = toolCard("XP gained " + periodWords(period), "Only skills someone trained. Darker means more XP.",
    periodToggle(), wrap);
  section.appendChild(womCredit());
  return section;
}

// --- 5. Activity -------------------------------------------------------------

export function activityPage(members) {
  const page = document.createDocumentFragment();
  page.appendChild(pageHead("Activity",
    "Level-ups and big XP days across the group, last 7 days. Times are when the change was first seen, which can be later than when it happened."));

  const since = Date.now() - 7 * DAY_MS;
  const all = [];
  members.forEach(function (m) {
    if (blocker(m)) return;
    events(m.name, memberTimeline(m), since).forEach(function (e) { all.push(e); });
  });
  const rank = { "200m": 0, level: 1, xp: 2 };
  all.sort(function (a, b) { return b.at - a.at || rank[a.type] - rank[b.type]; });

  const feed = el("div", "feed");
  const loading = members.some(function (m) { return m.data && !m.history; });
  const usable = members.some(function (m) { return m.history && m.history.status === "ok"; });
  if (!all.length) {
    feed.appendChild(el("p", "empty", loading ? "Loading history\u2026"
      // An empty feed must not read as "nobody played" when the history
      // simply could not be fetched.
      : !usable ? "No history to show yet. The reasons are below; it retries on the next refresh."
      : "Nothing in the last 7 days yet. Level-ups and days with 25k+ XP in a skill show up here."));
  }

  let dayNode = null;
  let dayKey = null;
  all.forEach(function (e) {
    const key = startOfDay(e.at);
    if (key !== dayKey) {
      dayKey = key;
      dayNode = el("section", "feed-day");
      dayNode.appendChild(el("h2", "label", dayLabel(key)));
      feed.appendChild(dayNode);
    }
    dayNode.appendChild(eventRow(e));
  });

  const unavailable = members.filter(function (m) { return m.data && m.history && m.history.status !== "ok"; });
  if (unavailable.length) {
    feed.appendChild(el("p", "empty", unavailable.map(function (m) { return m.name + ": " + blocker(m); }).join(". ") + "."));
  }

  const section = card("Recent activity", "Level-ups, and 25k+ XP in a skill in a day", feed);
  section.appendChild(womCredit());
  page.appendChild(section);
  return page;
}

function dayLabel(dayStart) {
  const today = startOfDay(Date.now());
  if (dayStart === today) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayStart === yesterday.getTime()) return "Yesterday";
  return new Date(dayStart).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

function eventRow(e) {
  const row = el("div", "ev");
  row.appendChild(icon(iconForSkill(e.skill), e.skill));

  const what = el("div", "what");
  what.appendChild(link(playerHref(e.player), "ev-who", e.player));
  if (e.type === "level") {
    what.appendChild(document.createTextNode(" reached " + e.skill + " " + e.level));
    if (e.level - e.from > 1) what.appendChild(document.createTextNode(" (from " + e.from + ")"));
    what.appendChild(e.level >= MAX_SKILL_LEVEL ? el("span", "badge badge-99", "99") : el("span", "badge", "Level up"));
  } else if (e.type === "200m") {
    what.appendChild(document.createTextNode(" hit 200M XP in " + e.skill));
    what.appendChild(el("span", "badge badge-200 prism", "200M"));
  } else {
    what.appendChild(document.createTextNode(" gained "));
    const xp = el("b", "gain", formatCompact(e.xp) + " XP");
    xp.title = e.xp.toLocaleString() + " XP";
    what.appendChild(xp);
    what.appendChild(document.createTextNode(" in " + e.skill));
  }
  row.appendChild(what);

  row.appendChild(el("span", "when", new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })));
  return row;
}