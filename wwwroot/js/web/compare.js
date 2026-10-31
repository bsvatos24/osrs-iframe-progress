// ============================================================
// Compare: everyone side by side, by skill, boss, activity or XP gained.
// ============================================================

import { applyTier, el } from "../dom.js";
import { BOSS_NAMES, SKILL_GRID_ORDER } from "../constants.js";
import { maxTier } from "../osrs.js";
import { iconForActivity, iconForSkill } from "../format.js";
import { activityTotals, compareNames, hasSkillLevel, rankedValue, skillTotals } from "../model.js";
import { card, icon, link, pageHead, playerHref } from "./parts.js";
import { compareGains } from "./training.js";

const BLURBS = {
  skills: "Everyone side by side. \u25B2 marks the most XP in each row; hover a level for its XP.",
  bosses: "Everyone side by side, A to Z. \u25B2 marks the most kills in each row.",
  activities: "Minigames, clue scrolls and the rest of the hiscores. \u25B2 marks the highest in each row.",
  gains: "Who is training what: XP gained in each skill, side by side."
};

export function comparePage(members, mode) {
  const page = document.createDocumentFragment();
  page.appendChild(pageHead("Compare", BLURBS[mode], segment(mode)));
  if (mode === "gains") {
    page.appendChild(compareGains(members));
    return page;
  }

  const table = el("table", "matrix");
  table.appendChild(headRow(members));
  if (mode === "skills") {
    table.appendChild(skillBody(members));
    table.appendChild(footRow(members, "Total level", function (d) { return skillTotals(d).level; }));
  } else if (mode === "bosses") {
    table.appendChild(entryBody(members, "bosses"));
    table.appendChild(footRow(members, "Total KC", function (d) { return activityTotals(d).bossKc; }));
  } else {
    // No total row: these rows mix counts with ratings and points, and clue
    // tiers repeat "Clue Scrolls (all)", so a sum would mean nothing.
    table.appendChild(entryBody(members, "activities"));
  }

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
  [
    ["skills", "#compare", "Skills"],
    ["bosses", "#compare-bosses", "Bosses"],
    ["activities", "#compare-activities", "Activities"],
    ["gains", "#compare-gains", "Gains"]
  ].forEach(function (opt) {
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
      return s ? { level: Math.max(1, rankedValue(s.level) || 1), xp: rankedValue(s.xp), listed: hasSkillLevel(s) } : null;
    });
    // The lead is the most XP, not the highest level: two 99s are not a tie.
    const top = leader(values.map(function (v) { return v ? v.xp : null; }));

    const tr = el("tr");
    tr.appendChild(rowHead(iconForSkill(skill), skill));
    values.forEach(function (v, i) {
      const td = el("td");
      if (!v) {
        td.appendChild(dashCell("Hiscores unavailable"));
      } else if (!v.listed) {
        td.appendChild(dashCell(members[i].name + " \u00B7 " + skill + ": not on the hiscores yet"));
      } else {
        const tier = maxTier(v.level, v.xp);
        const cell = applyTier(el("div", "lvcell" + (v.xp === top ? " lead" : "")), tier, seed++);
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

// One row per boss (kind "bosses") or per activity, for every entry somebody
// has a score in. Bosses run alphabetically; activities keep the hiscores'
// own order - clue tiers together, minigames together - as on the kiosk.
function entryBody(members, kind) {
  const tbody = el("tbody");
  const names = entryNames(members, kind === "bosses");

  if (names.length === 0) {
    const tr = el("tr");
    const td = el("td", "empty", kind === "bosses" ? "No boss kills yet." : "Nothing on the hiscores yet.");
    td.colSpan = members.length + 1;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return tbody;
  }

  names.forEach(function (name) {
    const scores = members.map(function (m) {
      if (!m.data) return null;
      const row = (m.data.activities || []).find(function (a) { return a.name === name; });
      return rankedValue(row && row.score);
    });
    const top = leader(scores);

    const tr = el("tr");
    tr.appendChild(rowHead(iconForActivity(name), name));
    scores.forEach(function (score) {
      const td = el("td");
      if (score === null) {
        td.appendChild(dashCell("Hiscores unavailable"));
      } else {
        const cell = el("div", "lvcell" + (score === top ? " lead" : ""));
        if (score > 0) cell.textContent = score.toLocaleString();
        else cell.appendChild(el("span", "dimnum", "\u2013"));
        td.appendChild(cell);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  return tbody;
}

// Names in the order the hiscores send them - every payload lists every
// entry, so the first one read gives the order the kiosk cycles in - kept to
// those somebody has a score in.
function entryNames(members, bosses) {
  const scored = new Set();
  const order = [];
  members.forEach(function (m) {
    ((m.data && m.data.activities) || []).forEach(function (a) {
      if (BOSS_NAMES.has(a.name) !== bosses) return;
      if (order.indexOf(a.name) === -1) order.push(a.name);
      if (rankedValue(a.score) > 0) scored.add(a.name);
    });
  });
  const names = order.filter(function (n) { return scored.has(n); });
  return bosses ? names.sort(compareNames) : names;
}

// The value that earns a row's lead marker, or null for none: nobody has
// scored, or everyone ties - a marker on every cell says nothing.
function leader(values) {
  const real = values.filter(function (v) { return v !== null; });
  const top = Math.max(0, ...real);
  if (top <= 0) return null;
  if (real.length > 1 && real.every(function (v) { return v === top; })) return null;
  return top;
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