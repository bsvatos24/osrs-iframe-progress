export function RankBadge({ labelTop, valueText }: { labelTop: string; valueText: string }) {
  return (
    <div className="rankWrap">
      <div className="gaugeTop">{labelTop}</div>
      <div className="rankCircle">
        <div className="rankValue">{valueText}</div>
      </div>
      <div className="gaugeBottom">
        <div className="gaugeSub">Global rank</div>
      </div>
    </div>
  );
}
