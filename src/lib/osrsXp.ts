export function xpForLevel(level: number): number {
  // OSRS cumulative xp required to reach "level"
  // level 1 => 0 xp
  // level 2 => 83 xp ...
  const lvl = Math.max(1, Math.min(126, Math.floor(level)));
  let points = 0;

  for (let i = 1; i < lvl; i++) {
    points += Math.floor(i + 300 * Math.pow(2, i / 7));
  }

  return Math.floor(points / 4);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function formatNumber(n: number) {
  return n.toLocaleString();
}

export function formatCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}b`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${n}`;
}

export function nextMilestone(current: number, milestones: number[]) {
  for (const m of milestones) if (current < m) return m;
  return milestones[milestones.length - 1] ?? current;
}
