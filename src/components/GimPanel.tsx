import type { HiscoresResponse } from "../lib/hiscoresApi";
import { xpForLevel, clamp } from "../lib/osrsXp";

type Props = {
  name: string;
  hiscores: HiscoresResponse;
  ok: boolean;

  // Optional: keep this if you still want to control columns later
  cols?: number; // now default 8 makes sense
};

// ✅ Rotated layout: 3 rows, 8 columns
const ORDER: string[][] = [
  ["Mining", "Smithing", "Fishing", "Cooking", "Firemaking", "Woodcutting", "Farming", "Sailing"],
  ["Hitpoints", "Agility", "Herblore", "Thieving", "Crafting", "Fletching", "Slayer", "Hunter"],
  ["Attack", "Strength", "Defence", "Ranged", "Prayer", "Magic", "Runecraft", "Construction"]
];

export function GimPanel({ name, hiscores, ok, cols = 8 }: Props) {
  const byName = new Map(hiscores.skills.map(s => [s.name, s]));

  let totalLevel = 0;
  let totalXp = 0;

  for (const s of hiscores.skills) {
    if (s.name === "Overall") continue;
    totalLevel += s.level ?? 1;
    totalXp += s.xp ?? 1;
  }

  return (
    <div className="gimPanel">
      <div className="gimPanelHeader">
        <div className="gimPanelName">{name}</div>
        {!ok ? <div className="gimPanelTag">Fallback</div> : null}
      </div>

      {/* ✅ 8 columns grid */}
      <div className="gimSkillsGrid" style={{ ["--gim-cols" as any]: cols }}>
        {ORDER.flat().map((skill) => {
            const isFallback = !ok;
            const s = byName.get(skill);
            
            const level = s?.level ?? (isFallback && skill === "Hitpoints" ? 10 : 1);
            const xp = s?.xp ?? (isFallback && skill === "Hitpoints" ? 1154 : 0);

          const curLevelXp = xpForLevel(level);
          const nextLevelXp = xpForLevel(Math.min(126, level + 1));
          const inLevel = Math.max(0, xp - curLevelXp);
          const needed = Math.max(1, nextLevelXp - curLevelXp);
          const pct = clamp((inLevel / needed) * 100, 0, 100);

          return (
            <div key={`${name}-${skill}`} className="gimSkillCell">
              <div className="gimSkillTop">
                <img
                  className="gimSkillIcon"
                  src={`${import.meta.env.BASE_URL}icons/skills/${slug(skill)}.png`}
                  alt={skill}
                />
                <div className="gimSkillLvl">{level}</div>
              </div>

              <div className="gimSkillBarTrack">
                <div
                  className="gimSkillBarFill"
                  style={{ width: `${pct}%`, background: gradientColor(pct) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="gimTotals">
        <div className="gimTotalsLeft">
          Total level: <span>{totalLevel.toLocaleString()}</span>
        </div>
        <div className="gimTotalsRight">
          Total xp: <span>{totalXp.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[:'()]/g, "")
    .replace(/\s+/g, "-");
}

function gradientColor(pct: number) {
  const p = clamp(pct, 0, 100);
  if (p <= 50) {
    const t = p / 50;
    const r = 255;
    const g = Math.round(255 * t);
    return `rgb(${r},${g},0)`;
  } else {
    const t = (p - 50) / 50;
    const r = Math.round(255 * (1 - t));
    const g = 255;
    return `rgb(${r},${g},0)`;
  }
}
