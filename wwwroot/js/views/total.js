// ============================================================
// Total: every skill at a glance, plus team-comparable totals.
// ============================================================

import { el } from "../dom.js";
import { skillTile, statPair } from "../components.js";
import { SKILL_GRID_ORDER } from "../constants.js";

export function renderTotalView(state) {
  const section = el("section", "card full cardTotal");

  if (state.loading && state.items.length === 0) {
    section.appendChild(el("div", "cardMsg", "Loading…"));
  } else if (state.error && state.items.length === 0) {
    section.appendChild(el("div", "cardMsg", state.error));
  } else {
    section.appendChild(totalGrid(state.items));
  }

  return { className: "grid", children: [section] };
}

function totalGrid(items) {
  const skills = items.filter(function (i) { return i.category === "skills"; });
  const byName = new Map(skills.map(function (s) { return [s.name, s]; }));
  const ordered = SKILL_GRID_ORDER
    .map(function (name) { return byName.get(name); })
    .filter(Boolean);

  const totalLevel = skills.reduce(function (sum, s) { return sum + (s.skillLevel || 0); }, 0);
  const totalXp = skills.reduce(function (sum, s) { return sum + (s.skillXp || 0); }, 0);

  const wrap = el("div", "totalGridWrap");
  const grid = el("div", "totalGrid");
  ordered.forEach(function (s) { grid.appendChild(skillTile(s)); });
  wrap.appendChild(grid);

  const footer = el("div", "totalFooter");
  footer.appendChild(statPair("Total level", totalLevel.toLocaleString()));
  footer.appendChild(statPair("Total XP", totalXp.toLocaleString()));
  wrap.appendChild(footer);

  return wrap;
}
