// ============================================================
// OSRS Progress Dashboard - shell, wiring and timers.
//
// The shell (header / main / footer) is built once. Actions mark regions dirty
// and a single batched frame repaints only those. The picker lives in a
// <dialog> outside #app, so app repaints can never destroy its input.
// ============================================================

import { loadPlayer, loadPlayers } from "./api.js";
import { applyConfigToDocument, config } from "./config.js";
import {
  CATEGORIES, CATEGORY_SINGULAR, GIM_POSITIONS, ITEM_CATEGORIES, SKILL_GRID_ORDER,
  TEAM_CATEGORIES, TEAM_METRICS
} from "./constants.js";
import { gridIcon, iconButton, refreshIcon } from "./components.js";
import { button, el, img, replaceChildren } from "./dom.js";
import { formatClock, slug } from "./format.js";
import { mapHiscoresToDisplayItems } from "./model.js";
import { getBucket, observeBucket, onBucketChange } from "./mode.js";
import { invalidate, flush, setPainter, state } from "./store.js";
import { snapshot } from "./history.js";
import { renderGimView } from "./views/gim.js";
import { renderItemView } from "./views/item.js";
import { renderTeamView } from "./views/team.js";
import { renderTotalView } from "./views/total.js";

const CYCLE_INTERVAL_MS = config.cycleMs;
const REFRESH_INTERVAL_MS = config.refreshMs;

// The GIM roster: config.players in order, each given a die-5 slot.
const ROSTER = config.players.map(function (name, i) {
  return { name: name, pos: GIM_POSITIONS[i % GIM_POSITIONS.length] };
});

let cycleTimer = null;
let pollTimer = null;
let abortController = null;
let gimAbortController = null;

// Persistent shell nodes.
const shell = {
  root: null,
  header: el("header", "header"),
  main: el("main", "grid"),
  footer: el("footer", "footer"),
  picker: null
};

// --- Bootstrap -------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  applyConfigToDocument();

  state.player = config.player;
  state.category = config.view;

  shell.root = document.getElementById("app");
  shell.root.className = "app";
  shell.root.append(shell.header, shell.main, shell.footer);

  shell.picker = buildPickerDialog();
  document.body.appendChild(shell.picker.dialog);

  // Resolve the bucket before the first paint so views never render into the
  // wrong layout and immediately reflow.
  observeBucket(shell.root);
  onBucketChange(function () {
    invalidate("main");
    startCycleTimer(); // a bucket change can start or stop GIM member cycling
  });

  setPainter(paint);
  loadData();
  if (TEAM_CATEGORIES.has(state.category)) loadGimData();
  // loadData() only marks header+main dirty; the first paint must cover the
  // whole shell or the footer never gets built.
  invalidate();
  flush();

  setupGlobalKeys();
  setupTouchGestures();
  setupVisibilityHandling();
  startPollTimer();
});

// --- Painting --------------------------------------------------------------

function paint(dirty) {
  const current = getCurrent();
  if (current) state.lastSelectedId = current.id;

  if (dirty.has("header")) {
    replaceChildren(shell.header, buildHeaderCenter(current),
      config.chrome ? buildHeaderActions() : null);
  }
  if (dirty.has("main")) paintMain(current);
  if (dirty.has("footer")) {
    if (config.chrome) replaceChildren(shell.footer, buildTabs(), buildControls());
    else replaceChildren(shell.footer);
  }
  if (dirty.has("overlay")) paintPicker();
}

function paintMain(current) {
  const bucket = getBucket();
  const view = state.category === "gim" ? renderGimView(state, bucket, ROSTER)
    : state.category === "team" ? renderTeamView(state, bucket, ROSTER)
    : state.category === "total" ? renderTotalView(state)
    : renderItemView(Object.assign({ current: current, bucket: bucket }, state));

  shell.main.className = view.className;
  replaceChildren(shell.main, ...view.children);
}

// --- Data ------------------------------------------------------------------

function loadData() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  state.error = null;
  if (state.items.length === 0) state.loading = true;
  invalidate("header", "main");

  loadPlayer(state.player, abortController.signal)
    .then(function (result) {
      state.fetchedAt = result.fetchedAt;
      state.stale = result.stale;
      state.error = result.data ? null : result.error;
      if (!result.data) return;

      snapshot(state.player, result.data);
      state.items = mapHiscoresToDisplayItems(result.data);
      applyItemSlug();
      preserveSelection();
    })
    .catch(function (e) {
      if (isAbort(e)) return;
      state.error = e.message || "Unknown error";
    })
    .finally(function () {
      state.loading = false;
      state.refreshing = false;
      invalidate();
      startCycleTimer();
    });
}

// ?item=slayer locks a widget slot onto one entry. Ids come from the hiscores
// payload, so the slug can only be resolved once data has arrived.
function applyItemSlug() {
  if (!config.itemSlug || state.pinnedId) return;
  const match = state.items.find(function (i) { return slug(i.name) === config.itemSlug; });
  if (!match) return;
  state.category = match.category;
  state.pinnedId = match.id;
  state.pinned = true;
}

// Keep the user (or the widget's configured item) on the same entry across a
// refresh, rather than snapping back to index 0.
function preserveSelection() {
  if (!ITEM_CATEGORIES.has(state.category)) return;

  const filtered = getFiltered();
  const desiredId = state.pinnedId || state.lastSelectedId;

  if (desiredId) {
    const idx = filtered.findIndex(function (x) { return x.id === desiredId; });
    if (idx >= 0) {
      state.index = idx;
      return;
    }
    // The pinned entry does not exist for this player (an unranked skill, or a
    // boss they have never killed). Keep the pin so it reappears when they
    // switch back, but land on something real in the meantime.
    state.index = 0;
    return;
  }
  state.index = filtered.length > 0 ? Math.min(state.index, filtered.length - 1) : 0;
}

function loadGimData() {
  if (gimAbortController) gimAbortController.abort();
  gimAbortController = new AbortController();

  state.gim.loading = true;
  invalidate("main");

  loadPlayers(ROSTER.map(function (m) { return m.name; }), gimAbortController.signal)
    .then(function (results) {
      // Only fresh reads anchor a day; a cached payload would backdate it.
      results.forEach(function (r) {
        if (r.data && !r.stale) snapshot(r.player, r.data);
      });
      state.gim.results = results;
      state.gim.loaded = true;
    })
    .catch(function (e) {
      if (isAbort(e)) return;
      state.gim.results = [];
    })
    .finally(function () {
      state.gim.loading = false;
      invalidate("main");
      startCycleTimer();
    });
}

function isAbort(err) {
  return err && (err.name === "AbortError" || err.name === "TimeoutError");
}

// --- Selection helpers -----------------------------------------------------

function getFiltered() {
  if (!ITEM_CATEGORIES.has(state.category)) return [];
  return state.items.filter(function (i) {
    if (i.category !== state.category) return false;
    // Cycling through 68 bosses you have never killed is a seven-minute loop
    // of empty gauges. A pinned entry always stays visible.
    if (!config.showUnkilled && i.milestoneUnit === "kills" && i.kills <= 0) {
      return i.id === state.pinnedId;
    }
    return true;
  });
}

function getCurrent() {
  return getFiltered()[state.index] || null;
}

function getPickerItems() {
  const filtered = getFiltered();
  if (state.category === "skills") {
    const byName = new Map(filtered.map(function (s) { return [s.name, s]; }));
    return SKILL_GRID_ORDER.map(function (n) { return byName.get(n); }).filter(Boolean);
  }
  // Busiest first is more useful than alphabetical for kill counts.
  return filtered.slice().sort(function (a, b) {
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.name.localeCompare(b.name);
  });
}

// --- Timers ----------------------------------------------------------------

function startCycleTimer() {
  stopCycleTimer();
  if (document.hidden || CYCLE_INTERVAL_MS <= 0) return;

  // The single-panel GIM layout (narrow slots) cycles through members instead
  // of through items.
  if (state.category === "gim") {
    if (!gimCycles()) return;
    cycleTimer = setInterval(function () {
      state.gim.cycleIndex = (state.gim.cycleIndex + 1) % Math.max(1, ROSTER.length);
      invalidate("main");
    }, CYCLE_INTERVAL_MS);
    return;
  }

  if (!ITEM_CATEGORIES.has(state.category)) return;
  if (state.pinned || state.pinnedId) return;
  // The picker used to be rebuilt by every repaint, so cycling while it was
  // open wiped the search box mid-typing. It now lives outside #app, but there
  // is still no reason to shuffle the view behind an open dialog.
  if (state.pickerOpen) return;
  if (getFiltered().length <= 1) return;

  cycleTimer = setInterval(function () {
    const count = getFiltered().length;
    if (count === 0) return;
    state.index = (state.index + 1) % count;
    invalidate("header", "main");
  }, CYCLE_INTERVAL_MS);
}

function stopCycleTimer() {
  if (cycleTimer) clearInterval(cycleTimer);
  cycleTimer = null;
}

function gimCycles() {
  if (config.gimStyle) return config.gimStyle === "cycle";
  return getBucket() === "m";
}

// An always-on display that only fetches at startup shows whatever the XP was
// when the PC last woke. Poll, and stop entirely while hidden.
function startPollTimer() {
  stopPollTimer();
  if (REFRESH_INTERVAL_MS <= 0) return;
  pollTimer = setInterval(function () {
    if (document.hidden) return;
    refreshAll();
  }, REFRESH_INTERVAL_MS);
}

function stopPollTimer() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function refreshAll() {
  loadData();
  if (TEAM_CATEGORIES.has(state.category)) loadGimData();
}

function setupVisibilityHandling() {
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopCycleTimer();
      stopPollTimer();
      return;
    }
    // Back from hidden: the data is suspect by definition.
    startPollTimer();
    startCycleTimer();
    refreshAll();
  });
}

// --- Actions ---------------------------------------------------------------

function onRefresh() {
  state.refreshing = true;
  invalidate("header");
  refreshAll();
}

function setCategory(cat) {
  if (state.category === cat) return;
  state.category = cat;
  state.index = 0;
  invalidate();
  startCycleTimer();
  if (TEAM_CATEGORIES.has(cat) && !state.gim.loaded && !state.gim.loading) loadGimData();
}

function onPrev() {
  const count = getFiltered().length;
  if (count === 0) return;
  state.index = (state.index - 1 + count) % count;
  invalidate("header", "main");
}

function onNext() {
  const count = getFiltered().length;
  if (count === 0) return;
  state.index = (state.index + 1) % count;
  invalidate("header", "main");
}

function onTogglePin() {
  const wasPinned = state.pinned || state.pinnedId;

  if (wasPinned) {
    state.pinned = false;
    state.pinnedId = null;
  } else {
    // Record WHICH item is pinned, not just that cycling is paused. Without
    // the id, switching player had nothing to restore and fell back to the
    // first entry in the category.
    const current = getCurrent();
    state.pinned = true;
    state.pinnedId = current ? current.id : null;
  }

  invalidate("footer");
  startCycleTimer();
}

function onMetricChange(metric) {
  if (state.teamMetric === metric) return;
  state.teamMetric = metric;
  invalidate("header", "main", "footer");
}

function onPlayerChange(name) {
  if (name === state.player) return;
  state.player = name;
  // Deliberately keep pinnedId AND lastSelectedId: skill and activity ids are
  // stable across players, so switching to a teammate should land on the same
  // skill rather than resetting to the first one. preserveSelection() resolves
  // the index once the new payload arrives.
  invalidate("footer");
  loadData();
}

function jumpToId(id) {
  const idx = getFiltered().findIndex(function (x) { return x.id === id; });
  if (idx >= 0) state.index = idx;
}

// --- Header ----------------------------------------------------------------

// Anchored to the header bar rather than to the centred card, so it cannot
// sit on top of the player name.
function buildHeaderActions() {
  const actions = el("div", "headerActions");
  actions.appendChild(iconButton("Refresh", refreshIcon(state.refreshing), onRefresh,
    state.loading || state.refreshing));
  actions.appendChild(iconButton("Pick item", gridIcon(), openPicker,
    state.loading || !ITEM_CATEGORIES.has(state.category)));
  return actions;
}

function buildHeaderCenter(current) {
  const center = el("div", "headerCenter");

  if (state.category === "gim" || state.category === "team") {
    let label = "GIM Levels";
    if (state.category === "team") {
      const metric = TEAM_METRICS.find(function (m) { return m.id === state.teamMetric; });
      label = "Team \u00B7 " + (metric ? metric.label : "Skills");
    }
    center.appendChild(el("div", "headerGimOnly", label));
    return center;
  }

  center.appendChild(el("div", "headerPlayer", state.player));

  const itemRow = el("div", "headerItemRow");
  const iconWrap = el("div", "iconWrap");

  if (state.category === "total") {
    iconWrap.appendChild(img("wwwroot/icons/skills/total.png", "Total", "icon"));
  } else if (current) {
    iconWrap.appendChild(img(current.iconUrl, current.name, "icon"));
  }
  itemRow.appendChild(iconWrap);
  itemRow.appendChild(el("div", "title", headerTitle(current)));
  center.appendChild(itemRow);

  if (state.stale && state.fetchedAt) {
    const tag = el("div", "staleTag", "as of " + formatClock(state.fetchedAt));
    tag.title = state.error || "Refresh failed - showing cached data";
    center.appendChild(tag);
  }

  return center;
}

function headerTitle(current) {
  if (state.category === "total") return "Totals";
  if (!current) return state.loading ? "Loading…" : "No data";
  if (current.category === "skills") return current.name + " - " + (current.skillLevel || 0);
  return current.name;
}

// --- Footer ----------------------------------------------------------------

function buildTabs() {
  const tabs = el("div", "tabs");
  tabs.setAttribute("role", "tablist");

  CATEGORIES.forEach(function (cat) {
    const active = state.category === cat.id;
    const btn = button("tab" + (active ? " tabActive" : ""), cat.label, function () {
      setCategory(cat.id);
    });
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", active ? "true" : "false");
    tabs.appendChild(btn);
  });
  return tabs;
}

function buildControls() {
  const controls = el("div", "controls");
  const isItemView = ITEM_CATEGORIES.has(state.category);
  const empty = getFiltered().length === 0;
  const isPinned = !!(state.pinned || state.pinnedId);

  const pin = button("btn" + (isPinned ? " btnPin" : ""), isPinned ? "Pinned" : "Pin", onTogglePin);
  pin.disabled = !isItemView;
  pin.setAttribute("aria-pressed", isPinned ? "true" : "false");
  controls.appendChild(pin);

  const prev = button("btn", "Prev", onPrev);
  prev.disabled = !isItemView || empty;
  controls.appendChild(prev);

  const next = button("btn", "Next", onNext);
  next.disabled = !isItemView || empty;
  controls.appendChild(next);

  controls.appendChild(state.category === "team" ? buildMetricMenu() : buildPlayerMenu());
  return controls;
}

// A small custom dropdown. Used for the player selector and, on the Team tab,
// for the metric selector - a single player means nothing on that view.
function buildDropdown(opts) {
  const wrapper = el("div", "playerMenu");

  const btn = button("btn playerMenuBtn", null, function () {
    if (wrapper.querySelector(".playerMenuPanel")) return closeMenu();

    chevron.classList.add("open");
    btn.setAttribute("aria-expanded", "true");

    const panel = el("div", "playerMenuPanel");
    panel.setAttribute("role", "listbox");
    opts.options.forEach(function (option) {
      const active = option.value === opts.value;
      const item = button("playerMenuItem" + (active ? " active" : ""), option.label,
        function () { opts.onSelect(option.value); });
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", active ? "true" : "false");
      panel.appendChild(item);
    });
    wrapper.appendChild(panel);
  });

  btn.disabled = !!opts.disabled;
  btn.title = opts.title;
  btn.setAttribute("aria-label", opts.title);
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");

  const selected = opts.options.find(function (o) { return o.value === opts.value; });
  btn.appendChild(el("span", "playerMenuValue", selected ? selected.label : opts.value));
  const chevron = el("span", "playerMenuChevron", "\u25BE");
  btn.appendChild(chevron);

  function closeMenu() {
    const panel = wrapper.querySelector(".playerMenuPanel");
    if (panel) panel.remove();
    chevron.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("pointerdown", function (e) {
    if (!wrapper.isConnected) return;
    if (!wrapper.contains(e.target)) closeMenu();
  });

  wrapper.appendChild(btn);
  return wrapper;
}

function buildPlayerMenu() {
  return buildDropdown({
    title: "Select player",
    value: state.player,
    disabled: state.loading || state.refreshing,
    options: config.players.map(function (name) { return { value: name, label: name }; }),
    onSelect: onPlayerChange
  });
}

function buildMetricMenu() {
  return buildDropdown({
    title: "Measure team by",
    value: state.teamMetric,
    options: TEAM_METRICS.map(function (m) { return { value: m.id, label: m.label }; }),
    onSelect: onMetricChange
  });
}

// --- Picker ----------------------------------------------------------------
// Built once and kept outside #app so repaints cannot touch its input.

function buildPickerDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "pickerDialog";

  const header = el("div", "modalHeader");
  const title = el("div", "modalTitle", "Pick an item");
  header.appendChild(title);
  header.appendChild(button("btn", "Close", closePicker));

  const input = document.createElement("input");
  input.className = "input";
  input.type = "search";
  input.placeholder = "Search…";
  input.setAttribute("aria-label", "Search items");

  const grid = el("div", "pickerGrid");
  grid.setAttribute("role", "listbox");

  input.addEventListener("input", function () { paintPickerGrid(grid, input.value); });
  dialog.append(header, input, grid);

  // Native dialogs close on Escape and on backdrop click if we forward it.
  dialog.addEventListener("close", function () {
    if (!state.pickerOpen) return;
    state.pickerOpen = false;
    invalidate("footer");
    startCycleTimer();
  });
  dialog.addEventListener("pointerdown", function (e) {
    if (e.target === dialog) closePicker();
  });

  return { dialog: dialog, title: title, input: input, grid: grid };
}

function openPicker() {
  state.pickerOpen = true;
  stopCycleTimer();
  invalidate("overlay");
}

function closePicker() {
  state.pickerOpen = false;
  if (shell.picker.dialog.open) shell.picker.dialog.close();
  startCycleTimer();
}

function paintPicker() {
  const p = shell.picker;

  if (!state.pickerOpen) {
    if (p.dialog.open) p.dialog.close();
    return;
  }

  const word = CATEGORY_SINGULAR[state.category] || "item";
  p.title.textContent = "Pick a " + word.charAt(0).toUpperCase() + word.slice(1);
  paintPickerGrid(p.grid, p.input.value);

  if (!p.dialog.open) {
    p.dialog.showModal();
    p.input.focus();
  }
}

function paintPickerGrid(container, query) {
  const q = (query || "").trim().toLowerCase();
  const items = getPickerItems().filter(function (x) {
    return !q || x.name.toLowerCase().includes(q);
  });

  const cells = items.map(function (item) {
    const isPinned = state.pinnedId === item.id;

    // A div, not a button: the pin control is a button, and a button inside a
    // button is invalid HTML that parsers are free to hoist out of the tree.
    const cell = el("div", "pickerCell" + (isPinned ? " pickerCellPinned" : ""));
    cell.setAttribute("role", "option");
    cell.setAttribute("aria-selected", isPinned ? "true" : "false");
    cell.tabIndex = 0;
    cell.title = item.name;

    const choose = function () {
      jumpToId(item.id);
      closePicker();
      invalidate("header", "main");
    };
    cell.addEventListener("click", choose);
    cell.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });

    const icon = img(item.iconUrl, item.name, "pickerIcon");
    // The name is rendered as a label right below, so the image itself is
    // decorative - but the fallback monogram still needs the name.
    icon.setAttribute("aria-hidden", "true");
    cell.appendChild(icon);
    cell.appendChild(el("div", "pickerName", item.name));

    const pinRow = el("div", "pickerPinRow");
    pinRow.appendChild(el("span", "pickerPinText", isPinned ? "Pinned" : "Pin"));
    pinRow.appendChild(button("btn btnMini" + (isPinned ? " btnPin" : ""), "📌",
      function (e) {
        e.stopPropagation();
        state.pinnedId = state.pinnedId === item.id ? null : item.id;
        state.pinned = !!state.pinnedId;
        jumpToId(item.id);
        paintPickerGrid(container, query);
        invalidate("header", "main", "footer");
        startCycleTimer();
      }));
    cell.appendChild(pinRow);

    return cell;
  });

  if (cells.length === 0) {
    replaceChildren(container, el("div", "pickerEmpty", "No matches"));
    return;
  }
  replaceChildren(container, ...cells);
}

// --- Touch -----------------------------------------------------------------
// Swipe horizontally to change item, vertically to change tab. The Edge is a
// five-point touch panel and was previously driven only by small buttons.

const SWIPE_MIN_PX = 48;
const SWIPE_MAX_MS = 700;

function setupTouchGestures() {
  let start = null;

  shell.root.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    // Let controls handle their own taps.
    if (e.target.closest("button, input, .playerMenu")) return;
    start = { x: e.clientX, y: e.clientY, t: Date.now() };
  });

  shell.root.addEventListener("pointerup", function (e) {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const elapsed = Date.now() - start.t;
    start = null;

    if (elapsed > SWIPE_MAX_MS) return;

    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onNext(); else onPrev();
      return;
    }
    if (Math.abs(dy) >= SWIPE_MIN_PX && Math.abs(dy) > Math.abs(dx)) {
      stepCategory(dy < 0 ? 1 : -1);
    }
  });

  shell.root.addEventListener("pointercancel", function () { start = null; });
}

function stepCategory(delta) {
  const idx = CATEGORIES.findIndex(function (c) { return c.id === state.category; });
  const next = CATEGORIES[(idx + delta + CATEGORIES.length) % CATEGORIES.length];
  setCategory(next.id);
}

// --- Keyboard --------------------------------------------------------------

function setupGlobalKeys() {
  document.addEventListener("keydown", function (e) {
    if (shell.picker.dialog.open) return; // the dialog handles its own keys
    if (e.target instanceof HTMLInputElement) return;

    if (e.key === "ArrowRight") { onNext(); return; }
    if (e.key === "ArrowLeft") { onPrev(); return; }
    if (e.key === "r" || e.key === "R") { onRefresh(); return; }
    if (e.key === "p" || e.key === "P") { onTogglePin(); }
  });
}