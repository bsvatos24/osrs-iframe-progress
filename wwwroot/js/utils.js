// OSRS cumulative XP required to reach a given level
function xpForLevel(level) {
  const lvl = Math.max(1, Math.min(126, Math.floor(level)));
  let points = 0;
  for (let i = 1; i < lvl; i++) {
    points += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(points / 4);
}
 
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
 
function formatNumber(n) {
  return n.toLocaleString();
}
 
function formatCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "b";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
 
function nextMilestone(current, milestones) {
  for (const m of milestones) {
    if (current < m) return m;
  }
  return milestones[milestones.length - 1] || current;
}
 
function prevMilestone(current, milestones) {
  let prev = 0;
  for (const m of milestones) {
    if (m <= current) prev = m;
    else break;
  }
  return prev;
}
 
function slug(name) {
  return name.toLowerCase().replace(/[:'()]/g, "").replace(/\s+/g, "-");
}
 
function iconForSkill(name) {
  return "wwwroot/icons/skills/" + slug(name) + ".png";
}
 
function iconForActivity(name) {
  return "wwwroot/icons/activities/" + slug(name) + ".png";
}
 
function fmt(n) {
  return Math.max(0, n).toLocaleString();
}
 
function formatRank(rank) {
  if (rank == null || rank < 0) return "Unranked";
  return "#" + rank.toLocaleString();
}
 
// Red(0%) -> Yellow(50%) -> Green(100%)
function pctToColor(p) {
  if (p <= 0.5) {
    const t = p / 0.5;
    return lerpRgb([255, 0, 0], [255, 255, 0], t);
  } else {
    const t = (p - 0.5) / 0.5;
    return lerpRgb([255, 255, 0], [0, 255, 0], t);
  }
}
 
function lerpRgb(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return "rgb(" + r + ", " + g + ", " + bl + ")";
}
 
// Red -> Yellow -> Green for GIM panels (pct is 0-100)
function gradientColor(pct) {
  const p = clamp(pct, 0, 100);
  if (p <= 50) {
    const t = p / 50;
    return "rgb(255," + Math.round(255 * t) + ",0)";
  } else {
    const t = (p - 50) / 50;
    return "rgb(" + Math.round(255 * (1 - t)) + ",255,0)";
  }
}
 
// Segment fill percentage for milestone bar
function segmentFillPct(current, from, to) {
  if (to <= from) return 0;
  if (current <= from) return 0;
  if (current >= to) return 100;
  return clamp(((current - from) / (to - from)) * 100, 0, 100);
}
 
// Map hiscores API response to display items
function mapHiscoresToDisplayItems(data) {
  const skills = data.skills
    .filter(function (s) { return s.name !== "Overall"; })
    .map(function (s) {
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
        id: "skill-" + s.id,
        category: "skills",
        name: s.name,
        iconUrl: iconForSkill(s.name),
        primaryCurrent: inLevel,
        primaryTarget: needed,
        primaryLabelTop: pct.toFixed(0) + "% Complete",
        primaryLabelBottom: formatCompact(inLevel) + " / " + formatCompact(needed),
        secondaryType: "gauge",
        secondaryCurrent: currentXp,
        secondaryTarget: xp99,
        secondaryLabelTop: pct99.toFixed(0) + "% to 99",
        secondaryLabelBottom: formatCompact(currentXp) + " / " + formatCompact(xp99) + " XP",
        milestones: SKILL_MILESTONES,
        milestoneCurrent: currentLevel,
        milestoneUnit: "level",
        skillLevel: currentLevel,
        skillXp: currentXp,
        levelProgressPct: pct
      };
    });
 
  const bosses = [];
  const activities = [];
 
  for (const a of data.activities) {
    const kills = a.score || 0;
    const ms = KC_MILESTONES;
    const next = nextMilestone(kills, ms);
    const prev = prevMilestone(kills, ms);
    const span = Math.max(1, next - prev);
    const inSeg = Math.max(0, kills - prev);
 
    const item = {
      id: "act-" + a.id,
      category: BOSS_NAMES.has(a.name) ? "bosses" : "activities",
      name: a.name,
      iconUrl: iconForActivity(a.name),
      primaryCurrent: inSeg,
      primaryTarget: span,
      primaryLabelTop: "Next Milestone: " + next,
      primaryLabelBottom: formatCompact(kills) + " KC",
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
 
  return skills.concat(bosses, activities);
}
 
// Create fallback hiscores for GIM when a player can't be fetched
function fallbackHiscores(name) {
  return {
    name: name,
    skills: ALL_SKILL_NAMES.map(function (sn, i) {
      return { id: i + 1, name: sn, rank: -1, level: 1, xp: 1 };
    }),
    activities: []
  };
}
