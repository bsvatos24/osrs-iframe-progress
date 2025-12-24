import type { DisplayItem } from "../lib/types";
import { DEFAULT_KILL_MILESTONES, SKILL_LEVEL_MILESTONES, nextMilestone } from "../lib/milestones";

function pct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export function buildMockItems(): DisplayItem[] {
  // Skills example: pretend "primary" is XP progress to next level, "secondary" is XP to 99
  const skills: DisplayItem[] = [
    makeSkill("attack", "Attack", 73, 1550000, 1700000, 1550000, 13000000),
    makeSkill("strength", "Strength", 81, 3200000, 3500000, 3200000, 13000000),
    makeSkill("magic", "Magic", 92, 6800000, 7000000, 6800000, 13000000)
  ];

  // Bosses
  const bosses: DisplayItem[] = [
    makeBoss("zulrah", "Zulrah", 412, 12890),
    makeBoss("vorkath", "Vorkath", 126, 54000)
  ];

  // Activities
  const activities: DisplayItem[] = [
    makeActivity("clues_all", "Clue Scrolls (All)", 238, 9000),
    makeActivity("barbarian_assault", "Barbarian Assault (High Gambles)", 44, 12000)
  ];

  return [...skills, ...bosses, ...activities];
}

function makeSkill(
  slug: string,
  name: string,
  level: number,
  currentXp: number,
  nextLevelXp: number,
  totalXp: number,
  xpFor99: number
): DisplayItem {
  const segmentXp = Math.max(1, nextLevelXp - (nextLevelXp - (nextLevelXp - currentXp))); // placeholder-safe
  const primaryTarget = Math.max(currentXp, nextLevelXp);
  const primaryP = pct(currentXp, primaryTarget);

  const secondaryTarget = xpFor99;
  const secondaryP = pct(totalXp, secondaryTarget);

  return {
    id: `skill:${slug}`,
    category: "skills",
    name,
    iconUrl: `https://wiseoldman.net/img/metrics/${slug}.png`,

    primaryCurrent: currentXp,
    primaryTarget: primaryTarget,
    primaryLabelTop: `${primaryP}% Complete`,
    primaryLabelBottom: "XP to next level",

    secondaryType: "gauge",
    secondaryCurrent: totalXp,
    secondaryTarget: secondaryTarget,
    secondaryLabelTop: `Level ${level} / 99`,
    secondaryLabelBottom: `${secondaryP}% to 99`,

    milestones: SKILL_LEVEL_MILESTONES,
    milestoneCurrent: level,
    milestoneUnit: "level"
  };
}

function makeBoss(slug: string, name: string, kills: number, rank: number): DisplayItem {
  const milestones = DEFAULT_KILL_MILESTONES;
  const next = nextMilestone(kills, milestones);
  const primaryP = pct(kills, next);

  return {
    id: `boss:${slug}`,
    category: "bosses",
    name,
    iconUrl: `https://wiseoldman.net/img/metrics/${slug}.png`,

    primaryCurrent: kills,
    primaryTarget: next,
    primaryLabelTop: `${primaryP}% Complete`,
    primaryLabelBottom: `Kills to ${next}`,

    secondaryType: "rank",
    secondaryLabelTop: "Rank",
    secondaryLabelBottom: rank.toLocaleString(),

    milestones,
    milestoneCurrent: kills,
    milestoneUnit: "kills"
  };
}

function makeActivity(slug: string, name: string, score: number, rank: number): DisplayItem {
  const milestones = DEFAULT_KILL_MILESTONES;
  const next = nextMilestone(score, milestones);
  const primaryP = pct(score, next);

  return {
    id: `activity:${slug}`,
    category: "activities",
    name,
    iconUrl: `https://wiseoldman.net/img/metrics/${slug}.png`,

    primaryCurrent: score,
    primaryTarget: next,
    primaryLabelTop: `${primaryP}% Complete`,
    primaryLabelBottom: `To ${next}`,

    secondaryType: "rank",
    secondaryLabelTop: "Rank",
    secondaryLabelBottom: rank.toLocaleString(),

    milestones,
    milestoneCurrent: score,
    milestoneUnit: "kills"
  };
}
