// ============================================================
// OSRS Progress Dashboard - shell, wiring and timers.
//
// The shell (header / main / footer) is built once. Actions mark regions dirty
// and a single batched frame repaints only those. The picker lives in a
// <dialog> outside #app, so app repaints can never destroy its input.
// ============================================================

import { loadPlayer, loadPlayers } from "./api.js";
import {
  CATEGORIES, ITEM_CATEGORIES, PLAYER_OPTIONS, SKILL_GRID_ORDER, TEAM
} from "./constants.js";
import { gridIcon, iconButton, refreshIcon } from "./components.js";
import { button, el, img, replaceChildren } from "./dom.js";
import { formatClock } from "./format.js";
import { mapHiscoresToDisplayItems } from "./model.js";
import { invalidate, flush, setPainter, state } from "./store.js";
import { renderGimView } from "./views/gim.js";
import { renderItemView } from "./views/item.js";
import { renderTotalView } from "./views/total.js";

const CYCLE_INTERVAL_MS = 6000;
const REFRESH_INTERVAL_MS = 300000; // 5 minutes

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
  shell.root = document.getElementById("app");
  shell.root.className = "app";
  shell.root.append(shell.header, shell.main, shell.footer);

  shell.picker = buildPickerDialog();
  document.body.appendChild(shell.picker.dialog);

  setPainter(paint);
  loadData();
  // loadData() only marks header+main dirty; the first paint must cover the
  // whole shell or the footer never gets built.
  invalidate();
  flush();

  setupGlobalKeys();
  setupVisibilityHandling();
  startPollTimer();
});

// --- Painting --------------------------------------------------------------

function paint(dirty) {
  const current = getCurrent();
  if (current) state.lastSelectedId = current.id;

  if (dirty.has("header")) {
    replaceChildren(shell.header, buildHeaderCenter(current), buildHeaderActions());
  }
  if (dirty.has("main")) paintMain(current);
  if (dirty.has("footer")) replaceChildren(shell.footer, buildTabs(), buildControls());
  if (dirty.has("overlay")) paintPicker();
}

function paintMain(current) {
  const view = state.category === "gim" ? renderGimView(state)
    : state.category === "total" ? renderTotalView(state)
    : renderItemView(Object.assign({ current: current }, state));

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

      state.items = mapHiscoresToDisplayItems(result.data);
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

// Keep the user (or the widget's configured item) on the same entry across a
// refresh, rather than snapping back to index 0.
function preserveSelection() {
  if (!ITEM_CATEGORIES.has(state.category)) return;

  const filtered = getFiltered();
  const desiredId = state.pinnedId || state.lastSelectedId;

  if (desiredId) {
    const idx = filtered.findIndex(function (x) { return x.id === desiredId; });
    state.index = idx >= 0 ? idx : 0;
    return;
  }
  state.index = filtered.length > 0 ? Math.min(state.index, filtered.length - 1) : 0;
}

function loadGimData() {
  if (gimAbortController) gimAbortController.abort();
  gimAbortController = new AbortController();

  state.gim.loading = true;
  invalidate("main");

  loadPlayers(TEAM.map(function (m) { return m.name; }), gimAbortController.signal)
    .then(function (results) {
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
    });
}

function isAbort(err) {
  return err && (err.name === "AbortError" || err.name === "TimeoutError");
}

// --- Selection helpers -----------------------------------------------------

function getFiltered() {
  if (!ITEM_CATEGORIES.has(state.category)) return [];
  return state.items.filter(function (i) { return i.category === state.category; });
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
  return filtered.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
}

// --- Timers ----------------------------------------------------------------

function startCycleTimer() {
  stopCycleTimer();
  if (!ITEM_CATEGORIES.has(state.category)) return;
  if (state.pinned || state.pinnedId) return;
  // The picker used to be rebuilt by every repaint, so cycling while it was
  // open wiped the search box mid-typing. It now lives outside #app, but there
  // is still no reason to shuffle the view behind an open dialog.
  if (state.pickerOpen) return;
  if (document.hidden || CYCLE_INTERVAL_MS <= 0) return;
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
  if (state.category === "gim") loadGimData();
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
  if (cat === "gim" && !state.gim.loaded && !state.gim.loading) loadGimData();
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
  state.pinned = !wasPinned;
  state.pinnedId = null;
  invalidate("footer");
  startCycleTimer();
}

function onPlayerChange(name) {
  if (name === state.player) return;
  state.player = name;
  state.index = 0;
  state.lastSelectedId = null;
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

  if (state.category === "gim") {
    center.appendChild(el("div", "headerGimOnly", "GIM Levels"));
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

  controls.appendChild(buildPlayerMenu());
  return controls;
}

function buildPlayerMenu() {
  const wrapper = el("div", "playerMenu");

  const btn = button("btn playerMenuBtn", null, function () {
    const open = wrapper.querySelector(".playerMenuPanel");
    if (open) return closeMenu();

    chevron.classList.add("open");
    btn.setAttribute("aria-expanded", "true");

    const panel = el("div", "playerMenuPanel");
    panel.setAttribute("role", "listbox");
    PLAYER_OPTIONS.forEach(function (name) {
      const active = name === state.player;
      const item = button("playerMenuItem" + (active ? " active" : ""), name, function () {
        onPlayerChange(name);
      });
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", active ? "true" : "false");
      panel.appendChild(item);
    });
    wrapper.appendChild(panel);
  });
  btn.disabled = state.loading || state.refreshing;
  btn.title = "Select player";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");

  btn.appendChild(el("span", "playerMenuValue", state.player));
  const chevron = el("span", "playerMenuChevron", "▾");
  btn.appendChild(chevron);

  function closeMenu() {
    const panel = wrapper.querySelector(".playerMenuPanel");
    if (panel) panel.remove();
    chevron.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  // Close on any pointer press outside the menu.
  document.addEventListener("pointerdown", function (e) {
    if (!wrapper.isConnected) return;
    if (!wrapper.contains(e.target)) closeMenu();
  });

  wrapper.appendChild(btn);
  return wrapper;
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

  const label = state.category.charAt(0).toUpperCase() + state.category.slice(1, -1);
  p.title.textContent = "Pick a " + label;
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

    cell.appendChild(img(item.iconUrl, "", "pickerIcon"));
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
