// ============================================================
// GIM: every team member's skills side by side.
//
// Each member renders from its own fetch result, so one failure degrades one
// panel. It never substitutes invented level-1 data for a missing fetch.
// ============================================================

import { el, img } from "../dom.js";
import { GIM_SKILL_ORDER } from "../constants.js";
import { levelProgress } from "../osrs.js";
import { config } from "../config.js";
import { formatClock, iconForSkill, progressColor } from "../format.js";
import { rankedValue, skillTotals } from "../model.js";

// Panels are laid out by bucket rather than by one fixed pattern:
//   xl  - five panels in a single row (507px each on a 2536px slot)
//   l   - three over two, which fills the slot instead of leaving the die-5
//         pattern's two corners empty
//   m   - 840px cannot show five 24-skill grids legibly, so it shows one
//         member at a time (or ?gim=summary for five compact rows)
//   tall- stacked and scrollable
export function renderGimView(state, bucket, roster) {
  const section = el("section", "card full cardGim");

  if (state.gim.loading && !state.gim.loaded) {
    section.appendChild(el("div", "gimLoading", "Loading GIM\u2026"));
    return { className: "mainFill", children: [section] };
  }

  const byName = new Map(state.gim.results.map(function (r) { return [r.player, r]; }));
  const style = gimStyle(bucket);

  if (style === "summary") {
    section.appendChild(summaryList(roster, byName));
    return { className: "mainFill", children: [section] };
  }

  if (style === "cycle") {
    const member = roster[state.gim.cycleIndex % roster.length];
    const layout = el("div", "gimLayout gimLayoutSingle");
    const slot = el("div", "gimSlot");
    slot.appendChild(gimPanel(member.name, byName.get(member.name)));
    layout.appendChild(slot);
    layout.appendChild(gimDots(roster.length, state.gim.cycleIndex % roster.length));
    section.appendChild(layout);
    return { className: "mainFill", children: [section] };
  }

  const layout = el("div", "gimLayout gimLayoutGrid");
  roster.forEach(function (member) {
    const slot = el("div", "gimSlot");
    slot.appendChild(gimPanel(member.name, byName.get(member.name)));
    layout.appendChild(slot);
  });
  section.appendChild(layout);
  return { className: "mainFill", children: [section] };
}

function gimStyle(bucket) {
  if (config.gimStyle) return config.gimStyle;
  if (bucket === "m") return "cycle";
  return "panels";
}

// Which member the cycling single-panel layout is showing.
function gimDots(count, active) {
  const row = el("div", "gimDots");
  for (let i = 0; i < count; i++) {
    row.appendChild(el("span", "gimDot" + (i === active ? " gimDotActive" : "")));
  }
  return row;
}

// Compact one-row-per-member view: totals only, everyone visible at once.
function summaryList(roster, byName) {
  const list = el("div", "gimSummary");
  const rows = roster.map(function (member) {
    const result = byName.get(member.name);
    const totals = result && result.data
      ? skillTotals(result.data)
      : { level: 0, xp: 0 };
    return { name: member.name, totals: totals, ok: !!(result && result.data) };
  }).sort(function (a, b) { return b.totals.level - a.totals.level; });

  const maxLevel = Math.max(1, ...rows.map(function (r) { return r.totals.level; }));

  rows.forEach(function (row) {
    const item = el("div", "gimSummaryRow");
    item.appendChild(el("div", "gimSummaryName", row.name));

    const bar = el("div", "gimSummaryBar");
    const fill = el("div", "gimSummaryBarFill");
    fill.style.width = (row.totals.level / maxLevel) * 100 + "%";
    bar.appendChild(fill);
    item.appendChild(bar);

    item.appendChild(el("div", "gimSummaryStat",
      row.ok ? row.totals.level.toLocaleString() : "-"));
    item.appendChild(el("div", "gimSummaryStat gimSummaryXp",
      row.ok ? row.totals.xp.toLocaleString() : "no data"));
    list.appendChild(item);
  });

  return list;
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
