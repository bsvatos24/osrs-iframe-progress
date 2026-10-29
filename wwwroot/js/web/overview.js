// ============================================================
// Overview: where the group stands, who gained, and what is about to level.
// ============================================================

import { applyTier, el } from "../dom.js";
import { playerTier, MAX_SKILL_LEVEL, MAX_SKILL_XP } from "../osrs.js";
import { formatCompact, iconForActivity, iconForSkill } from "../format.js";
import { activityTotals, levelUpCandidates, rankedValue, skillTotals, teamEntryTotals } from "../model.js";
import { gains } from "../history.js";
import { card, link, list, meter, pageHead, playerHref, stats } from "./parts.js";

const LIST_LIMIT = 8;
const LIST_MAX = 30;

export function overviewPage(members) {
  const rows = standingsRows(members);
  const page = document.createDocumentFragment();

  page.appendChild(pageHead("Overview",
    "Where the group stands, who gained today, and what is about to level."));
  page.appendChild(groupStats(rows));

  page.appendChild(card("Standings", "Gains are measured from each day's first refresh in this browser.",
    standings(rows)));

  const cols = el("div", "cols");
  cols.appendChild(card("About to level", "Furthest through their level, across everyone",
    list(upcoming(members), LIST_LIMIT, "Nobody has a level left to gain.")));
  cols.appendChild(card("Most killed", "Team total, with the leader",
    list(mostKilled(members), LIST_LIMIT, "No boss kills yet.")));
  page.appendChild(cols);

  return page;
}

function standingsRows(members) {
  const rows = members.map(function (m) {
    if (!m.data) return { name: m.name, ok: false };
    const skills = m.data.skills.filter(function (s) { return s.name !== "Overall"; });
    return {
      name: m.name,
      ok: true,
      totals: skillTotals(m.data),
      maxLevel: skills.length * MAX_SKILL_LEVEL,
      nines: skills.filter(function (s) { return rankedValue(s.level) >= MAX_SKILL_LEVEL; }).length,
      capped: skills.filter(function (s) { return rankedValue(s.xp) >= MAX_SKILL_XP; }).length,
      bossKc: activityTotals(m.data).bossKc,
      tier: playerTier(m.data.skills),
      today: gains(m.name, m.data, 0),
      week: gains(m.name, m.data, 7)
    };
  });

  // Highest total level first; XP breaks ties. Players whose hiscores could
  // not be read sink to the bottom rather than ranking as zero.
  return rows.sort(function (a, b) {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (!a.ok) return a.name.localeCompare(b.name);
    return (b.totals.level - a.totals.level) || (b.totals.xp - a.totals.xp);
  });
}

function groupStats(rows) {
  const ok = rows.filter(function (r) { return r.ok; });
  const sum = function (fn) { return ok.reduce(function (acc, r) { return acc + fn(r); }, 0); };
  const capped = sum(function (r) { return r.capped; });

  return stats([
    { label: "Group total level", value: sum(function (r) { return r.totals.level; }).toLocaleString() },
    { label: "Group XP", value: formatCompact(sum(function (r) { return r.totals.xp; })) },
    { label: "99s", value: sum(function (r) { return r.nines; }).toLocaleString(),
      note: capped ? capped + " at 200M" : null },
    { label: "Boss kills", value: sum(function (r) { return r.bossKc; }).toLocaleString() }
  ]);
}

function standings(rows) {
  const wrap = el("div", "standings");

  const head = el("div", "st-row st-head");
  head.setAttribute("aria-hidden", "true");
  ["", "Player", "Total level", "Level", "XP", "Today", "7 days"].forEach(function (label, i) {
    head.appendChild(el("div", headClass(i), label));
  });
  wrap.appendChild(head);

  rows.forEach(function (row, i) {
    wrap.appendChild(row.ok ? standingRow(row, i) : missingRow(row, i));
  });
  return wrap;
}

function headClass(i) {
  return ["st-rank", "", "st-meter", "num", "num st-xp", "num", "num"][i];
}

function standingRow(row, i) {
  // Every skill at 99 turns the whole row gold; every skill at 200M turns it
  // prismatic - the name included, so it never stays half gold.
  const node = applyTier(el("div", "st-row"), row.tier, i);

  node.appendChild(el("div", "st-rank", "#" + (i + 1)));

  const name = el("div", "st-name" + (row.tier === "200" ? " prism" : " mx-num"));
  name.appendChild(link(playerHref(row.name), null, row.name));
  node.appendChild(name);

  const bar = meter((row.totals.level / Math.max(1, row.maxLevel)) * 100, "st-meter mx-bar");
  bar.setAttribute("aria-hidden", "true");
  node.appendChild(bar);

  node.appendChild(el("div", "num st-level mx-num", row.totals.level.toLocaleString()));
  const xp = el("div", "num st-xp dimnum", formatCompact(row.totals.xp));
  xp.title = row.totals.xp.toLocaleString() + " XP";
  node.appendChild(xp);
  node.appendChild(gainCell(row.today, "today"));
  node.appendChild(gainCell(row.week, "the last 7 days"));
  return node;
}

function missingRow(row, i) {
  const node = el("div", "st-row st-off");
  node.appendChild(el("div", "st-rank", "#" + (i + 1)));
  const name = el("div", "st-name");
  name.appendChild(link(playerHref(row.name), null, row.name));
  node.appendChild(name);
  const why = el("div", "dimnum", "Hiscores unavailable");
  why.style.gridColumn = "3 / -1";
  node.appendChild(why);
  return node;
}

// XP gained against this browser's stored snapshots. No snapshot yet reads as
// a dash, not a zero: zero would claim nobody played.
function gainCell(g, span) {
  if (!g || g.xp == null) {
    const none = el("div", "num dimnum", "\u2013");
    none.title = "No history yet for " + span;
    return none;
  }
  const cell = el("div", "num " + (g.xp > 0 ? "gain" : "dimnum"), g.xp > 0 ? "+" + formatCompact(g.xp) : "0");
  cell.title = g.xp.toLocaleString() + " XP since " + g.since;
  return cell;
}

function upcoming(members) {
  return levelUpCandidates(members).slice(0, LIST_MAX).map(function (c) {
    return {
      iconUrl: iconForSkill(c.skill),
      iconAlt: c.skill,
      main: c.skill + " " + (c.level + 1),
      sub: c.player + " \u00B7 " + Math.floor(c.pct) + "%",
      pct: c.pct,
      value: formatCompact(c.remaining) + " xp"
    };
  });
}

function mostKilled(members) {
  const list = teamEntryTotals(members, "bosses");
  const max = list.length ? list[0].total || 1 : 1;
  return list.slice(0, LIST_MAX).map(function (b) {
    return {
      iconUrl: iconForActivity(b.name),
      iconAlt: b.name,
      main: b.name,
      sub: b.leader ? b.leader + " leads with " + b.best.toLocaleString() : "",
      pct: (b.total / max) * 100,
      value: b.total.toLocaleString()
    };
  });
}