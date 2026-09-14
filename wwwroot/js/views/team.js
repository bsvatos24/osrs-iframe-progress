// ============================================================
// Team: a leaderboard of everyone, plus what is about to level.
//
// Both halves come from the GIM fetch that already runs, so this view costs no
// extra requests. On xl/l the two sit side by side, which is what the 3.6:1
// canvas is actually good for; narrower buckets show the board alone.
// ============================================================

import { el, img } from "../dom.js";
import { GIM_SKILL_ORDER } from "../constants.js";
import { levelProgress, xpForLevel, MAX_SKILL_LEVEL, MAX_VIRTUAL_LEVEL } from "../osrs.js";
import { formatCompact, iconForSkill, progressColor } from "../format.js";
import { rankedValue, skillTotals } from "../model.js";
import { gains, historyDepth } from "../history.js";

const UPCOMING_LIMIT = 12;

export function renderTeamView(state, bucket, roster) {
  const section = el("section", "card full cardTeam");

  if (state.gim.loading && !state.gim.loaded) {
    section.appendChild(el("div", "gimLoading", "Loading team…"));
    return { className: "mainFill", children: [section] };
  }

  const byName = new Map(state.gim.results.map(function (r) { return [r.player, r]; }));
  const rows = buildRows(roster, byName);

  const wrap = el("div", "teamWrap");
  wrap.appendChild(leaderboard(rows));

  // Only where there is horizontal room to spare.
  if (bucket === "xl" || bucket === "l") {
    wrap.appendChild(upcoming(rows));
  }

  section.appendChild(wrap);
  return { className: "mainFill", children: [section] };
}

function buildRows(roster, byName) {
  return roster.map(function (member) {
    const result = byName.get(member.name);
    const data = result && result.data ? result.data : null;
    const totals = data ? skillTotals(data) : { level: 0, xp: 0 };

    return {
      name: member.name,
      ok: !!data,
      error: result ? result.error : "No data",
      totals: totals,
      today: data ? gains(member.name, data, 0) : null,
      week: data ? gains(member.name, data, 7) : null,
      depth: historyDepth(member.name),
      skills: data ? data.skills : []
    };
  }).sort(function (a, b) {
    if (b.totals.level !== a.totals.level) return b.totals.level - a.totals.level;
    return b.totals.xp - a.totals.xp;
  });
}

// --- Leaderboard -----------------------------------------------------------

function leaderboard(rows) {
  const panel = el("div", "teamPanel");
  panel.appendChild(el("div", "teamPanelTitle", "Team standings"));

  const table = el("div", "teamTable");
  table.appendChild(headerRow());

  const maxLevel = Math.max(1, ...rows.map(function (r) { return r.totals.level; }));

  rows.forEach(function (row, i) {
    const node = el("div", "teamRow");

    node.appendChild(el("div", "teamRank", "#" + (i + 1)));
    node.appendChild(el("div", "teamName", row.name));

    const bar = el("div", "teamBar");
    const fill = el("div", "teamBarFill");
    fill.style.width = (row.totals.level / maxLevel) * 100 + "%";
    bar.appendChild(fill);
    node.appendChild(bar);

    node.appendChild(el("div", "teamCell teamLevel",
      row.ok ? row.totals.level.toLocaleString() : "—"));
    node.appendChild(el("div", "teamCell teamXp",
      row.ok ? formatCompact(row.totals.xp) : "—"));
    node.appendChild(gainCell(row.today, row.depth, row.ok));
    node.appendChild(gainCell(row.week, row.depth, row.ok));

    table.appendChild(node);
  });

  panel.appendChild(table);
  panel.appendChild(el("div", "teamNote",
    "Gains are measured against this device's own daily snapshots, so they start from the day you first open this page."));
  return panel;
}

function headerRow() {
  const head = el("div", "teamRow teamRowHead");
  ["", "Player", "", "Level", "XP", "Today", "7 days"].forEach(function (label, i) {
    const cls = i === 1 ? "teamName" : i === 2 ? "teamBar teamBarHead" : "teamCell";
    head.appendChild(el("div", cls, label));
  });
  return head;
}

function gainCell(gain, depth, ok) {
  if (!ok) return el("div", "teamCell teamGain", "—");
  // No snapshot yet: say so rather than implying zero progress.
  if (!gain) return el("div", "teamCell teamGain teamGainEmpty", depth ? "—" : "new");
  if (gain.xp <= 0) return el("div", "teamCell teamGain teamGainEmpty", "0");

  const cell = el("div", "teamCell teamGain teamGainPositive");
  cell.textContent = "+" + formatCompact(gain.xp);
  if (gain.level > 0) cell.title = "+" + gain.level + " levels since " + gain.since;
  return cell;
}

// --- About to level --------------------------------------------------------

// Across every member and every skill, which level-ups are nearest. This is
// the most glanceable thing an ambient panel can show: what is about to pop.
function upcoming(rows) {
  const panel = el("div", "teamPanel teamPanelUpcoming");
  panel.appendChild(el("div", "teamPanelTitle", "About to level"));

  const candidates = [];
  const skillNames = GIM_SKILL_ORDER.flat();

  rows.forEach(function (row) {
    if (!row.ok) return;
    const byName = new Map(row.skills.map(function (s) { return [s.name, s]; }));

    skillNames.forEach(function (skillName) {
      const s = byName.get(skillName);
      const level = Math.max(1, rankedValue(s && s.level) || 1);
      const xp = rankedValue(s && s.xp);

      // A 99 has no next level to reach, and an unstarted skill is not "about
      // to" anything.
      if (level >= MAX_SKILL_LEVEL || level >= MAX_VIRTUAL_LEVEL) return;
      if (xp <= 0) return;

      const progress = levelProgress(level, xp);
      const remaining = Math.max(0, xpForLevel(level + 1) - xp);

      candidates.push({
        player: row.name,
        skill: skillName,
        level: level,
        remaining: remaining,
        pct: progress.pct
      });
    });
  });

  candidates.sort(function (a, b) {
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    // Equal XP remaining: further through the level first, then stable by name
    // so the board does not reshuffle between polls.
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.player.localeCompare(b.player) || a.skill.localeCompare(b.skill);
  });

  if (candidates.length === 0) {
    panel.appendChild(el("div", "teamEmpty", "No data yet"));
    return panel;
  }

  const list = el("div", "upcomingList");
  candidates.slice(0, UPCOMING_LIMIT).forEach(function (c) {
    const row = el("div", "upcomingRow");
    row.appendChild(img(iconForSkill(c.skill), c.skill, "upcomingIcon"));

    const label = el("div", "upcomingLabel");
    label.appendChild(el("div", "upcomingSkill", c.skill + " " + (c.level + 1)));
    label.appendChild(el("div", "upcomingPlayer", c.player));
    row.appendChild(label);

    const bar = el("div", "upcomingBar");
    const fill = el("div", "upcomingBarFill");
    fill.style.width = c.pct + "%";
    fill.style.background = progressColor(c.pct);
    bar.appendChild(fill);
    row.appendChild(bar);

    row.appendChild(el("div", "upcomingRemaining", formatCompact(c.remaining)));
    list.appendChild(row);
  });

  panel.appendChild(list);
  return panel;
}
