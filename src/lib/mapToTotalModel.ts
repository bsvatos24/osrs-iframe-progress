import type { HiscoresResponse } from "./hiscoresApi";
import { clamp, xpForLevel } from "./osrsXp";

type TotalSkill = {
  name: string;
  level: number;
  xp: number;
  pctToNext: number;
  iconUrl: string;
};

export type TotalModel = {
  totalLevel: number;
  totalXp: number;
  skills: TotalSkill[];
};

const SKILL_ORDER = [
  "Attack", "Hitpoints", "Mining",
  "Strength", "Agility", "Smithing",
  "Defence", "Herblore", "Fishing",
  "Ranged", "Thieving", "Cooking",
  "Prayer", "Crafting", "Firemaking",
  "Magic", "Fletching", "Woodcutting",
  "Runecraft", "Slayer", "Farming",
  "Construction", "Hunter", "Sailing" // include if you want it displayed
];

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[:'()]/g, "")
    .replace(/\s+/g, "-");
}

function iconForSkill(name: string) {
  return `${import.meta.env.BASE_URL}icons/skills/${slug(name)}.png`;
}

export function mapHiscoresToTotalModel(data: HiscoresResponse): TotalModel {
  const skillsByName = new Map(data.skills.map(s => [s.name, s]));

  const skills: TotalSkill[] = SKILL_ORDER
    .map((name) => skillsByName.get(name))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => {
      const curLevelXp = xpForLevel(s.level);
      const nextLevelXp = xpForLevel(Math.min(126, s.level + 1));
      const inLevel = Math.max(0, s.xp - curLevelXp);
      const needed = Math.max(1, nextLevelXp - curLevelXp);
      const pct = clamp((inLevel / needed) * 100, 0, 100);

      return {
        name: s.name,
        level: s.level,
        xp: s.xp,
        pctToNext: pct,
        iconUrl: iconForSkill(s.name)
      };
    });

  const totalLevel = skills.reduce((sum, s) => sum + s.level, 0);
  const totalXp = skills.reduce((sum, s) => sum + s.xp, 0);

  return { totalLevel, totalXp, skills };
}
