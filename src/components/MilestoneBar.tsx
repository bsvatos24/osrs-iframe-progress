import { clamp } from "../lib/osrsXp";

type Props = {
  title?: string;
  milestones: number[];
  current: number;
  unit: "level" | "kills";
};

export function MilestoneBar({ milestones, current }: Props) {
  const start = 0;
  const points = [start, ...milestones];

  return (
    <div className="milestones">
      <div className="milestoneTitle">Overall Milestones</div>

      <div className="milestoneRow customScroll">
        {points.map((p, idx) => {
          if (idx === 0) {
            return (
              <div key={`b-${idx}`} className="bubble dim">
                {p}
              </div>
            );
          }

          const prev = points[idx - 1];
          const segPct = segmentFillPct(current, prev, p);

          return (
            <div key={`seg-${idx}`} className="segWrap">
              <div className="segTrack">
                <div className="segFill" style={{ width: `${segPct}%` }} />
              </div>
              <div className={`bubble ${current >= p ? "bright" : "dim"}`}>{p}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function segmentFillPct(current: number, from: number, to: number) {
  if (to <= from) return 0;
  if (current <= from) return 0;
  if (current >= to) return 100;
  return clamp(((current - from) / (to - from)) * 100, 0, 100);
}
