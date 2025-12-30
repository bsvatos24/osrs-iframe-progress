import type { DisplayItem } from "../lib/types";

const SKILL_GRID_ORDER: string[] = [
  // Row 1
  "Attack", "Hitpoints", "Mining",
  // Row 2
  "Strength", "Agility", "Smithing",
  // Row 3
  "Defence", "Herblore", "Fishing",
  // Row 4
  "Ranged", "Thieving", "Cooking",
  // Row 5
  "Prayer", "Crafting", "Firemaking",
  // Row 6
  "Magic", "Fletching", "Woodcutting",
  // Row 7
  "Runecraft", "Slayer", "Farming",
  // Row 8 
  "Construction", "Hunter", "Sailing"
];

type Props = {
  skillItems: DisplayItem[]; // category === "skills"
};

export function TotalGrid({ skillItems }: Props) {
  const byName = new Map(skillItems.map((s) => [s.name, s]));

  const ordered = SKILL_GRID_ORDER
    .map((name) => byName.get(name))
    .filter(Boolean) as DisplayItem[];

  const totalLevel = skillItems.reduce((sum, s) => sum + (s.skillLevel ?? s.milestoneCurrent ?? 0), 0);
  const totalXp = skillItems.reduce((sum, s) => sum + (s.skillXp ?? 0), 0);

  return (
    <div className="totalGridWrap">
      <div className="totalGrid">
        {ordered.map((s) => {
          const lvl = s.skillLevel ?? s.milestoneCurrent ?? 0;
          const pct = clamp01((s.levelProgressPct ?? 0) / 100);
          const barColor = pctToColor(pct);

          return (
            <div key={s.id} className="skillTile">
              <div className="skillTileTop">
                <img className="skillTileIcon" src={s.iconUrl} alt={s.name} />
                <div className="skillTileName">{s.name}</div>
                <div className="skillTileLevel">{lvl}</div>
              </div>

              <div className="skillTileBar">
                <div
                  className="skillTileBarFill"
                  style={{ width: `${pct * 100}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="totalFooter">
        <div className="totalFooterStat">
          <div className="totalFooterLabel">Total level</div>
          <div className="totalFooterValue">{totalLevel.toLocaleString()}</div>
        </div>

        <div className="totalFooterStat">
          <div className="totalFooterLabel">Total XP</div>
          <div className="totalFooterValue">{totalXp.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// red(0) -> yellow(0.5) -> green(1)
function pctToColor(p: number) {
  if (p <= 0.5) {
    const t = p / 0.5; // 0..1
    return lerpRgb([255, 0, 0], [255, 255, 0], t);
  } else {
    const t = (p - 0.5) / 0.5; // 0..1
    return lerpRgb([255, 255, 0], [0, 255, 0], t);
  }
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
