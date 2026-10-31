// ============================================================
// XP gained, per skill, from a player's history. No DOM, no fetching.
//
// A "point" is { at: ms, skills: { Attack: xp, ... } }, xp null where
// unranked. A player's points are their Wise Old Man snapshots plus one more
// for the live hiscores read this page just made, so gains run right up to
// now even when WOM was last updated hours ago.
// ============================================================

import { rankedValue } from "./model.js";
import { levelForXp } from "./osrs.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Events below this much XP in a skill in a day stay out of the feed.
export const FEED_MIN_XP = 25000;

export const PERIODS = {
  today: { label: "Today", since: function (now) { return startOfDay(now); } },
  week: { label: "7 days", since: function (now) { return now - 7 * DAY_MS; } }
};

export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// The live hiscores payload as a point.
export function livePoint(data, at) {
  const skills = {};
  ((data && data.skills) || []).forEach(function (s) {
    if (s.name === "Overall") return;
    skills[s.name] = typeof s.xp === "number" && s.xp >= 0 ? rankedValue(s.xp) : null;
  });
  return { at: at, skills: skills };
}

// History points plus the live one, oldest first. The live point is only
// added when it is newer than the last snapshot.
export function timeline(points, live) {
  const list = (points || []).slice();
  if (live && (!list.length || live.at > list[list.length - 1].at)) list.push(live);
  return list;
}

// The newest point at or before `ms`, or null.
function pointAt(points, ms) {
  let found = null;
  for (const p of points) {
    if (p.at <= ms) found = p;
    else break;
  }
  return found;
}

// XP gained between two points, over skills ranked at both - the same rule
// skillGains uses, so the daily chart and the skill list always agree.
function xpBetween(a, b) {
  return Object.keys(b.skills).reduce(function (acc, k) {
    const was = a.skills[k];
    const now = b.skills[k];
    return was == null || now == null || now <= was ? acc : acc + now - was;
  }, 0);
}

// XP gained in each skill since `since`, biggest first:
//   { from, partial, total, skills: [{ name, xp, fromLevel, toLevel }] }
// `from` is when the measurement actually starts. When history does not
// reach back to `since`, it starts at the oldest point instead and `partial`
// says so, rather than passing a shorter window off as the full one.
export function skillGains(points, since) {
  const empty = { from: since, partial: false, total: 0, skills: [] };
  if (!points || points.length < 2) {
    return points && points.length ? Object.assign(empty, { from: points[0].at, partial: points[0].at > since }) : empty;
  }

  const base = pointAt(points, since) || points[0];
  const end = points[points.length - 1];
  const skills = [];

  Object.keys(end.skills).forEach(function (name) {
    const now = end.skills[name];
    const was = base.skills[name];
    // Unranked at either end means the real XP is unknown (below the
    // hiscores' cutoff, not zero), so there is no honest gain to show.
    if (now == null || was == null) return;
    const gained = now - was;
    if (gained <= 0) return;
    skills.push({
      name: name,
      xp: gained,
      fromLevel: levelForXp(was),
      toLevel: levelForXp(now)
    });
  });

  skills.sort(function (a, b) { return b.xp - a.xp || a.name.localeCompare(b.name); });
  return {
    from: base.at,
    partial: base.at > since,
    total: skills.reduce(function (acc, s) { return acc + s.xp; }, 0),
    skills: skills
  };
}

// Total XP gained on each of the last `days` local days, oldest first:
// [{ day: ms of local midnight, xp }]. xp is null for a day the history
// does not cover.
export function dailyXp(points, now, days) {
  const out = [];
  const today = startOfDay(now);
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const start = dayStart.getTime();
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const before = pointAt(points, start);
    const after = pointAt(points, nextDay.getTime() - 1);
    out.push({
      day: start,
      xp: before && after ? xpBetween(before, after) : null
    });
  }
  return out;
}

// Level-ups, 200M, and big XP days for one player since `since`, newest
// first: [{ type: "level" | "200m" | "xp", player, skill, level?, xp?, at }].
// Times are when the change was first seen - the snapshot after it - which
// can be later than when it happened.
export function events(player, points, since) {
  const out = [];
  const daily = new Map(); // "day|skill" -> { xp, at }

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.at < since) continue;

    Object.keys(b.skills).forEach(function (skill) {
      const now = b.skills[skill];
      const was = a.skills[skill];
      if (now == null || was == null || now <= was) return;

      const fromLevel = levelForXp(was);
      const toLevel = levelForXp(now);
      if (toLevel > fromLevel) {
        out.push({ type: "level", player: player, skill: skill, level: toLevel, from: fromLevel, at: b.at });
      }
      if (was < 200000000 && now >= 200000000) {
        out.push({ type: "200m", player: player, skill: skill, at: b.at });
      }

      const key = startOfDay(b.at) + "|" + skill;
      const acc = daily.get(key) || { xp: 0, at: b.at };
      acc.xp += now - was;
      acc.at = Math.max(acc.at, b.at);
      daily.set(key, acc);
    });
  }

  daily.forEach(function (acc, key) {
    if (acc.xp < FEED_MIN_XP) return;
    out.push({ type: "xp", player: player, skill: key.split("|")[1], xp: acc.xp, at: acc.at });
  });

  // Newest first; at the same moment, the milestone before the XP behind it.
  const rank = { "200m": 0, level: 1, xp: 2 };
  return out.sort(function (x, y) { return y.at - x.at || rank[x.type] - rank[y.type]; });
}
