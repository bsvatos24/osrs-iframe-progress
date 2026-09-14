// ============================================================
// Runtime configuration.
//
// Every option is settable from the query string, which is what lets a single
// deploy drive several different Edge widget slots plus the shared team page
// without a code change per slot.
//
//   ?player=BenjiFresh91     starting player
//   &players=a,b,c           override the roster (defaults to TEAM)
//   &view=skills|bosses|activities|total|gim
//   &item=slayer             open pinned to one skill/boss
//   &cycle=8                 seconds per auto-cycle step (0 = off)
//   &refresh=300             seconds between hiscore polls (0 = off)
//   &mode=kiosk|web
//   &chrome=0|1              hide all controls (pure display widget)
//   &bucket=xl|l|m|tall      force a layout bucket (debugging/override)
//   &gim=panels|cycle|summary
//   &all=1                   include bosses/activities with no kills
//   &theme=ef50e7            accent colour, hex without the hash
// ============================================================

import { DEFAULT_PLAYER, PLAYER_OPTIONS } from "./constants.js";

const params = new URLSearchParams(window.location.search);
const MODE_KEY = "osrsgim.mode";
const VIEWS = new Set(["skills", "bosses", "activities", "total", "gim", "team"]);
const BUCKETS = new Set(["xl", "l", "m", "tall"]);
const GIM_STYLES = new Set(["panels", "cycle", "summary"]);

function str(key) {
  const v = params.get(key);
  return v == null || v === "" ? null : v;
}

function seconds(key, fallbackSec, maxSec) {
  const raw = str(key);
  if (raw == null) return fallbackSec * 1000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallbackSec * 1000;
  if (n === 0) return 0; // explicit "off"
  return Math.min(Math.max(n, 1), maxSec) * 1000;
}

function flag(key, fallback) {
  const raw = str(key);
  if (raw == null) return fallback;
  return !(raw === "0" || raw.toLowerCase() === "false");
}

function oneOf(key, allowed) {
  const raw = str(key);
  if (raw == null) return null;
  const v = raw.toLowerCase();
  return allowed.has(v) ? v : null;
}

// Explicit parameter wins, then a remembered choice, then detection. Being in
// an iframe is a good signal for kiosk but never the only one - the override
// is what makes kiosk mode debuggable in a normal browser tab.
function resolveMode() {
  const explicit = oneOf("mode", new Set(["kiosk", "web"]));
  if (explicit) return explicit;

  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "kiosk" || stored === "web") return stored;
  } catch (e) { /* storage disabled */ }

  return window.self !== window.top ? "kiosk" : "web";
}

export function rememberMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* ignore */ }
}

function resolvePlayers() {
  const raw = str("players");
  if (!raw) return PLAYER_OPTIONS.slice();
  const names = raw.split(",").map(function (n) { return n.trim(); }).filter(Boolean);
  return names.length ? names : PLAYER_OPTIONS.slice();
}

function resolveAccent() {
  const raw = str("theme");
  if (!raw) return null;
  const hex = raw.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16)
  ].join(" ");
}

const mode = resolveMode();
const kiosk = mode === "kiosk";
const players = resolvePlayers();
const requestedPlayer = str("player");

export const config = {
  mode: mode,
  kiosk: kiosk,

  players: players,
  player: requestedPlayer && players.includes(requestedPlayer)
    ? requestedPlayer
    : (players.includes(DEFAULT_PLAYER) ? DEFAULT_PLAYER : players[0]),

  view: oneOf("view", VIEWS) || "skills",

  // Slug of a single skill/boss to lock onto, e.g. ?item=slayer. Resolved to
  // an id once data arrives, since ids come from the hiscores payload.
  itemSlug: str("item") ? str("item").toLowerCase() : null,

  // Ambient displays should cycle; someone actively browsing should not have
  // the view moving under them.
  cycleMs: seconds("cycle", kiosk ? 6 : 0, 600),
  refreshMs: seconds("refresh", kiosk ? 300 : 600, 86400),

  chrome: flag("chrome", true),

  // The hiscores list ~68 bosses whether or not you have ever killed them. At
  // 6s each that is a seven-minute loop of mostly empty gauges, so entries
  // with no kills are hidden unless asked for.
  showUnkilled: flag("all", false),

  bucketOverride: oneOf("bucket", BUCKETS),
  gimStyle: oneOf("gim", GIM_STYLES),
  accentRgb: resolveAccent()
};

export function applyConfigToDocument() {
  const root = document.documentElement;
  root.dataset.mode = config.mode;
  root.dataset.chrome = config.chrome ? "on" : "off";
  if (config.accentRgb) root.style.setProperty("--accent-rgb", config.accentRgb);
}
