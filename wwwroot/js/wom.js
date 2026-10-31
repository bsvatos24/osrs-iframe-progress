// ============================================================
// Wise Old Man: shared XP history for the web app's gains views.
//
// The hiscores only say what a player has now. Wise Old Man (wiseoldman.net)
// stores a snapshot every time a player is updated, on its servers, so every
// viewer sees the same history from day one - unlike history.js, which only
// knows the days this browser had the page open.
//
// WOM only records a player when something asks it to. This module asks:
// a player WOM has not seen is tracked, and one whose newest snapshot is
// older than STALE_MS is updated, fire-and-forget. The views never wait on
// that; they measure up to the live hiscores numbers instead.
//
// Limits (from WOM's server source): 20 requests a minute and 500 an hour
// per IP without an API key, and one update per player per 60 seconds. A
// load here is at most two requests per player, throttled by the caller.
// ============================================================

import { SKILL_NAMES } from "./hiscore-data.js";

export const WOM_API = "https://api.wiseoldman.net/v2";
export const WOM_SITE = "https://wiseoldman.net";

const HISTORY_DAYS = 14;
const SNAPSHOT_LIMIT = 200; // WOM's maximum page size
const STALE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 10000;

// WOM keys skills by lowercase name, except that Runecraft is "runecrafting".
const SKILL_KEYS = SKILL_NAMES.map(function (name) {
  return { name: name, key: name === "Runecraft" ? "runecrafting" : name.toLowerCase() };
});

export function womProfileUrl(player) {
  return WOM_SITE + "/players/" + encodeURIComponent(player);
}

function request(method, path, signal) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  const onAbort = function () { controller.abort(); };
  if (signal) signal.addEventListener("abort", onAbort, { once: true });

  return fetch(WOM_API + path, { method: method, signal: controller.signal })
    .finally(function () {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    });
}

// Ask WOM to fetch a player's current hiscores. Never throws: a rate limit
// or an outage just means this snapshot is skipped.
function requestUpdate(player) {
  return request("POST", "/players/" + encodeURIComponent(player)).catch(function () {});
}

// A WOM snapshot reduced to what the gains views use: when, and each skill's
// XP by display name (null where unranked).
function toPoint(snapshot) {
  const skills = {};
  const data = (snapshot.data && snapshot.data.skills) || {};
  SKILL_KEYS.forEach(function (s) {
    const xp = data[s.key] && data[s.key].experience;
    skills[s.name] = typeof xp === "number" && xp >= 0 ? xp : null;
  });
  return { at: Date.parse(snapshot.createdAt), skills: skills };
}

// One player's recent history, oldest first:
//   { status: "ok", points: [{ at, skills }] }
//   { status: "untracked", points: [] }   WOM had never seen them; now asked
//   { status: "error", points: [], error }
export async function loadHistory(player, signal) {
  const end = new Date();
  const start = new Date(end.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const path = "/players/" + encodeURIComponent(player) + "/snapshots"
    + "?startDate=" + encodeURIComponent(start.toISOString())
    + "&endDate=" + encodeURIComponent(end.toISOString())
    + "&limit=" + SNAPSHOT_LIMIT;

  let res;
  try {
    res = await request("GET", path, signal);
  } catch (err) {
    if (signal && signal.aborted) throw err;
    return { status: "error", points: [], error: "Couldn't reach Wise Old Man" };
  }

  if (res.status === 404) {
    requestUpdate(player);
    return { status: "untracked", points: [] };
  }
  if (!res.ok) {
    return { status: "error", points: [], error: res.status === 429
      ? "Wise Old Man is rate limiting this connection"
      : "Wise Old Man returned " + res.status };
  }

  const snapshots = await res.json();
  // WOM returns newest first.
  const points = (Array.isArray(snapshots) ? snapshots : []).map(toPoint)
    .filter(function (p) { return Number.isFinite(p.at); })
    .sort(function (a, b) { return a.at - b.at; });

  const newest = points.length ? points[points.length - 1].at : 0;
  if (Date.now() - newest > STALE_MS) requestUpdate(player);

  return { status: "ok", points: points };
}

export function loadHistories(players, signal) {
  return Promise.all(players.map(function (p) {
    return loadHistory(p, signal).catch(function (err) {
      if (signal && signal.aborted) throw err;
      return { status: "error", points: [], error: "Couldn't load history" };
    });
  }));
}