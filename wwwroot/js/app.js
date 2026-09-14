// ============================================================
// OSRS Dashboard — Vanilla JS App
// ============================================================
 
// --- State ---
let state = {
  player: DEFAULT_PLAYER,
  items: [],
  category: "skills",
  index: 0,
  pinned: false,
  pinnedId: null,
  pickerOpen: false,
  loading: true,
  refreshing: false,
  error: null,
  lastSelectedId: null,
  // Freshness of the current player's data, so the UI can admit to being stale
  // instead of silently showing hours-old numbers as if they were live.
  fetchedAt: null,
  stale: false,
  // GIM results live in state, not in the DOM. Previously any render() while
  // on the GIM tab replaced the panels with a "Loading GIM..." placeholder
  // that nothing ever resolved, blanking the tab until you switched away.
  gim: { results: [], loading: false, loaded: false }
};
 
let cycleTimer = null;
let pollTimer = null;
let abortController = null;
let gimAbortController = null;
 
// --- DOM references (set in init) ---
let $app;
 
// --- Init ---
document.addEventListener("DOMContentLoaded", function () {
  $app = document.getElementById("app");
  loadData();
  render();
  setupOutsideClickHandlers();
  setupVisibilityHandling();
  startPollTimer();
});

// --- Polling ---
// An always-on display that only fetches at startup shows whatever the XP was
// when the PC last woke up. Poll instead, and stop entirely while hidden so a
// background tab is not rebuilding the DOM and hitting the network forever.
function startPollTimer() {
  stopPollTimer();
  if (REFRESH_INTERVAL_MS <= 0) return;
  pollTimer = setInterval(function () {
    if (document.hidden) return;
    loadData();
    if (state.category === "gim") loadGimData();
  }, REFRESH_INTERVAL_MS);
}

function stopPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function setupVisibilityHandling() {
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopCycleTimer();
      stopPollTimer();
      return;
    }
    // Coming back from hidden: the data is by definition suspect.
    startPollTimer();
    startCycleTimer();
    loadData();
    if (state.category === "gim") loadGimData();
  });
}
 
// --- Data Loading ---
function loadData() {
  if (abortController) abortController.abort();
  abortController = new AbortController();
 
  state.error = null;
  if (state.items.length === 0) state.loading = true;
  render();
 
  loadPlayer(state.player, abortController.signal)
    .then(function (result) {
      state.fetchedAt = result.fetchedAt;
      state.stale = result.stale;
      state.error = result.data ? null : result.error;
      if (!result.data) return;

      const mapped = mapHiscoresToDisplayItems(result.data);
      state.items = mapped;
 
      // Preserve selection
      if (state.category !== "total" && state.category !== "gim") {
        const desiredId = state.pinnedId || state.lastSelectedId;
        if (desiredId) {
          const filtered = getFiltered(mapped);
          const idx = filtered.findIndex(function (x) { return x.id === desiredId; });
          state.index = idx >= 0 ? idx : 0;
        } else {
          const filtered = getFiltered(mapped);
          if (filtered.length > 0) {
            state.index = Math.min(state.index, filtered.length - 1);
          } else {
            state.index = 0;
          }
        }
      }
    })
    .catch(function (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") return;
      state.error = e.message || "Unknown error";
    })
    .finally(function () {
      state.loading = false;
      state.refreshing = false;
      render();
      startCycleTimer();
    });
}
 
// --- Helpers ---
function getFiltered(items) {
  if (!items) items = state.items;
  if (state.category === "total" || state.category === "gim") return [];
  return items.filter(function (i) { return i.category === state.category; });
}
 
function getCurrent() {
  const filtered = getFiltered();
  return filtered[state.index] || null;
}
 
function getSkillItems() {
  return state.items.filter(function (i) { return i.category === "skills"; });
}
 
function getPickerItems() {
  const filtered = getFiltered();
  if (state.category === "skills") {
    const byName = new Map(filtered.map(function (s) { return [s.name, s]; }));
    return SKILL_GRID_ORDER
      .map(function (n) { return byName.get(n); })
      .filter(Boolean);
  }
  return filtered.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
}
 
// --- Auto-cycle timer ---
function startCycleTimer() {
  stopCycleTimer();
  if (state.category === "total" || state.category === "gim") return;
  if (state.pinned || state.pinnedId) return;
  // The picker is rebuilt by render(), so cycling while it is open wipes the
  // search box and its focus mid-typing.
  if (state.pickerOpen) return;
  if (document.hidden) return;
  if (CYCLE_INTERVAL_MS <= 0) return;
  const filtered = getFiltered();
  if (filtered.length <= 1) return;
 
  cycleTimer = setInterval(function () {
    const filtered = getFiltered();
    if (filtered.length === 0) return;
    state.index = (state.index + 1) % filtered.length;
    render();
  }, CYCLE_INTERVAL_MS);
}
 
function stopCycleTimer() {
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
}
 
// --- Actions ---
function onRefresh() {
  state.refreshing = true;
  loadData();
  if (state.category === "gim") loadGimData();
}
 
function setCategory(cat) {
  state.category = cat;
  state.index = 0;
  state.pickerOpen = false;
  render();
  startCycleTimer();
  if (cat === "gim" && !state.gim.loaded) loadGimData();
}
 
function jumpToId(id) {
  const filtered = getFiltered();
  const idx = filtered.findIndex(function (x) { return x.id === id; });
  if (idx >= 0) state.index = idx;
}
 
function onPrev() {
  state.index = Math.max(0, state.index - 1);
  render();
}
 
function onNext() {
  const filtered = getFiltered();
  state.index = filtered.length ? (state.index + 1) % filtered.length : 0;
  render();
}
 
function onTogglePin() {
  state.pinned = !state.pinned;
  if (state.pinned) state.pinnedId = null;
  else state.pinnedId = null;
  render();
  startCycleTimer();
}
 
function onPickerOpen() {
  state.pickerOpen = true;
  stopCycleTimer();
  render();
}
 
function onPickerClose() {
  state.pickerOpen = false;
  render();
  startCycleTimer();
}
 
function onPickerSelect(id) {
  jumpToId(id);
  state.pickerOpen = false;
  render();
}
 
function onPickerPin(id) {
  state.pinnedId = (state.pinnedId === id) ? null : id;
  state.pinned = true;
  jumpToId(id);
  render();
  startCycleTimer();
}
 
function onPlayerChange(name) {
  state.player = name;
  state.index = 0;
  loadData();
}
 
// --- Outside click handler for player menu ---
function setupOutsideClickHandlers() {
  document.addEventListener("mousedown", function (e) {
    const menu = document.querySelector(".playerMenu");
    if (menu && !menu.contains(e.target)) {
      const panel = document.querySelector(".playerMenuPanel");
      if (panel) {
        panel.remove();
        const chevron = menu.querySelector(".playerMenuChevron");
        if (chevron) chevron.classList.remove("open");
      }
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      const panel = document.querySelector(".playerMenuPanel");
      if (panel) panel.remove();
      if (state.pickerOpen) {
        state.pickerOpen = false;
        render();
        startCycleTimer();
      }
    }
  });
}
 
// ============================================================
// RENDERING
// ============================================================
 
function render() {
  const current = getCurrent();
  if (current) state.lastSelectedId = current.id;
 
  $app.innerHTML = "";
  $app.className = "app";
 
  $app.appendChild(renderHeader(current));
  $app.appendChild(renderMain(current));
  $app.appendChild(renderFooter());
 
  if (state.pickerOpen) {
    $app.appendChild(renderPickerModal());
  }
}
 
// --- Header ---
function renderHeader(current) {
  const header = el("header", "header");
 
  // Action buttons
  const actions = el("div", "headerActions");
 
  // Refresh button
  const refreshBtn = el("button", "iconBtn");
  refreshBtn.type = "button";
  refreshBtn.title = "Refresh";
  refreshBtn.disabled = state.loading || state.refreshing;
  refreshBtn.innerHTML = renderRefreshIcon(state.refreshing);
  refreshBtn.onclick = onRefresh;
  actions.appendChild(refreshBtn);
 
  // Grid/Picker button
  const gridBtn = el("button", "iconBtn");
  gridBtn.type = "button";
  gridBtn.title = "Pick item";
  gridBtn.disabled = state.loading || state.category === "total" || state.category === "gim";
  gridBtn.innerHTML = renderGridIcon();
  gridBtn.onclick = onPickerOpen;
  actions.appendChild(gridBtn);
 
  header.appendChild(actions);
 
  // Center content
  const center = el("div", "headerCenter");
 
  if (state.category === "gim") {
    const gimLabel = el("div", "headerGimOnly");
    gimLabel.textContent = "GIM Levels";
    center.appendChild(gimLabel);
  } else {
    const playerName = el("div", "headerPlayer");
    playerName.textContent = state.player;
    center.appendChild(playerName);
 
    const itemRow = el("div", "headerItemRow");
 
    const iconWrap = el("div", "iconWrap");
    if (state.category === "total") {
      const img = document.createElement("img");
      img.className = "icon";
      img.src = "wwwroot/icons/skills/total.png";
      img.alt = "Total";
      iconWrap.appendChild(img);
    } else if (current && current.iconUrl) {
      const img = document.createElement("img");
      img.className = "icon";
      img.src = current.iconUrl;
      img.alt = current.name;
      iconWrap.appendChild(img);
    }
    itemRow.appendChild(iconWrap);
 
    const title = el("div", "title");
    if (state.category === "total") {
      title.textContent = "Totals";
    } else if (current) {
      if (current.category === "skills") {
        title.textContent = current.name + " - " + (current.skillLevel || current.milestoneCurrent || 0);
      } else {
        title.textContent = current.name;
      }
    } else {
      title.textContent = state.loading ? "Loading..." : "No data";
    }
    itemRow.appendChild(title);
    center.appendChild(itemRow);

    if (state.stale && state.fetchedAt) {
      const staleTag = el("div", "staleTag");
      staleTag.textContent = "as of " + formatClock(state.fetchedAt);
      staleTag.title = state.error || "Refresh failed - showing cached data";
      center.appendChild(staleTag);
    }
  }
 
  header.appendChild(center);
  return header;
}
 
// --- Main content ---
function renderMain(current) {
  if (state.category === "total") {
    const main = el("main", "grid");
    const section = el("section", "card full cardTotal");
    if (state.loading) {
      section.textContent = "Loading\u2026";
    } else if (state.error) {
      section.textContent = state.error;
    } else {
      section.appendChild(renderTotalGrid());
    }
    main.appendChild(section);
    return main;
  }
 
  if (state.category === "gim") {
    const main = el("main", "mainFill");
    const section = el("section", "card full cardTotal");
    section.style.width = "100%";
    section.style.height = "100%";
    section.appendChild(renderGimLayout());
    main.appendChild(section);
    return main;
  }
 
  // Skills / Bosses / Activities
  const main = el("main", "grid");
 
  // Left arc
  const leftCard = el("section", "card cardArc");
  if (state.loading) {
    leftCard.textContent = "Loading\u2026";
  } else if (state.error) {
    leftCard.textContent = state.error;
  } else if (current) {
    const primaryRemaining = Math.max(0, current.primaryTarget - current.primaryCurrent);
    const primarySub = current.milestoneUnit === "kills"
      ? fmt(primaryRemaining) + " Remaining"
      : fmt(primaryRemaining) + " XP Left";
    leftCard.appendChild(renderArcGauge({
      value: current.primaryCurrent,
      max: current.primaryTarget,
      labelTop: current.primaryLabelTop,
      centerMainParts: {
        top: fmt(current.primaryCurrent),
        bottom: fmt(current.primaryTarget)
      },
      centerSub: primarySub,
      centerHint: current.milestoneUnit === "kills" ? "To next milestone" : "To next level"
    }));
  } else {
    leftCard.textContent = "No item";
  }
  main.appendChild(leftCard);
 
  // Right arc or rank
  const rightCard = el("section", "card cardArc");
  if (state.loading) {
    rightCard.textContent = "Loading\u2026";
  } else if (state.error) {
    rightCard.textContent = state.error;
  } else if (current) {
    if (current.secondaryType === "rank") {
      rightCard.appendChild(renderRankBadge(
        current.secondaryLabelTop,
        formatRank(current.secondaryCurrent)
      ));
    } else {
      const secRemaining = Math.max(0, (current.secondaryTarget || 0) - (current.secondaryCurrent || 0));
      rightCard.appendChild(renderArcGauge({
        value: current.secondaryCurrent || 0,
        max: current.secondaryTarget || 1,
        labelTop: current.secondaryLabelTop,
        centerMainParts: {
          top: fmt(current.secondaryCurrent || 0),
          bottom: fmt(current.secondaryTarget || 1)
        },
        centerSub: fmt(secRemaining) + " XP Left",
        centerHint: "To 99"
      }));
    }
  } else {
    rightCard.textContent = "No item";
  }
  main.appendChild(rightCard);
 
  // Milestones
  const msCard = el("section", "card full cardTotal");
  if (current) {
    msCard.appendChild(renderMilestoneBar(current.milestones, current.milestoneCurrent));
  }
  main.appendChild(msCard);
 
  return main;
}
 
// --- Footer ---
function renderFooter() {
  const footer = el("footer", "footer");
 
  // Tabs
  const tabs = el("div", "tabs");
  const categories = ["skills", "bosses", "activities", "total", "gim"];
  const labels = ["Skills", "Bosses", "Activities", "Total", "GIM"];
 
  categories.forEach(function (cat, i) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (state.category === cat ? " tabActive" : "");
    btn.textContent = labels[i];
    btn.onclick = function () { setCategory(cat); };
    tabs.appendChild(btn);
  });
  footer.appendChild(tabs);
 
  // Controls
  const controls = el("div", "controls");
  const filtered = getFiltered();
  const isSpecial = state.category === "total" || state.category === "gim";
 
  // Pin button
  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = "btn" + ((state.pinned || state.pinnedId) ? " btnPin" : "");
  pinBtn.textContent = (state.pinned || state.pinnedId) ? "Pinned" : "Pin";
  pinBtn.disabled = isSpecial;
  pinBtn.onclick = onTogglePin;
  controls.appendChild(pinBtn);
 
  // Prev
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = filtered.length === 0 || isSpecial;
  prevBtn.onclick = onPrev;
  controls.appendChild(prevBtn);
 
  // Next
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = filtered.length === 0 || isSpecial;
  nextBtn.onclick = onNext;
  controls.appendChild(nextBtn);
 
  // Player menu
  controls.appendChild(renderPlayerMenu());
 
  footer.appendChild(controls);
  return footer;
}
 
// ============================================================
// COMPONENT RENDERERS
// ============================================================
 
// --- Arc Gauge (SVG) ---
function renderArcGauge(opts) {
  const value = opts.value;
  const max = opts.max;
  const labelTop = opts.labelTop;
  const parts = opts.centerMainParts;
  const centerSub = opts.centerSub;
  const centerHint = opts.centerHint;
 
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
 
  const startAngle = (-210 * Math.PI) / 180;
  const endAngle = (30 * Math.PI) / 180;
  const sweep = endAngle - startAngle;
  const arcLen = r * sweep;
  const filledLen = (pct / 100) * arcLen;
 
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const d = "M " + start.x + " " + start.y + " A " + r + " " + r + " 0 1 1 " + end.x + " " + end.y;
 
  const x = cx;
  const yTop = cy - 40;
  const yLine = yTop + 15;
  const yBottom = yTop + 40;
  const ySub = yTop + 70;
  const yHint = yTop + 100;
 
  const wrapper = el("div", "gauge");
 
  const label = el("div", "gaugeTop");
  label.textContent = labelTop;
  wrapper.appendChild(label);
 
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("class", "gaugeSvg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", labelTop);
 
  // Track
  const track = document.createElementNS(ns, "path");
  track.setAttribute("d", d);
  track.setAttribute("class", "gaugeTrack");
  track.setAttribute("stroke-width", stroke);
  track.setAttribute("fill", "none");
  svg.appendChild(track);
 
  // Fill
  const fill = document.createElementNS(ns, "path");
  fill.setAttribute("d", d);
  fill.setAttribute("class", "gaugeFill");
  fill.setAttribute("stroke-width", stroke);
  fill.setAttribute("fill", "none");
  fill.style.strokeDasharray = filledLen + " " + Math.max(0, arcLen - filledLen);
  svg.appendChild(fill);
 
  // Text - fraction style
  if (parts) {
    const topText = createSvgText(ns, x, yTop, "gaugeTextMain", parts.top);
    svg.appendChild(topText);
 
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", x - 60);
    line.setAttribute("x2", x + 60);
    line.setAttribute("y1", yLine);
    line.setAttribute("y2", yLine);
    line.setAttribute("class", "gaugeFracLine");
    line.setAttribute("stroke-width", 2);
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
 
    const bottomText = createSvgText(ns, x, yBottom, "gaugeTextMain", parts.bottom);
    svg.appendChild(bottomText);
  }
 
  if (centerSub) {
    svg.appendChild(createSvgText(ns, x, ySub, "gaugeTextSub", centerSub));
  }
  if (centerHint) {
    svg.appendChild(createSvgText(ns, x, yHint, "gaugeTextHint", centerHint));
  }
 
  wrapper.appendChild(svg);
  return wrapper;
}
 
function polar(cx, cy, r, angleRad) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}
 
function createSvgText(ns, x, y, className, content) {
  const t = document.createElementNS(ns, "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("class", className);
  t.textContent = content;
  return t;
}
 
// --- Rank Badge ---
function renderRankBadge(labelTop, valueText) {
  const wrapper = el("div", "rankWrap");
 
  const label = el("div", "gaugeTop");
  label.textContent = labelTop;
  wrapper.appendChild(label);
 
  const circle = el("div", "rankCircle");
  const value = el("div", "rankValue");
  value.textContent = valueText;
  circle.appendChild(value);
  wrapper.appendChild(circle);
 
  const bottom = el("div", "gaugeBottom");
  const sub = el("div", "gaugeSub");
  sub.textContent = "Global rank";
  bottom.appendChild(sub);
  wrapper.appendChild(bottom);
 
  return wrapper;
}
 
// --- Milestone Bar ---
function renderMilestoneBar(milestones, current) {
  const wrapper = el("div", "milestones");
 
  const title = el("div", "milestoneTitle");
  title.textContent = "Overall Milestones";
  wrapper.appendChild(title);
 
  const row = el("div", "milestoneRow customScroll");
  const points = [0].concat(milestones);
 
  points.forEach(function (p, idx) {
    if (idx === 0) {
      const bubble = el("div", "bubble dim");
      bubble.textContent = p;
      row.appendChild(bubble);
      return;
    }
 
    const prev = points[idx - 1];
    const segPct = segmentFillPct(current, prev, p);
 
    const segWrap = el("div", "segWrap");
 
    const segTrack = el("div", "segTrack");
    const segFill = el("div", "segFill");
    segFill.style.width = segPct + "%";
    segTrack.appendChild(segFill);
    segWrap.appendChild(segTrack);
 
    const bubble = el("div", "bubble " + (current >= p ? "bright" : "dim"));
    bubble.textContent = p;
    segWrap.appendChild(bubble);
 
    row.appendChild(segWrap);
  });
 
  wrapper.appendChild(row);
  return wrapper;
}
 
// --- Total Grid ---
function renderTotalGrid() {
  const skillItems = getSkillItems();
  const byName = new Map(skillItems.map(function (s) { return [s.name, s]; }));
  const ordered = SKILL_GRID_ORDER
    .map(function (n) { return byName.get(n); })
    .filter(Boolean);
 
  const totalLevel = skillItems.reduce(function (sum, s) {
    return sum + (s.skillLevel || s.milestoneCurrent || 0);
  }, 0);
  const totalXp = skillItems.reduce(function (sum, s) {
    return sum + (s.skillXp || 0);
  }, 0);
 
  const wrap = el("div", "totalGridWrap");
  const grid = el("div", "totalGrid");
 
  ordered.forEach(function (s) {
    const lvl = s.skillLevel || s.milestoneCurrent || 0;
    const pct = Math.max(0, Math.min(1, (s.levelProgressPct || 0) / 100));
    const barColor = pctToColor(pct);
 
    const tile = el("div", "skillTile");
 
    const top = el("div", "skillTileTop");
    const icon = document.createElement("img");
    icon.className = "skillTileIcon";
    icon.src = s.iconUrl;
    icon.alt = s.name;
    top.appendChild(icon);
 
    const name = el("div", "skillTileName");
    name.textContent = s.name;
    top.appendChild(name);
 
    const level = el("div", "skillTileLevel");
    level.textContent = lvl;
    top.appendChild(level);
 
    tile.appendChild(top);
 
    const bar = el("div", "skillTileBar");
    const barFill = el("div", "skillTileBarFill");
    barFill.style.width = (pct * 100) + "%";
    barFill.style.backgroundColor = barColor;
    bar.appendChild(barFill);
    tile.appendChild(bar);
 
    grid.appendChild(tile);
  });
 
  wrap.appendChild(grid);
 
  // Footer
  const footer = el("div", "totalFooter");
 
  const statLevel = el("div", "totalFooterStat");
  const lblLevel = el("div", "totalFooterLabel");
  lblLevel.textContent = "Total level";
  statLevel.appendChild(lblLevel);
  const valLevel = el("div", "totalFooterValue");
  valLevel.textContent = totalLevel.toLocaleString();
  statLevel.appendChild(valLevel);
  footer.appendChild(statLevel);
 
  const statXp = el("div", "totalFooterStat");
  const lblXp = el("div", "totalFooterLabel");
  lblXp.textContent = "Total XP";
  statXp.appendChild(lblXp);
  const valXp = el("div", "totalFooterValue");
  valXp.textContent = totalXp.toLocaleString();
  statXp.appendChild(valXp);
  footer.appendChild(statXp);
 
  wrap.appendChild(footer);
  return wrap;
}
 
// --- GIM View ---
// Loads every member concurrently. Each member resolves to its own result so a
// single failure degrades one panel instead of the whole view - and never gets
// replaced with invented level-1 data.
function loadGimData() {
  if (gimAbortController) gimAbortController.abort();
  gimAbortController = new AbortController();

  state.gim.loading = true;
  render();

  const names = GIM_PLAYERS.map(function (slot) { return slot.name; });

  loadPlayers(names, gimAbortController.signal)
    .then(function (results) {
      state.gim.results = results;
      state.gim.loaded = true;
    })
    .catch(function (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") return;
      state.gim.results = [];
    })
    .finally(function () {
      state.gim.loading = false;
      render();
    });
}

function renderGimLayout() {
  if (state.gim.loading && !state.gim.loaded) {
    const msg = el("div", "gimLoading");
    msg.textContent = "Loading GIM\u2026";
    return msg;
  }

  const byName = new Map(state.gim.results.map(function (r) { return [r.player, r]; }));
  const layout = el("div", "gimLayout");

  GIM_PLAYERS.forEach(function (slot) {
    const slotDiv = el("div", "gimSlot " + slot.pos);
    slotDiv.appendChild(renderGimPanel(slot.name, byName.get(slot.name)));
    layout.appendChild(slotDiv);
  });

  return layout;
}

function renderGimPanel(name, result) {
  const panel = el("div", "gimPanel");

  const header = el("div", "gimPanelHeader");
  const nameEl = el("div", "gimPanelName");
  nameEl.textContent = name;
  header.appendChild(nameEl);

  if (result && result.stale) {
    const tag = el("div", "gimPanelTag");
    tag.textContent = "as of " + formatClock(result.fetchedAt);
    tag.title = result.error || "Showing cached data";
    header.appendChild(tag);
  }
  panel.appendChild(header);

  // No data at all: say so. Showing every skill at level 1 misrepresents a
  // teammate's account as a fresh one over what is usually a transient blip.
  if (!result || !result.data) {
    const err = el("div", "gimPanelError");
    err.textContent = result && result.error ? result.error : "No data";
    panel.appendChild(err);
    return panel;
  }

  const byName = new Map(
    result.data.skills.map(function (s) { return [s.name, s]; })
  );
  const allSkills = GIM_SKILL_ORDER.flat();

  const grid = el("div", "gimSkillsGrid");
  grid.style.setProperty("--gim-cols", "8");

  allSkills.forEach(function (skill) {
    const s = byName.get(skill);
    const level = Math.max(1, (s && s.level > 0 ? s.level : 1));
    const xp = s && s.xp > 0 ? s.xp : 0;

    const curLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(Math.min(126, level + 1));
    const inLevel = Math.max(0, xp - curLevelXp);
    const needed = Math.max(1, nextLevelXp - curLevelXp);
    const pct = clamp((inLevel / needed) * 100, 0, 100);

    const cell = el("div", "gimSkillCell");

    const top = el("div", "gimSkillTop");
    const icon = document.createElement("img");
    icon.className = "gimSkillIcon";
    icon.src = iconForSkill(skill);
    icon.alt = skill;
    top.appendChild(icon);

    const lvl = el("div", "gimSkillLvl");
    lvl.textContent = level;
    top.appendChild(lvl);
    cell.appendChild(top);

    const barTrack = el("div", "gimSkillBarTrack");
    const barFill = el("div", "gimSkillBarFill");
    barFill.style.width = pct + "%";
    barFill.style.background = pctToColor(pct / 100);
    barTrack.appendChild(barFill);
    cell.appendChild(barTrack);

    grid.appendChild(cell);
  });

  panel.appendChild(grid);

  const totals = skillTotals(result.data);
  const totalsRow = el("div", "gimTotals");

  const left = el("div", "gimTotalsLeft");
  left.appendChild(document.createTextNode("Total level: "));
  const leftVal = document.createElement("span");
  leftVal.textContent = totals.level.toLocaleString();
  left.appendChild(leftVal);
  totalsRow.appendChild(left);

  const right = el("div", "gimTotalsRight");
  right.appendChild(document.createTextNode("Total xp: "));
  const rightVal = document.createElement("span");
  rightVal.textContent = totals.xp.toLocaleString();
  right.appendChild(rightVal);
  totalsRow.appendChild(right);

  panel.appendChild(totalsRow);
  return panel;
}

// --- Picker Modal ---
function renderPickerModal() {
  const overlay = el("div", "modalOverlay");
  overlay.onmousedown = function (e) {
    if (e.target === overlay) onPickerClose();
  };
 
  const modal = el("div", "modal");
  modal.onmousedown = function (e) { e.stopPropagation(); };
 
  // Header
  const header = el("div", "modalHeader");
  const title = el("div", "modalTitle");
  const catName = state.category.charAt(0).toUpperCase() + state.category.slice(1);
  title.textContent = "Pick a " + catName;
  header.appendChild(title);
 
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn";
  closeBtn.textContent = "Close";
  closeBtn.onclick = onPickerClose;
  header.appendChild(closeBtn);
  modal.appendChild(header);
 
  // Search
  const input = document.createElement("input");
  input.className = "input";
  input.placeholder = "Search\u2026";
  input.oninput = function () {
    renderPickerGrid(grid, input.value);
  };
  modal.appendChild(input);
 
  // Grid
  const grid = el("div", "pickerGrid");
  renderPickerGrid(grid, "");
  modal.appendChild(grid);
 
  overlay.appendChild(modal);
  return overlay;
}
 
function renderPickerGrid(container, query) {
  container.innerHTML = "";
  const items = getPickerItems();
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter(function (x) { return x.name.toLowerCase().includes(q); }) : items;
 
  filtered.forEach(function (it) {
    const isPinned = state.pinnedId === it.id;
 
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pickerCell" + (isPinned ? " pickerCellPinned" : "");
    btn.title = it.name;
    btn.onclick = function () { onPickerSelect(it.id); };
 
    const icon = document.createElement("img");
    icon.className = "pickerIcon";
    icon.src = it.iconUrl;
    icon.alt = "";
    btn.appendChild(icon);
 
    const name = el("div", "pickerName");
    name.textContent = it.name;
    btn.appendChild(name);
 
    const pinRow = el("div", "pickerPinRow");
    const pinText = document.createElement("span");
    pinText.className = "pickerPinText";
    pinText.textContent = isPinned ? "Pinned" : "Pin";
    pinRow.appendChild(pinText);
 
    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "btn btnMini" + (isPinned ? " btnPin" : "");
    pinBtn.textContent = "\uD83D\uDCCC"; // 📌
    pinBtn.onclick = function (e) {
      e.stopPropagation();
      onPickerPin(it.id);
    };
    pinRow.appendChild(pinBtn);
    btn.appendChild(pinRow);
 
    container.appendChild(btn);
  });
}
 
// --- Player Menu ---
function renderPlayerMenu() {
  const wrapper = el("div", "playerMenu");
 
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn playerMenuBtn";
  btn.disabled = state.loading || state.refreshing;
  btn.title = "Select player";
 
  const valueSpan = document.createElement("span");
  valueSpan.className = "playerMenuValue";
  valueSpan.textContent = state.player;
  btn.appendChild(valueSpan);
 
  const chevron = document.createElement("span");
  chevron.className = "playerMenuChevron";
  chevron.textContent = "\u25BE"; // ▾
  btn.appendChild(chevron);
 
  btn.onclick = function () {
    const existing = wrapper.querySelector(".playerMenuPanel");
    if (existing) {
      existing.remove();
      chevron.classList.remove("open");
      return;
    }
    chevron.classList.add("open");
 
    const panel = el("div", "playerMenuPanel");
    panel.setAttribute("role", "listbox");
 
    PLAYER_OPTIONS.forEach(function (name) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "playerMenuItem" + (name === state.player ? " active" : "");
      item.textContent = name;
      item.setAttribute("role", "option");
      item.onclick = function () {
        onPlayerChange(name);
        panel.remove();
        chevron.classList.remove("open");
      };
      panel.appendChild(item);
    });
 
    wrapper.appendChild(panel);
  };
 
  wrapper.appendChild(btn);
  return wrapper;
}
 
// --- SVG Icons ---
function renderRefreshIcon(spinning) {
  const style = spinning ? ' style="animation: spin 1s linear infinite"' : '';
  return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"' + style + '>' +
    '<path d="M21 12a9 9 0 1 1-2.64-6.36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M21 3v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
}
 
function renderGridIcon() {
  return '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">' +
    '<rect x="2" y="2" width="5" height="5" rx="1"/>' +
    '<rect x="11" y="2" width="5" height="5" rx="1"/>' +
    '<rect x="2" y="11" width="5" height="5" rx="1"/>' +
    '<rect x="11" y="11" width="5" height="5" rx="1"/>' +
    '</svg>';
}
 
// --- Utility ---
function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}