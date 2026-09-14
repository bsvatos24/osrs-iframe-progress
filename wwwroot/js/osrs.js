// ============================================================
// Old School RuneScape game maths. No DOM, no formatting.
// ============================================================

export const MAX_SKILL_LEVEL = 99;
export const MAX_VIRTUAL_LEVEL = 126;
export const MAX_SKILL_XP = 200000000;

// Cumulative XP required to reach each level, built once at module load.
// This was previously an O(level) loop re-run on every single call - for every
// skill, on every render, and 120 times per GIM load.
const XP_TABLE = (function buildXpTable() {
  const table = new Float64Array(MAX_VIRTUAL_LEVEL + 1);
  let points = 0;
  table[1] = 0;
  for (let level = 1; level < MAX_VIRTUAL_LEVEL; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
})();

export function xpForLevel(level) {
  const lvl = Math.max(1, Math.min(MAX_VIRTUAL_LEVEL, Math.floor(level)));
  return XP_TABLE[lvl];
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Progress within the current level: { inLevel, needed, pct }.
export function levelProgress(level, xp) {
  const curLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(Math.min(MAX_VIRTUAL_LEVEL, level + 1));
  const inLevel = Math.max(0, xp - curLevelXp);
  const needed = Math.max(1, nextLevelXp - curLevelXp);
  return { inLevel: inLevel, needed: needed, pct: clamp((inLevel / needed) * 100, 0, 100) };
}

// --- Milestones ---

export const SKILL_MILESTONES = [70, 80, 90, 99];
export const KC_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];

// The next milestone above `current`, or null when they are all behind you.
// Returning null rather than the last milestone is what lets callers show a
// real "maxed" state instead of "Next Milestone: 99" with 0 remaining forever.
export function nextMilestone(current, milestones) {
  for (const m of milestones) {
    if (current < m) return m;
  }
  return null;
}

export function prevMilestone(current, milestones) {
  let prev = 0;
  for (const m of milestones) {
    if (m <= current) prev = m;
    else break;
  }
  return prev;
}

export function segmentFillPct(current, from, to) {
  if (to <= from) return 0;
  if (current <= from) return 0;
  if (current >= to) return 100;
  return clamp(((current - from) / (to - from)) * 100, 0, 100);
}
