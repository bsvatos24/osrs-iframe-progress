import { clamp } from "../lib/osrsXp";

type Props = {
  value: number;
  max: number;
  labelTop: string;

  // Either provide centerMain (single line) OR centerMainParts (fraction style)
  centerMain?: string;
  centerMainParts?: {
    top: string;      // current XP
    bottom: string;   // needed/target XP
  };

  centerSub?: string;
  centerHint?: string;

  textX?: number;
  mainY?: number;     // used for single-line main, OR as top line Y in fraction mode
  subY?: number;
  hintY?: number;

  // fraction spacing
  fracLineY?: number;
  fracBottomY?: number;

  // fraction line style
  fracLineWidth?: number;       // total width of the line
  fracLineStrokeWidth?: number; // thickness;
};

export function ArcGauge({
  value,
  max,
  labelTop,
  centerMain,
  centerMainParts,
  centerSub,
  centerHint,
  textX,
  mainY,
  subY,
  hintY,
  fracLineY,
  fracBottomY,
  fracLineWidth,
  fracLineStrokeWidth
}: Props) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);

  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const startAngle = (-210 * Math.PI) / 180;
  const endAngle = (30 * Math.PI) / 180;
  const sweep = endAngle - startAngle;

  const arcLen = r * sweep;
  const filledLen = (pct / 100) * arcLen;

  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);

  const largeArcFlag = 1;
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;

  const x = textX ?? cx;

  // Default Ys (tune these per your layout)
  const yTop = mainY ?? (cy - 40);

   // fraction: line + bottom text
  const yLine = fracLineY ?? (yTop + 15);
  const yBottom = fracBottomY ?? (yTop + 40);

  // Secondary lines below the main/fraction block
  const ySub = subY ?? (yTop + 70);
  const yHint = hintY ?? (yTop + 100);

  const lineWidth = fracLineWidth ?? 120;         // total width
  const lineHalf = lineWidth / 2;
  const lineStrokeW = fracLineStrokeWidth ?? 2;   // thickness

  return (
    <div className="gauge">
      <div className="gaugeTop">{labelTop}</div>

      <svg width={size} height={size} className="gaugeSvg" role="img" aria-label={labelTop}>
        <path d={d} className="gaugeTrack" strokeWidth={stroke} fill="none" />
        <path
          d={d}
          className="gaugeFill"
          strokeWidth={stroke}
          fill="none"
          style={{
            strokeDasharray: `${filledLen} ${Math.max(0, arcLen - filledLen)}`
          }}
        />

        {/* MAIN CENTER TEXT */}
        {centerMainParts ? (
          <>
            <text x={x} y={yTop} textAnchor="middle" className="gaugeTextMain">
              {centerMainParts.top}
            </text>
            <line
              x1={x - lineHalf}
              x2={x + lineHalf}
              y1={yLine}
              y2={yLine}
              className="gaugeFracLine"
              strokeWidth={lineStrokeW}
              strokeLinecap="round"
            />
            <text x={x} y={yBottom} textAnchor="middle" className="gaugeTextMain">
              {centerMainParts.bottom}
            </text>
          </>
        ) : (
          <text x={x} y={yTop} textAnchor="middle" className="gaugeTextMain">
            {centerMain ?? ""}
          </text>
        )}

        {/* SUB + HINT */}
        {centerSub ? (
          <text x={x} y={ySub} textAnchor="middle" className="gaugeTextSub">
            {centerSub}
          </text>
        ) : null}

        {centerHint ? (
          <text x={x} y={yHint} textAnchor="middle" className="gaugeTextHint">
            {centerHint}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}
