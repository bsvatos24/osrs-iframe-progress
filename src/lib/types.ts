export type Category = "skills" | "bosses" | "activities" | "total" | "gim";

export type DisplayItem = {
  id: string;
  category: Category;
  name: string;
  iconUrl: string;

  // Top-left (primary arc)
  primaryCurrent: number;
  primaryTarget: number;
  primaryLabelTop: string;
  primaryLabelBottom: string;

  // Top-right (secondary)
  secondaryType: "gauge" | "rank";
  secondaryCurrent?: number;
  secondaryTarget?: number;
  secondaryLabelTop: string;
  secondaryLabelBottom?: string;

  // Bottom milestones bar
  milestones: number[];
  milestoneCurrent: number;
  milestoneUnit: "level" | "kills";

  // ✅ Skill-only extras (for Total tab)
  skillLevel?: number;
  skillXp?: number;
  levelProgressPct?: number; // 0-100 within current level to next
};
