// ============================================================
// Compare: everyone side by side, by skill or by boss.
// ============================================================

import { applyTier, el } from "../dom.js";
import { SKILL_GRID_ORDER } from "../constants.js";
import { maxTier } from "../osrs.js";
import { iconForActivity, iconForSkill } from "../format.js";
import { activityTotals, isRanked, rankedValue, skillTotals, teamEntryTotals } from "../model.js";
import { card, icon, link, pageHead, playerHref } from "./parts.js";

export function comparePage(members, mode) {
  const page = document.createDocumentFragment();
  const bosses = mode === "bosses";

  page.appendChild(pageHead("Compare",
    bosses
      ? "Everyone side by side. \u25B2 marks the most kills in each row."
      : "Everyone side by side. \u25B2 marks the most XP in each row; hover a level for its XP.",
    segment(mode)));

  const table = el("table", "matrix");
  table.appendChild(headRow(members));
  table.appendChild(bosses ? bossBody(members) : skillBody(members));
  table.appendChild(bosses
    ? footRow(members, "Total KC", function (d) { return activityTotals(d).bossKc; })
    : footRow(members, "Total level", function (d) { return skillTotals(d).level; }));

  const wrap = el("div", "tablewrap");
  wrap.appendChild(table);
  const section = el("section", "card");
  section.appendChild(wrap);
  page.appendChild(section);
  return page;
}

function segment(mode) {
  const seg = el("nav", "seg");
  seg.setAttribute("aria-label", "Compare by");
  [["skills", "#compare", "Skills"], ["bosses", "#compare-bosses", "Bosses"]].forEach(function (opt) {
    const a = link(opt[1], null, opt[2]);
    if (opt[0] === mode) a.setAttribute("aria-current", "page");
    seg.appendChild(a);
  });
  return seg;
}

function headRow(members) {
  const thead = el("thead");
  const tr = el("tr");
  tr.appendChild(el("th", "corner"));
  members.forEach(function (m) {
    const th = el("th");
    th.scope = "col";
    th.appendChild(link(playerHref(m.name), null, m.name));
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  return thead;
}

function rowHead(iconUrl, name) {
  const th = el("th", "rowhead");
  th.scope = "row";
  th.appendChild(icon(iconUrl, name));
  th.appendChild(document.createTextNode(name));
  return th;
}

function skillBody(members) {
  const tbody = el("tbody");
  let seed = 0;

  SKILL_GRID_ORDER.forEach(function (skill) {
    const values = members.map(function (m) {
      const s = m.data && m.data.skills.find(function (x) { return x.name === skill; });
      return s ? { level: Math.max(1, rankedValue(s.level) || 1), xp: rankedValue(s.xp), ranked: isRanked(s.rank) } : null;
    });
    // The lead is the most XP, not the highest level: two 99s are not a tie.
    const top = Math.max(0, ...values.map(function (v) { return v ? v.xp : 0; }));

    const tr = el("tr");
    tr.appendChild(rowHead(iconForSkill(skill), skill));
    values.forEach(function (v, i) {
      const td = el("td");
      if (!v) {
        td.appendChild(dashCell("Hiscores unavailable"));
      } else if (!v.ranked) {
        td.appendChild(dashCell(members[i].name + " \u00B7 " + skill + ": not ranked yet"));
      } else {
        const tier = maxTier(v.level, v.xp);
        const cell = applyTier(el("div", "lvcell" + (top > 0 && v.xp === top ? " lead" : "")), tier, seed++);
        cell.title = members[i].name + " \u00B7 " + skill + ": " + v.xp.toLocaleString() + " XP";
        cell.appendChild(tier === "200"
          ? el("span", "prism", "200M")
          : el("span", "mx-num", String(v.level)));
        td.appendChild(cell);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  return tbody;
}

function bossBody(members) {
  const tbody = el("tbody");
  // Only bosses somebody has killed, biggest team total first.
  const bosses = teamEntryTotals(members, "bosses");

  if (bosses.length === 0) {
    const tr = el("tr");
    const td = el("td", "empty", "No boss kills yet.");
    td.colSpan = members.length + 1;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return tbody;
  }

  bosses.forEach(function (boss) {
    const tr = el("tr");
    tr.appendChild(rowHead(iconForActivity(boss.name), boss.name));
    members.forEach(function (m) {
      const td = el("td");
      if (!m.data) {
        td.appendChild(dashCell("Hiscores unavailable"));
      } else {
        const row = (m.data.activities || []).find(function (a) { return a.name === boss.name; });
        const kc = rankedValue(row && row.score);
        const cell = el("div", "lvcell" + (kc > 0 && kc === boss.best ? " lead" : ""));
        if (kc > 0) cell.textContent = kc.toLocaleString();
        else cell.appendChild(el("span", "dimnum", "\u2013"));
        td.appendChild(cell);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  return tbody;
}

function footRow(members, label, value) {
  const tfoot = el("tfoot");
  const tr = el("tr");
  const th = el("th", "rowhead", label);
  th.scope = "row";
  tr.appendChild(th);
  members.forEach(function (m) {
    tr.appendChild(el("td", m.data ? null : "dimnum", m.data ? value(m.data).toLocaleString() : "\u2013"));
  });
  tfoot.appendChild(tr);
  return tfoot;
}

function dashCell(why) {
  const cell = el("div", "lvcell");
  cell.appendChild(el("span", "dimnum", "\u2013"));
  cell.title = why;
  return cell;
}