// ============================================================
// Team: everyone ranked by one chosen metric, plus a ranked side panel.
//
// The metric (Skills / Bosses / Activities) is picked from the footer dropdown,
// which on this tab replaces the player selector - a single player is
// meaningless here. Every metric reads from the multi-player fetch the GIM
// view already makes, so switching metric costs no requests.
// ============================================================

import { applyTier, el, img } from "../dom.js";
import { playerTier } from "../osrs.js";
import { formatCompact, iconForActivity, iconForSkill, progressColor } from "../format.js";
import { activityTotals, levelUpCandidates, skillTotals, teamEntryTotals } from "../model.js";
import { gains, historyDepth } from "../history.js";

const SIDE_LIMIT = 15;

// Each metric says how to rank players, what two numbers to show, which
// history key the gain columns track, and what its side panel is.
const METRICS = {
  skills: {
    title: "Team standings",
    primaryLabel: "Level",
    secondaryLabel: "XP",
    primary: function (row) { return row.skills.level; },
    secondary: function (row) { return row.skills.xp; },
    formatPrimary: function (v) { return v.toLocaleString(); },
    formatSecondary: formatCompact,
    gainKey: "xp",
    sideTitle: "About to level",
    side: upcomingLevels
  },
  bosses: {
    title: "Boss kill counts",
    primaryLabel: "Total KC",
    secondaryLabel: "Unique",
    primary: function (row) { return row.acts.bossKc; },
    secondary: function (row) { return row.acts.uniqueBosses; },
    formatPrimary: function (v) { return v.toLocaleString(); },
    formatSecondary: function (v) { return v.toLocaleString(); },
    gainKey: "kc",
    sideTitle: "Most killed",
    side: function (rows) { return topEntries(rows, "bosses"); }
  },
  activities: {
    title: "Activities",
    primaryLabel: "Clues",
    secondaryLabel: "Collections",
    primary: function (row) { return row.acts.clues; },
    secondary: function (row) { return row.acts.collections; },
    formatPrimary: function (v) { return v.toLocaleString(); },
    formatSecondary: function (v) { return v.toLocaleString(); },
    gainKey: "clues",
    sideTitle: "Most completed",
    side: function (rows) { return topEntries(rows, "activities"); }
  }
};

export function renderTeamView(state, bucket, roster) {
  const section = el("section", "card full cardTeam");
  const metric = METRICS[state.teamMetric] || METRICS.skills;

  if (state.gim.loading && !state.gim.loaded) {
    section.appendChild(el("div", "gimLoading", "Loading team…"));
    return { className: "mainFill", children: [section] };
  }

  const byName = new Map(state.gim.results.map(function (r) { return [r.player, r]; }));
  const rows = buildRows(roster, byName, metric);

  const wrap = el("div", "teamWrap");
  wrap.appendChild(standings(rows, metric));
  // Always rendered now. Wide buckets put it beside the standings, narrow ones
  // stack it underneath and scroll - previously it was dropped entirely below
  // the `l` bucket, so it never appeared in a browser window.
  wrap.appendChild(sidePanel(rows, metric));

  section.appendChild(wrap);
  return { className: "mainFill", children: [section] };
}

function members(rows) {
  return rows.map(function (row) { return { name: row.name, data: row.raw }; });
}

function buildRows(roster, byName, metric) {
  return roster.map(function (member) {
    const result = byName.get(member.name);
    const data = result && result.data ? result.data : null;

    return {
      name: member.name,
      ok: !!data,
      skills: data ? skillTotals(data) : { level: 0, xp: 0 },
      acts: data
        ? activityTotals(data)
        : { bossKc: 0, uniqueBosses: 0, activityScore: 0, clues: 0, collections: 0 },
      today: data ? gains(member.name, data, 0) : null,
      week: data ? gains(member.name, data, 7) : null,
      depth: historyDepth(member.name),
      // Every skill at 99, or every skill at 200M, marks the whole row.
      tier: data ? playerTier(data.skills) : null,
      raw: data
    };
  }).sort(function (a, b) {
    const pb = metric.primary(b) - metric.primary(a);
    if (pb !== 0) return pb;
    return metric.secondary(b) - metric.secondary(a);
  });
}

// --- Standings -------------------------------------------------------------

function standings(rows, metric) {
  const panel = el("div", "teamPanel");
  panel.appendChild(el("div", "teamPanelTitle", metric.title));

  const table = el("div", "teamTable");
  table.appendChild(headerRow(metric));

  const max = Math.max(1, ...rows.map(metric.primary));

  // The max treatments belong to the Skills standings; on the boss and
  // activity boards a gold row would read as a boss or clue achievement.
  const showTier = metric === METRICS.skills;

  rows.forEach(function (row, i) {
    const tier = showTier ? row.tier : null;
    const node = applyTier(el("div", "teamRow"), tier, i);

    node.appendChild(el("div", "teamRank", "#" + (i + 1)));
    node.appendChild(el("div", "teamName mx-num" + (tier === "200" ? " prism" : ""), row.name));

    const bar = el("div", "teamBar mx-bar");
    const fill = el("div", "teamBarFill");
    fill.style.width = (metric.primary(row) / max) * 100 + "%";
    bar.appendChild(fill);
    node.appendChild(bar);

    node.appendChild(el("div", "teamCell teamLevel mx-num",
      row.ok ? metric.formatPrimary(metric.primary(row)) : "—"));
    node.appendChild(el("div", "teamCell teamXp",
      row.ok ? metric.formatSecondary(metric.secondary(row)) : "—"));
    node.appendChild(gainCell(row.today, row.depth, row.ok, metric.gainKey));
    node.appendChild(gainCell(row.week, row.depth, row.ok, metric.gainKey));

    table.appendChild(node);
  });

  panel.appendChild(table);
  panel.appendChild(el("div", "teamNote",
    "Gains come from this device's own daily snapshots, so they start from the day you first opened this page here."));
  return panel;
}

function headerRow(metric) {
  const head = el("div", "teamRow teamRowHead");
  const labels = ["", "Player", "", metric.primaryLabel, metric.secondaryLabel, "Today", "7 days"];
  labels.forEach(function (label, i) {
    const cls = i === 1 ? "teamName" : i === 2 ? "teamBar teamBarHead" : "teamCell";
    head.appendChild(el("div", cls, label));
  });
  return head;
}

function gainCell(gain, depth, ok, key) {
  if (!ok) return el("div", "teamCell teamGain", "—");
  // No snapshot at all, or none for this metric (a snapshot taken before the
  // metric was tracked). Saying "new" beats implying zero progress.
  if (!gain || gain[key] == null) {
    return el("div", "teamCell teamGain teamGainEmpty", depth ? "—" : "new");
  }
  if (gain[key] <= 0) return el("div", "teamCell teamGain teamGainEmpty", "0");

  const cell = el("div", "teamCell teamGain teamGainPositive",
    "+" + formatCompact(gain[key]));
  cell.title = "since " + gain.since;
  return cell;
}

// --- Side panel ------------------------------------------------------------

function sidePanel(rows, metric) {
  const panel = el("div", "teamPanel teamPanelSide");
  panel.appendChild(el("div", "teamPanelTitle", metric.sideTitle));

  const items = metric.side(rows);
  if (items.length === 0) {
    panel.appendChild(el("div", "teamEmpty", "No data yet"));
    return panel;
  }

  const list = el("div", "sideList");
  items.forEach(function (item) { list.appendChild(sideRow(item)); });
  panel.appendChild(list);
  return panel;
}

function sideRow(item) {
  const row = el("div", "sideRow");
  row.appendChild(img(item.iconUrl, item.iconAlt, "sideIcon"));

  const label = el("div", "sideLabel");
  label.appendChild(el("div", "sideMain", item.main));
  label.appendChild(el("div", "sideSub", item.sub));
  row.appendChild(label);

  const bar = el("div", "sideBar");
  const fill = el("div", "sideBarFill");
  fill.style.width = item.pct + "%";
  fill.style.background = item.color || "var(--accent)";
  bar.appendChild(fill);
  row.appendChild(bar);

  row.appendChild(el("div", "sideValue", item.value));
  return row;
}

// Across every member and every skill, the level-ups closest to popping.
// The most glanceable thing an ambient panel can show.
function upcomingLevels(rows) {
  return levelUpCandidates(members(rows)).slice(0, SIDE_LIMIT).map(function (c) {
    return {
      iconUrl: iconForSkill(c.skill),
      iconAlt: c.skill,
      main: c.skill + " " + (c.level + 1),
      sub: c.player,
      pct: c.pct,
      color: progressColor(c.pct),
      value: formatCompact(c.remaining)
    };
  });
}

// Team-wide totals per boss or per activity, biggest first, with whoever leads.
function topEntries(rows, kind) {
  const list = teamEntryTotals(members(rows), kind);
  if (list.length === 0) return [];
  const max = list[0].total || 1;

  return list.slice(0, SIDE_LIMIT).map(function (item) {
    return {
      iconUrl: iconForActivity(item.name),
      iconAlt: item.name,
      main: item.name,
      sub: item.leader ? item.leader + " leads with " + item.best.toLocaleString() : "",
      pct: (item.total / max) * 100,
      value: item.total.toLocaleString()
    };
  });
}