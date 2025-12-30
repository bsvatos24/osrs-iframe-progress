import type { DisplayItem } from "./types";
import type { HiscoresResponse } from "./hiscoresApi";
import { BOSS_NAMES } from "../data/bossNames";
import { formatCompact, xpForLevel, clamp, nextMilestone } from "./osrsXp";

const SKILL_MILESTONES = [70, 80, 90, 99];
const KC_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];

function iconForSkill(name: string) {
  return `${import.meta.env.BASE_URL}icons/skills/${slug(name)}.png`;
}

function iconForActivity(name: string) {
  return `${import.meta.env.BASE_URL}icons/activities/${slug(name)}.png`;
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[:'()]/g, "")
    .replace(/\s+/g, "-");
}

export function mapHiscoresToDisplayItems(data: HiscoresResponse): DisplayItem[] {
  const skills: DisplayItem[] = data.skills
    .filter((s) => s.name !== "Overall")
    .map((s) => {
      const currentLevel = s.level;
      const currentXp = s.xp;

      const curLevelXp = xpForLevel(currentLevel);
      const nextLevelXp = xpForLevel(Math.min(126, currentLevel + 1));

      const inLevel = Math.max(0, currentXp - curLevelXp);
      const needed = Math.max(1, nextLevelXp - curLevelXp);

      const pct = clamp((inLevel / needed) * 100, 0, 100);

      const xp99 = xpForLevel(99);
      const pct99 = clamp((currentXp / xp99) * 100, 0, 100);

      return {
        id: `skill-${s.id}`,
        category: "skills",
        name: s.name,
        iconUrl: iconForSkill(s.name),

        // Primary: progress within current level
        primaryCurrent: inLevel,
        primaryTarget: needed,
        primaryLabelTop: `${pct.toFixed(0)}% Complete`,
        primaryLabelBottom: `${formatCompact(inLevel)} / ${formatCompact(needed)}`,

        // Secondary: progress to 99
        secondaryType: "gauge",
        secondaryCurrent: currentXp,
        secondaryTarget: xp99,
        // ✅ label becomes "##% to 99"
        secondaryLabelTop: `${pct99.toFixed(0)}% to 99`,
        secondaryLabelBottom: `${formatCompact(currentXp)} / ${formatCompact(xp99)} XP`,

        milestones: SKILL_MILESTONES,
        milestoneCurrent: currentLevel,
        milestoneUnit: "level",

        // ✅ For Total tab
        skillLevel: currentLevel,
        skillXp: currentXp,
        levelProgressPct: pct
      };
    });

  const bosses: DisplayItem[] = [];
  const activities: DisplayItem[] = [];

  for (const a of data.activities) {
    const kills = a.score ?? 0;
    const ms = KC_MILESTONES;

    const next = nextMilestone(kills, ms);
    const prev = prevMilestone(kills, ms);

    const span = Math.max(1, next - prev);
    const inSeg = Math.max(0, kills - prev);
    const pct = clamp((inSeg / span) * 100, 0, 100);

    const item: DisplayItem = {
      id: `act-${a.id}`,
      category: BOSS_NAMES.has(a.name) ? "bosses" : "activities",
      name: a.name,
      iconUrl: iconForActivity(a.name),

      primaryCurrent: inSeg,
      primaryTarget: span,
      primaryLabelTop: `Next Milestone: ${next}`,
      primaryLabelBottom: `${formatCompact(kills)} KC`,

      secondaryType: "rank",
      secondaryLabelTop: "Rank",
      secondaryCurrent: a.rank,

      milestones: ms,
      milestoneCurrent: kills,
      milestoneUnit: "kills"
    };

    if (item.category === "bosses") bosses.push(item);
    else activities.push(item);
  }

  return [...skills, ...bosses, ...activities];
}

function prevMilestone(current: number, milestones: number[]) {
  let prev = 0;
  for (const m of milestones) {
    if (m <= current) prev = m;
    else break;
  }
  return prev;
}
