// ============================================================
// Hiscores payload -> uniform display items.
//
// One item shape serves the Skills, Bosses and Activities views so a single
// renderer covers all three: a primary gauge, a secondary gauge or rank badge,
// and milestone metadata.
// ============================================================

import { BOSS_NAMES, NON_COUNT_ACTIVITIES } from "./constants.js";
import {
  clamp, levelProgress, nextMilestone, xpForLevel,
  MAX_SKILL_LEVEL, MAX_SKILL_XP, SKILL_MILESTONES, KC_MILESTONES
} from "./osrs.js";
import { iconForActivity, iconForSkill } from "./format.js";

// The hiscores use -1 for "not ranked". Left raw it corrupts arithmetic:
// unranked skills subtract XP from totals, and `score || 0` does not catch -1
// because -1 is truthy. Normalise once, here, at the boundary.
export function rankedValue(n) {
  return typeof n === "number" && n > 0 ? n : 0;
}

export function isRanked(rank) {
  return typeof rank === "number" && rank > 0;
}

function mapSkill(s) {
  const level = Math.max(1, rankedValue(s.level) || 1);
  const xp = rankedValue(s.xp);
  const maxed = level >= MAX_SKILL_LEVEL;
  const progress = levelProgress(level, xp);
  const xp99 = xpForLevel(MAX_SKILL_LEVEL);

  // A 99'd skill has no next level, so both gauges retarget onto the only
  // goal left: 200m XP. Previously it read "Next Milestone: 99", 0 remaining,
  // with the primary gauge measuring progress toward a level 100 that does
  // not exist.
  const primary = maxed
    ? {
        primaryCurrent: xp,
        primaryTarget: MAX_SKILL_XP,
        primaryLabelTop: ((xp / MAX_SKILL_XP) * 100).toFixed(1) + "% of 200m",
        primaryUnit: "xp-200m"
      }
    : {
        primaryCurrent: progress.inLevel,
        primaryTarget: progress.needed,
        primaryLabelTop: progress.pct.toFixed(0) + "% Complete",
        primaryUnit: "xp-level"
      };

  const secondary = maxed
    ? {
        secondaryType: "gauge",
        secondaryCurrent: xp,
        secondaryTarget: MAX_SKILL_XP,
        secondaryLabelTop: "XP to 200m",
        secondaryUnit: "xp-200m"
      }
    : {
        secondaryType: "gauge",
        secondaryCurrent: xp,
        secondaryTarget: xp99,
        secondaryLabelTop: clamp((xp / xp99) * 100, 0, 100).toFixed(0) + "% to 99",
        secondaryUnit: "xp-99"
      };

  return Object.assign({
    id: "skill-" + s.id,
    category: "skills",
    name: s.name,
    iconUrl: iconForSkill(s.name),
    ranked: isRanked(s.rank),
    rank: rankedValue(s.rank),
    maxed: maxed,
    milestones: SKILL_MILESTONES,
    milestoneCurrent: level,
    milestoneUnit: "level",
    skillLevel: level,
    skillXp: xp,
    levelProgressPct: progress.pct
  }, primary, secondary);
}

function mapActivity(a) {
  const kills = rankedValue(a.score);
  const next = nextMilestone(kills, KC_MILESTONES);

  return {
    id: "act-" + a.id,
    category: BOSS_NAMES.has(a.name) ? "bosses" : "activities",
    name: a.name,
    iconUrl: iconForActivity(a.name),
    ranked: isRanked(a.rank),
    rank: rankedValue(a.rank),
    kills: kills,
    maxedMilestones: next === null,
    // The gauge reads "count / next milestone". It used to show kills since
    // the previous milestone over the width of that step (37 KC read as
    // "12 / 25"), so the player's actual count appeared nowhere on screen -
    // and past the last milestone it read "1 / 1". Progress within the step
    // is still shown by the milestone bar underneath.
    primaryCurrent: kills,
    primaryTarget: next === null ? kills : next,
    primaryLabelTop: next === null
      ? kills.toLocaleString() + " KC"
      : "Next Milestone: " + next.toLocaleString(),
    primaryUnit: "kills",
    secondaryType: "rank",
    secondaryLabelTop: "Rank",
    secondaryCurrent: isRanked(a.rank) ? a.rank : -1,
    milestones: KC_MILESTONES,
    milestoneCurrent: kills,
    milestoneUnit: "kills"
  };
}

export function mapHiscoresToDisplayItems(data) {
  if (!data || !Array.isArray(data.skills)) return [];

  const skills = data.skills
    .filter(function (s) { return s.name !== "Overall"; })
    .map(mapSkill);

  const activities = (data.activities || []).map(mapActivity);

  return skills
    .concat(activities.filter(function (i) { return i.category === "bosses"; }))
    .concat(activities.filter(function (i) { return i.category === "activities"; }));
}

// Skill totals for a raw hiscores payload. Used by the Total and GIM views,
// which need totals for players that are not the selected one.
export function skillTotals(data) {
  const skills = ((data && data.skills) || []).filter(function (s) {
    return s.name !== "Overall";
  });
  return skills.reduce(function (acc, s) {
    acc.level += Math.max(1, rankedValue(s.level) || 1);
    acc.xp += rankedValue(s.xp);
    return acc;
  }, { level: 0, xp: 0 });
}

// Boss and activity aggregates for a raw hiscores payload. Used by the Team
// view, which needs them for every member, and by the history snapshots.
export function activityTotals(data) {
  const rows = (data && data.activities) || [];

  let bossKc = 0;
  let uniqueBosses = 0;
  let activityScore = 0;
  let clues = 0;
  let collections = 0;

  for (const row of rows) {
    const score = rankedValue(row.score);
    const isBoss = BOSS_NAMES.has(row.name);

    if (isBoss) {
      bossKc += score;
      if (score > 0) uniqueBosses += 1;
      continue;
    }

    if (row.name === "Clue Scrolls (all)") clues = score;
    if (row.name === "Collections Logged") collections = score;

    // Ranks and points balances are not counts; adding them to a total would
    // produce a number that means nothing.
    if (!NON_COUNT_ACTIVITIES.has(row.name)) activityScore += score;
  }

  return {
    bossKc: bossKc,
    uniqueBosses: uniqueBosses,
    activityScore: activityScore,
    clues: clues,
    collections: collections
  };
}

// Flat per-entry list for the Team view's ranked side panels.
export function activityEntries(data, kind) {
  const rows = (data && data.activities) || [];
  return rows
    .filter(function (row) {
      const isBoss = BOSS_NAMES.has(row.name);
      if (kind === "bosses") return isBoss;
      return !isBoss && !NON_COUNT_ACTIVITIES.has(row.name);
    })
    .map(function (row) {
      return { name: row.name, score: rankedValue(row.score), isBoss: BOSS_NAMES.has(row.name) };
    })
    .filter(function (row) { return row.score > 0; });
}