// ============================================================
// Display formatting and asset paths.
// ============================================================

import { clamp } from "./osrs.js";
import { ICONLESS } from "./hiscore-data.js";

// Entries the sync tool found no committed icon for. Returning null instead of
// a path that 404s means the monogram renders on first paint, with no wasted
// request on every page load.
const ICONLESS_SET = new Set(ICONLESS);

// Non-negative, thousands-separated. Guards the many places that render a
// "remaining" figure which must never read as negative.
export function fmt(n) {
  return Math.max(0, Math.round(n)).toLocaleString();
}

export function formatCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "b";
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function formatRank(rank) {
  if (rank == null || rank < 0) return "Unranked";
  return "#" + rank.toLocaleString();
}

// Short local time for "as of HH:MM" staleness stamps.
export function formatClock(ts) {
  if (!ts) return "unknown";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Icon filenames are the display name lowercased with punctuation stripped:
// "Chambers of Xeric: Challenge Mode" -> "chambers-of-xeric-challenge-mode".
export function slug(name) {
  return name.toLowerCase().replace(/[:'()]/g, "").replace(/\s+/g, "-");
}

export function iconForSkill(name) {
  if (ICONLESS_SET.has(name)) return null;
  return "wwwroot/icons/skills/" + slug(name) + ".png";
}

export function iconForActivity(name) {
  if (ICONLESS_SET.has(name)) return null;
  return "wwwroot/icons/activities/" + slug(name) + ".png";
}

// Single red -> yellow -> green ramp. There used to be two of these taking
// different input scales (0-1 and 0-100), which is how they drifted apart.
export function progressColor(pct) {
  const p = clamp(pct, 0, 100);
  if (p <= 50) {
    const t = p / 50;
    return "rgb(255, " + Math.round(255 * t) + ", 0)";
  }
  const t = (p - 50) / 50;
  return "rgb(" + Math.round(255 * (1 - t)) + ", 255, 0)";
}