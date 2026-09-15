// ============================================================
// Skills / Bosses / Activities: one cycling item, two gauges, milestones.
// ============================================================

import { el } from "../dom.js";
import { arcGauge, milestoneBar, rankBadge } from "../components.js";
import { fmt, formatCompact } from "../format.js";
import { MAX_SKILL_XP } from "../osrs.js";

const GAUGE_SIZE = 200;

export function renderItemView(state) {
  const current = state.current;
  const msCard = el("section", "card full cardMilestones");
  if (current) {
    msCard.appendChild(milestoneBar(current.milestones, current.milestoneCurrent, current.milestoneUnit));
  }

  return {
    className: "grid",
    children: [
      card("cardArc", state, current, primaryGauge),
      card("cardArc", state, current, secondaryGauge),
      msCard
    ]
  };
}

function card(className, state, current, build) {
  const section = el("section", "card " + className);
  if (state.loading && !current) section.appendChild(el("div", "cardMsg", "Loading…"));
  else if (state.error && !current) section.appendChild(el("div", "cardMsg", state.error));
  else if (!current) section.appendChild(el("div", "cardMsg", "No data"));
  else section.appendChild(build(current));
  return section;
}

function primaryGauge(item) {
  const remaining = Math.max(0, item.primaryTarget - item.primaryCurrent);

  if (item.primaryUnit === "kills") {
    return arcGauge({
      size: GAUGE_SIZE,
      value: item.primaryCurrent,
      max: item.primaryTarget,
      labelTop: item.primaryLabelTop,
      centerMainParts: { top: fmt(item.primaryCurrent), bottom: fmt(item.primaryTarget) },
      centerSub: fmt(remaining) + " Remaining",
      centerHint: "To next milestone"
    });
  }

  // A maxed skill measures against 200m XP rather than a non-existent level 100.
  if (item.primaryUnit === "xp-200m") {
    return arcGauge({
      size: GAUGE_SIZE,
      value: item.primaryCurrent,
      max: MAX_SKILL_XP,
      labelTop: item.primaryLabelTop,
      centerMainParts: { top: formatCompact(item.primaryCurrent), bottom: "200m" },
      centerSub: formatCompact(remaining) + " XP Left",
      centerHint: "To 200m XP"
    });
  }

  return arcGauge({
    size: GAUGE_SIZE,
    value: item.primaryCurrent,
    max: item.primaryTarget,
    labelTop: item.primaryLabelTop,
    centerMainParts: { top: fmt(item.primaryCurrent), bottom: fmt(item.primaryTarget) },
    centerSub: fmt(remaining) + " XP Left",
    centerHint: "To next level"
  });
}

function secondaryGauge(item) {
  if (item.secondaryType === "rank") {
    return rankBadge(item.secondaryLabelTop, item.secondaryCurrent);
  }

  const target = item.secondaryTarget || 1;
  const remaining = Math.max(0, target - (item.secondaryCurrent || 0));

  return arcGauge({
    size: GAUGE_SIZE,
    value: item.secondaryCurrent || 0,
    max: target,
    labelTop: item.secondaryLabelTop,
    centerMainParts: {
      top: formatCompact(item.secondaryCurrent || 0),
      bottom: formatCompact(target)
    },
    centerSub: formatCompact(remaining) + " XP Left",
    centerHint: item.secondaryUnit === "xp-200m" ? "To 200m XP" : "To 99"
  });
}