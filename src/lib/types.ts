export type Category = "skills" | "bosses" | "activities";

export type DisplayItem = {
  id: string;
  category: Category;
  name: string;
  iconUrl: string;

  // Top-left (primary arc)
  primaryCurrent: number;
  primaryTarget: number;
  primaryLabelTop: string;     // e.g. "54% Complete"
  primaryLabelBottom: string;  // e.g. "XP to next level"

  // Top-right (secondary)
  secondaryType: "gauge" | "rank";
  secondaryCurrent?: number;
  secondaryTarget?: number;
  secondaryLabelTop: string;   // e.g. "Level 73 / 99" OR "Rank"
  secondaryLabelBottom?: string;

  // Bottom milestones bar
  milestones: number[];        // e.g. [70,80,90,99]
  milestoneCurrent: number;    // level or kills
  milestoneUnit: "level" | "kills";

};
