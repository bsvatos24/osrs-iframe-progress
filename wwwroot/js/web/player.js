// ============================================================
// Players: one member in full - XP gains, every skill, bosses, clues and
// activities.
// ============================================================

import { applyTier, el } from "../dom.js";
import { BOSS_NAMES, SKILL_GRID_ORDER } from "../constants.js";
import {
  levelProgress, maxTier, nextMilestone, pctTo200m, playerTier, prevMilestone, segmentFillPct,
  xpForLevel, KC_MILESTONES, MAX_SKILL_LEVEL, MAX_SKILL_XP
} from "../osrs.js";
import { formatCompact, formatRank, iconForActivity, iconForSkill } from "../format.js";
import { activityTotals, hasSkillLevel, isRanked, rankedValue, skillTotals } from "../model.js";
import { gains } from "../history.js";
import { card, icon, link, list, notice, pageHead, playerHref, stats, toolCard } from "./parts.js";
import { gainingCard, isOnlyTraining, trainingToggle, weeklyGains } from "./training.js";

const LIST_LIMIT = 8;
const CLUE_TIERS = ["beginner", "easy", "medium", "hard", "elite", "master"];
const CLUE_ROW = /^Clue Scrolls \(/;

export function playerPage(members, member) {
  const page = document.createDocumentFragment();
  page.appendChild(chips(members, member));

  const tier = member.data ? playerTier(member.data.skills) : null;
  const head = pageHead(member.name, "Group Ironman");
  if (tier === "200") head.querySelector("h1").className = "prism";
  page.appendChild(head);

  if (!member.data) {
    page.appendChild(notice("Couldn't load " + member.name + "'s hiscores. " +
      "The name may have changed, or the hiscores may be down. It will retry on the next refresh.", true));
    return page;
  }

  const skills = member.data.skills.filter(function (s) { return s.name !== "Overall"; });
  page.appendChild(playerStats(member, skills));
  page.appendChild(gainingCard(member));

  // Tiles carry this week's gain; the toggle fades the ones without any.
  // Without history there is nothing to highlight, so no toggle either.
  const weekly = weeklyGains(member);
  const grid = skillGrid(skills, weekly, weekly && isOnlyTraining());
  page.appendChild(weekly
    ? toolCard("Skills", "In the order of the game's skills tab", trainingToggle(), grid)
    : card("Skills", "In the order of the game's skills tab", grid));

  const cols = el("div", "cols");
  cols.appendChild(card("Bosses", "Most killed first",
    list(bossRows(member.data), LIST_LIMIT, "No boss kills yet.")));
  const side = el("div", "stack");
  side.appendChild(clueCard(member.data));
  side.appendChild(card("Activities", "Minigames and other hiscore entries",
    list(activityRows(member.data), LIST_LIMIT, "Nothing on the hiscores yet.")));
  cols.appendChild(side);
  page.appendChild(cols);

  return page;
}

function chips(members, current) {
  const nav = el("nav", "chips");
  nav.setAttribute("aria-label", "Player");
  members.forEach(function (m) {
    const chip = link(playerHref(m.name), "chip", m.name);
    if (m === current) chip.setAttribute("aria-current", "page");
    nav.appendChild(chip);
  });
  return nav;
}

function playerStats(member, skills) {
  const totals = skillTotals(member.data);
  const acts = activityTotals(member.data);
  const today = gains(member.name, member.data, 0);
  const nines = skills.filter(function (s) { return rankedValue(s.level) >= MAX_SKILL_LEVEL; }).length;
  const capped = skills.filter(function (s) { return rankedValue(s.xp) >= MAX_SKILL_XP; }).length;

  return stats([
    { label: "Total level", value: totals.level.toLocaleString(),
      note: "of " + (skills.length * MAX_SKILL_LEVEL).toLocaleString() },
    { label: "Total XP", value: formatCompact(totals.xp),
      note: today && today.xp ? "+" + formatCompact(today.xp) + " today" : null },
    { label: "99s", value: nines + " / " + skills.length,
      note: capped ? capped + " at 200M" : null },
    { label: "Boss kills", value: acts.bossKc.toLocaleString(),
      note: acts.uniqueBosses ? acts.uniqueBosses + " bosses" : null }
  ]);
}

function skillGrid(skills, weekly, dimIdle) {
  const byName = new Map(skills.map(function (s) { return [s.name, s]; }));
  // The curated order first; anything the game adds later still shows, last.
  const ordered = SKILL_GRID_ORDER.filter(function (n) { return byName.has(n); })
    .concat(skills.map(function (s) { return s.name; })
      .filter(function (n) { return !SKILL_GRID_ORDER.includes(n); }));

  const grid = el("div", "skills");
  ordered.forEach(function (name, i) {
    const gained = weekly ? weekly.get(name) || 0 : 0;
    const tile = skillTile(byName.get(name), i, gained);
    if (dimIdle && !gained) tile.classList.add("idle");
    grid.appendChild(tile);
  });
  return grid;
}

function skillTile(s, i, gained) {
  const listed = hasSkillLevel(s);
  const level = Math.max(1, rankedValue(s.level) || 1);
  const xp = rankedValue(s.xp);
  const tier = maxTier(level, xp);

  const tile = applyTier(el("div", "sk"), tier, i);
  tile.title = listed ? s.name + ": " + xp.toLocaleString() + " XP" : s.name + ": not on the hiscores";
  tile.appendChild(icon(iconForSkill(s.name), s.name));
  const nm = el("span", "nm");
  nm.appendChild(el("span", "nm-text", s.name));
  if (gained) {
    const pill = el("span", "pill", "+" + formatCompact(gained));
    pill.title = gained.toLocaleString() + " XP in the last 7 days";
    nm.appendChild(pill);
  }
  tile.appendChild(nm);

  const lv = el("span", "lv mx-num");
  if (tier === "200") lv.appendChild(el("span", "prism", String(level)));
  else lv.textContent = listed ? String(level) : "\u2013";
  tile.appendChild(lv);

  let pct;
  let note;
  if (!listed) {
    pct = 0;
    note = "Not on the hiscores yet";
  } else if (tier === "200") {
    pct = 100;
    note = "200M";
  } else if (tier === "max") {
    // At 99 the bar counts toward 200M instead of a level 100 that does not
    // exist.
    pct = pctTo200m(xp);
    note = formatCompact(xp) + " \u00B7 " + pct.toFixed(1) + "% to 200M";
  } else {
    pct = levelProgress(level, xp).pct;
    note = formatCompact(Math.max(0, xpForLevel(level + 1) - xp)) + " to " + (level + 1);
  }

  const bottom = el("div", "bottom");
  const bar = el("div", "bar mx-bar");
  const fill = el("i");
  fill.style.width = pct.toFixed(1) + "%";
  bar.appendChild(fill);
  bottom.appendChild(bar);
  bottom.appendChild(el("span", "note", note));
  tile.appendChild(bottom);
  return tile;
}

function bossRows(data) {
  return (data.activities || [])
    .filter(function (a) { return BOSS_NAMES.has(a.name) && rankedValue(a.score) > 0; })
    .sort(function (a, b) { return rankedValue(b.score) - rankedValue(a.score) || a.name.localeCompare(b.name); })
    .map(function (a) {
      const kc = rankedValue(a.score);
      const next = nextMilestone(kc, KC_MILESTONES);
      return {
        iconUrl: iconForActivity(a.name),
        iconAlt: a.name,
        main: a.name,
        sub: next === null ? "Every milestone done" : "Next milestone " + next.toLocaleString(),
        pct: next === null ? 100 : segmentFillPct(kc, prevMilestone(kc, KC_MILESTONES), next),
        value: kc.toLocaleString() + " KC"
      };
    });
}

function activityRows(data) {
  return (data.activities || [])
    .filter(function (a) {
      return !BOSS_NAMES.has(a.name) && !CLUE_ROW.test(a.name) && rankedValue(a.score) > 0;
    })
    .map(function (a) {
      return {
        iconUrl: iconForActivity(a.name),
        iconAlt: a.name,
        main: a.name,
        sub: isRanked(a.rank) ? "Rank " + formatRank(a.rank) : null,
        value: rankedValue(a.score).toLocaleString()
      };
    });
}

function clueCard(data) {
  const byName = new Map((data.activities || []).map(function (a) { return [a.name, a]; }));
  const all = rankedValue(byName.get("Clue Scrolls (all)") && byName.get("Clue Scrolls (all)").score);

  const grid = el("div", "clues");
  CLUE_TIERS.forEach(function (tier) {
    const label = tier[0].toUpperCase() + tier.slice(1);
    const name = "Clue Scrolls (" + tier + ")";
    const row = byName.get(name);
    const cell = el("div", "clue");
    cell.appendChild(icon(iconForActivity(name), label + " clues"));
    cell.appendChild(el("b", null, rankedValue(row && row.score).toLocaleString()));
    cell.appendChild(el("span", null, label));
    grid.appendChild(cell);
  });

  return card("Clue scrolls", all.toLocaleString() + " completed", grid);
}