export const SKILL_LEVEL_MILESTONES = [70, 80, 90, 99];

export const DEFAULT_KILL_MILESTONES = [50, 100, 250, 500, 1000];

export function nextMilestone(current: number, milestones: number[]) {
  for (const m of milestones) {
    if (current < m) return m;
  }
  return milestones[milestones.length - 1];
}
