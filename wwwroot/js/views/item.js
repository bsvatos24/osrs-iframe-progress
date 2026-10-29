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
      centerSub: item.maxedMilestones ? "All milestones" : fmt(remaining) + " Remaining",
      centerHint: item.maxedMilestones ? "Complete" : "To next milestone"
    });
  }

  // A maxed skill measures against 200m XP rather than a non-existent level 100.
  if (item.primaryUnit === "xp-200m") {
    const capped = item.primaryCurrent >= MAX_SKILL_XP;
    return arcGauge({
      size: GAUGE_SIZE,
      value: item.primaryCurrent,
      max: MAX_SKILL_XP,
      tone: capped ? "prism" : "gold",
      labelTop: item.primaryLabelTop,
      centerMainParts: { top: formatCompact(item.primaryCurrent), bottom: "200m" },
      centerSub: capped ? "Maxed" : formatCompact(remaining) + " XP Left",
      centerHint: capped ? "200M reached" : "To 200m XP"
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
  const toward200m = item.secondaryUnit === "xp-200m";
  const capped = toward200m && remaining === 0;

  return arcGauge({
    size: GAUGE_SIZE,
    value: item.secondaryCurrent || 0,
    max: target,
    tone: capped ? "prism" : toward200m ? "gold" : null,
    labelTop: item.secondaryLabelTop,
    centerMainParts: {
      top: formatCompact(item.secondaryCurrent || 0),
      bottom: formatCompact(target)
    },
    centerSub: capped ? "Maxed" : formatCompact(remaining) + " XP Left",
    centerHint: capped ? "200M reached" : toward200m ? "To 200m XP" : "To 99"
  });
}