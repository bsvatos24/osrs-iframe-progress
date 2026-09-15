// ============================================================
// Reusable UI pieces: gauges, badges, milestone bars, tiles, icons.
// Pure builders - they take data and return nodes, and never read state.
// ============================================================

import { clamp, segmentFillPct } from "./osrs.js";
import { fmt, formatRank, progressColor } from "./format.js";
import { button, el, img, svg, svgText } from "./dom.js";

// --- Arc gauge -------------------------------------------------------------
// `size` is supplied by the caller so the gauge can scale with its container
// instead of being pinned at the old hard-coded 200px.
export function arcGauge(opts) {
  const size = opts.size || 200;
  const stroke = Math.max(8, Math.round(size * 0.07));
  const r = (size - stroke) / 2;
  const c = size / 2;

  const pct = opts.max <= 0 ? 0 : clamp((opts.value / opts.max) * 100, 0, 100);

  // A 240-degree arc opening downward: -210deg to +30deg.
  const startAngle = (-210 * Math.PI) / 180;
  const endAngle = (30 * Math.PI) / 180;
  const arcLen = r * (endAngle - startAngle);
  const filledLen = (pct / 100) * arcLen;

  const start = polar(c, c, r, startAngle);
  const end = polar(c, c, r, endAngle);
  const path = "M " + start.x + " " + start.y +
    " A " + r + " " + r + " 0 1 1 " + end.x + " " + end.y;

  const wrapper = el("div", "gauge");
  wrapper.appendChild(el("div", "gaugeTop", opts.labelTop));

  const root = svg("svg", {
    viewBox: "0 0 " + size + " " + size,
    class: "gaugeSvg",
    role: "img",
    "aria-label": opts.labelTop + ", " + pct.toFixed(0) + " percent"
  });

  root.appendChild(svg("path", {
    d: path, class: "gaugeTrack", "stroke-width": stroke, fill: "none"
  }));

  const fill = svg("path", {
    d: path, class: "gaugeFill", "stroke-width": stroke, fill: "none"
  });
  fill.style.strokeDasharray = filledLen + " " + Math.max(0, arcLen - filledLen);
  root.appendChild(fill);

  // Text block, positioned relative to the arc centre so it scales with size.
  const yTop = c - size * 0.20;
  const rule = yTop + size * 0.075;
  const yBottom = yTop + size * 0.20;
  const ySub = yTop + size * 0.35;
  const yHint = yTop + size * 0.50;

  if (opts.centerMainParts) {
    root.appendChild(svgText(c, yTop, "gaugeTextMain", opts.centerMainParts.top));
    root.appendChild(svg("line", {
      x1: c - size * 0.30, x2: c + size * 0.30, y1: rule, y2: rule,
      class: "gaugeFracLine", "stroke-width": 2, "stroke-linecap": "round"
    }));
    root.appendChild(svgText(c, yBottom, "gaugeTextMain", opts.centerMainParts.bottom));
  }
  if (opts.centerSub) root.appendChild(svgText(c, ySub, "gaugeTextSub", opts.centerSub));
  if (opts.centerHint) root.appendChild(svgText(c, yHint, "gaugeTextHint", opts.centerHint));

  wrapper.appendChild(root);
  return wrapper;
}

function polar(cx, cy, r, angleRad) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

// --- Rank badge ------------------------------------------------------------
export function rankBadge(labelTop, rank) {
  const wrapper = el("div", "rankWrap");
  wrapper.appendChild(el("div", "gaugeTop", labelTop));

  const circle = el("div", "rankCircle");
  circle.appendChild(el("div", "rankValue", formatRank(rank)));
  wrapper.appendChild(circle);

  wrapper.appendChild(el("div", "gaugeSub", "Global rank"));
  return wrapper;
}

// --- Milestone bar ---------------------------------------------------------
export function milestoneBar(milestones, current, unit) {
  const wrapper = el("div", "milestones");
  wrapper.appendChild(el("div", "milestoneTitle",
    unit === "kills" ? "Kill-count milestones" : "Level milestones"));

  const row = el("div", "milestoneRow customScroll");
  const points = [0].concat(milestones);

  points.forEach(function (point, idx) {
    if (idx === 0) {
      row.appendChild(el("div", "bubble dim", compactMilestone(point)));
      return;
    }

    const segWrap = el("div", "segWrap");
    const segTrack = el("div", "segTrack");
    const segFill = el("div", "segFill");
    segFill.style.width = segmentFillPct(current, points[idx - 1], point) + "%";
    segTrack.appendChild(segFill);
    segWrap.appendChild(segTrack);
    segWrap.appendChild(el("div", "bubble " + (current >= point ? "bright" : "dim"),
      compactMilestone(point)));
    row.appendChild(segWrap);
  });

  wrapper.appendChild(row);
  return wrapper;
}

// 10000 does not fit in a 44px bubble.
function compactMilestone(n) {
  if (n >= 1000) return (n / 1000) + "k";
  return String(n);
}

// --- Skill tile (Total view) ----------------------------------------------
export function skillTile(item) {
  const level = item.skillLevel || 0;
  const pct = clamp(item.levelProgressPct || 0, 0, 100);

  const tile = el("div", "skillTile");
  const top = el("div", "skillTileTop");
  top.appendChild(img(item.iconUrl, item.name, "skillTileIcon"));
  top.appendChild(el("div", "skillTileName", item.name));
  top.appendChild(el("div", "skillTileLevel", level));
  tile.appendChild(top);

  const bar = el("div", "skillTileBar");
  const barFill = el("div", "skillTileBarFill");
  barFill.style.width = pct + "%";
  barFill.style.backgroundColor = progressColor(pct);
  bar.appendChild(barFill);
  tile.appendChild(bar);
  return tile;
}

// --- Stat pair -------------------------------------------------------------
export function statPair(label, value) {
  const stat = el("div", "totalFooterStat");
  stat.appendChild(el("div", "totalFooterLabel", label));
  stat.appendChild(el("div", "totalFooterValue", value));
  return stat;
}

// --- Icons ---------------------------------------------------------------
export function refreshIcon(spinning) {
  const root = svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true",
    class: spinning ? "spin" : "" });
  root.appendChild(svg("path", {
    d: "M21 12a9 9 0 1 1-2.64-6.36", fill: "none", stroke: "currentColor",
    "stroke-width": 2, "stroke-linecap": "round"
  }));
  root.appendChild(svg("path", {
    d: "M21 3v7h-7", fill: "none", stroke: "currentColor",
    "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round"
  }));
  return root;
}

export function gridIcon() {
  const root = svg("svg", { viewBox: "0 0 18 18", "aria-hidden": "true" });
  [[2, 2], [11, 2], [2, 11], [11, 11]].forEach(function (p) {
    root.appendChild(svg("rect", { x: p[0], y: p[1], width: 5, height: 5, rx: 1 }));
  });
  return root;
}

export function iconButton(label, iconNode, onClick, disabled) {
  const btn = button("iconBtn", null, onClick);
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.disabled = !!disabled;
  btn.appendChild(iconNode);
  return btn;
}

export { fmt };