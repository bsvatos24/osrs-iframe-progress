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

import { skillTotals } from "./model.js";

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

// Record today's first observation for a player. Safe to call on every poll.
export function snapshot(player, hiscores) {
  if (!hiscores) return;
  const totals = skillTotals(hiscores);
  if (totals.xp <= 0) return; // never anchor a day on a failed/empty read

  const days = read(player);
  const today = dayKey();
  if (days[today]) return; // first observation of the day wins

  days[today] = { level: totals.level, xp: totals.xp };
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

// Gains for a player against their own stored history.
// `days: 0` compares against this morning's first observation.
export function gains(player, hiscores, daysBack) {
  if (!hiscores) return null;
  const stored = read(player);
  const current = skillTotals(hiscores);

  const from = daysBack === 0
    ? (stored[dayKey()] ? { key: dayKey(), entry: stored[dayKey()] } : null)
    : baseline(stored, daysBack);

  if (!from) return null;

  return {
    since: from.key,
    level: Math.max(0, current.level - from.entry.level),
    xp: Math.max(0, current.xp - from.entry.xp),
    exact: daysBack === 0 || from.key === dayKey(new Date(Date.now() - daysBack * 86400000))
  };
}

// How many distinct days of history exist for a player.
export function historyDepth(player) {
  return Object.keys(read(player)).length;
}
