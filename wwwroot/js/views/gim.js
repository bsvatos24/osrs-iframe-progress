// ============================================================
// GIM: every team member's skills side by side.
//
// Each member renders from its own fetch result, so one failure degrades one
// panel. It never substitutes invented level-1 data for a missing fetch.
// ============================================================

import { el, img } from "../dom.js";
import { GIM_SKILL_ORDER, TEAM } from "../constants.js";
import { levelProgress } from "../osrs.js";
import { formatClock, iconForSkill, progressColor } from "../format.js";
import { rankedValue, skillTotals } from "../model.js";

export function renderGimView(state) {
  const section = el("section", "card full cardGim");

  if (state.gim.loading && !state.gim.loaded) {
    section.appendChild(el("div", "gimLoading", "Loading GIM…"));
    return { className: "mainFill", children: [section] };
  }

  const byName = new Map(state.gim.results.map(function (r) { return [r.player, r]; }));
  const layout = el("div", "gimLayout");

  TEAM.forEach(function (member) {
    const slot = el("div", "gimSlot " + member.pos);
    slot.appendChild(gimPanel(member.name, byName.get(member.name)));
    layout.appendChild(slot);
  });

  section.appendChild(layout);
  return { className: "mainFill", children: [section] };
}

function gimPanel(name, result) {
  const panel = el("div", "gimPanel");

  const header = el("div", "gimPanelHeader");
  header.appendChild(el("div", "gimPanelName", name));
  if (result && result.stale) {
    const tag = el("div", "gimPanelTag", "as of " + formatClock(result.fetchedAt));
    tag.title = result.error || "Showing cached data";
    header.appendChild(tag);
  }
  panel.appendChild(header);

  if (!result || !result.data) {
    panel.appendChild(el("div", "gimPanelError",
      (result && result.error) ? result.error : "No data"));
    return panel;
  }

  const byName = new Map(result.data.skills.map(function (s) { return [s.name, s]; }));
  const grid = el("div", "gimSkillsGrid");

  GIM_SKILL_ORDER.flat().forEach(function (skillName) {
    const s = byName.get(skillName);
    const level = Math.max(1, rankedValue(s && s.level) || 1);
    const xp = rankedValue(s && s.xp);
    const pct = levelProgress(level, xp).pct;

    const cell = el("div", "gimSkillCell");
    const top = el("div", "gimSkillTop");
    top.appendChild(img(iconForSkill(skillName), skillName, "gimSkillIcon"));
    top.appendChild(el("div", "gimSkillLvl", level));
    cell.appendChild(top);

    const track = el("div", "gimSkillBarTrack");
    const fill = el("div", "gimSkillBarFill");
    fill.style.width = pct + "%";
    fill.style.background = progressColor(pct);
    track.appendChild(fill);
    cell.appendChild(track);

    grid.appendChild(cell);
  });
  panel.appendChild(grid);

  const totals = skillTotals(result.data);
  const row = el("div", "gimTotals");
  row.appendChild(labelled("gimTotalsLeft", "Total level: ", totals.level.toLocaleString()));
  row.appendChild(labelled("gimTotalsRight", "Total xp: ", totals.xp.toLocaleString()));
  panel.appendChild(row);

  return panel;
}

function labelled(className, label, value) {
  const node = el("div", className);
  node.appendChild(document.createTextNode(label));
  node.appendChild(el("span", null, value));
  return node;
}
