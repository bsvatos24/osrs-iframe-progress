// ============================================================
// Application state and render scheduling.
//
// Renders are batched into a single animation frame and scoped to the regions
// that actually changed. The previous implementation tore down and rebuilt
// every node in the app on each action and on each 6-second cycle tick, which
// destroyed focus, scroll position and any in-flight CSS transition.
// ============================================================

import { DEFAULT_PLAYER } from "./constants.js";

export const state = {
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

  // Freshness of the selected player's data, so the UI can admit to being
  // stale rather than presenting hours-old numbers as live.
  fetchedAt: null,
  stale: false,

  // Which metric the Team view ranks by: skills, bosses or activities.
  teamMetric: "skills",

  // GIM results live here, not in the DOM. Any render used to replace the GIM
  // panels with a placeholder that nothing resolved.
  gim: { results: [], loading: false, loaded: false, cycleIndex: 0 }
};

export const REGIONS = ["header", "main", "footer", "overlay"];
const ALL = new Set(REGIONS);

let painter = null;
let frame = null;
const pending = new Set();

export function setPainter(fn) {
  painter = fn;
}

// Mark regions dirty. `invalidate()` with no argument repaints everything.
export function invalidate(...regions) {
  if (regions.length === 0) ALL.forEach(function (r) { pending.add(r); });
  else regions.forEach(function (r) { pending.add(r); });

  if (frame != null) return;
  frame = requestAnimationFrame(function () {
    frame = null;
    const dirty = new Set(pending);
    pending.clear();
    if (painter) painter(dirty);
  });
}

// Force a synchronous repaint. Only for first paint, where waiting a frame
// would show an empty page.
export function flush() {
  if (frame != null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
  const dirty = pending.size ? new Set(pending) : new Set(ALL);
  pending.clear();
  if (painter) painter(dirty);
}
