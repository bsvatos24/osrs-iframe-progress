// ============================================================
// Local progress snapshots.
//
// The hiscores are point-in-time only: they say what you have, never what you
// gained. Storing one snapshot per player per day turns the dashboard from a
// status board into a progress board without a new data source.
//
// The FIRST observation of each day is kept and never overwritten - that is
// what makes "gained today" mean anything. Overwriting on every poll would
// leave the delta permanently at zero.
//
// Deliberately behind a narrow interface (snapshot/gains) so it can be swapped
// for Wise Old Man's server-side history later without touching the views.
// ============================================================

import { activityTotals, skillTotals } from "./model.js";

const KEY_PREFIX = "osrsgim.history.";
const KEEP_DAYS = 21;

function storageKey(player) {
  return KEY_PREFIX + String(player).toLowerCase();
}

// Local calendar date, not UTC: "today" should mean the user's today.
export function dayKey(date) {
  const d = date || new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

function read(player) {
  try {
    const raw = localStorage.getItem(storageKey(player));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function write(player, days) {
  try {
    localStorage.setItem(storageKey(player), JSON.stringify(days));
  } catch (e) {
    // Storage full or disabled. History is a bonus, never a requirement.
  }
}

function prune(days) {
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) {
    delete days[keys.shift()];
  }
  return days;
}

// The numbers a snapshot tracks. Adding a key here makes it available to
// gains() automatically; older stored snapshots simply lack it and report null
// rather than a bogus zero.
function metricsOf(hiscores) {
  const totals = skillTotals(hiscores);
  const acts = activityTotals(hiscores);
  return {
    level: totals.level,
    xp: totals.xp,
    kc: acts.bossKc,
    clues: acts.clues,
    activity: acts.activityScore
  };
}

// Record today's first observation for a player. Safe to call on every poll.
export function snapshot(player, hiscores) {
  if (!hiscores) return;
  const metrics = metricsOf(hiscores);
  if (metrics.xp <= 0) return; // never anchor a day on a failed/empty read

  const days = read(player);
  const today = dayKey();
  if (days[today]) return; // first observation of the day wins

  days[today] = metrics;
  write(player, prune(days));
}

// The oldest snapshot at least `daysBack` days old, or the oldest we have.
// Falling back to the oldest means a fresh install reports real (if shorter)
// history rather than nothing at all.
function baseline(days, daysBack) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffKey = dayKey(cutoff);

  const keys = Object.keys(days).sort();
  if (keys.length === 0) return null;

  let chosen = null;
  for (const key of keys) {
    if (key <= cutoffKey) chosen = key;
  }
  // Nothing old enough: use the earliest we have.
  const useKey = chosen || keys[0];
  return { key: useKey, entry: days[useKey] };
}

// Gains for a player against their own stored history, for every tracked
// metric. `daysBack: 0` compares against this morning's first observation.
// A metric missing from the stored snapshot comes back null, so the UI can say
// "no baseline" instead of claiming zero progress.
export function gains(player, hiscores, daysBack) {
  if (!hiscores) return null;
  const stored = read(player);
  const current = metricsOf(hiscores);

  const from = daysBack === 0
    ? (stored[dayKey()] ? { key: dayKey(), entry: stored[dayKey()] } : null)
    : baseline(stored, daysBack);

  if (!from) return null;

  const deltas = { since: from.key };
  Object.keys(current).forEach(function (key) {
    const was = from.entry[key];
    deltas[key] = typeof was === "number" ? Math.max(0, current[key] - was) : null;
  });
  return deltas;
}

// How many distinct days of history exist for a player.
export function historyDepth(player) {
  return Object.keys(read(player)).length;
}
