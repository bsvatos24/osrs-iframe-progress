import type { DisplayItem, Category } from "../lib/types";
import { HeaderLabel } from "./HeaderLabel";
import { ArcGauge } from "./ArcGauge";
import { RankBadge } from "./RankBadge";
import { MilestoneBar } from "./MilestoneBar";
import { FooterNav } from "./FooterNav";

type Props = {
  item?: DisplayItem;
  category: Category;
  isPinned: boolean;
  autoCycle: boolean;

  onToggleAuto: () => void;
  onPinToggle: () => void;
  onOpenPicker: () => void;
  onCategoryChange: (c: Category) => void;

  onPrev: () => void;
  onNext: () => void;
};

export function PageShell({
  item,
  category,
  isPinned,
  autoCycle,
  onToggleAuto,
  onPinToggle,
  onOpenPicker,
  onCategoryChange,
  onPrev,
  onNext
}: Props) {
  if (!item) {
    return (
      <div className="app">
        <div className="card">No items for this category.</div>
      </div>
    );
  }

  return (
    <div className="app">
      <HeaderLabel item={item} isPinned={isPinned} />

      <div className="grid">
        <div className="card">
          <ArcGauge
            labelTop={item.primaryLabelTop}
            labelBottom={`${formatValue(item.primaryCurrent)} / ${formatValue(item.primaryTarget)}`}
            subLabel={item.primaryLabelBottom}
            value={item.primaryCurrent}
            max={item.primaryTarget}
          />
        </div>

        <div className="card">
          {item.secondaryType === "gauge" ? (
            <ArcGauge
              labelTop={item.secondaryLabelTop}
              labelBottom={`${formatValue(item.secondaryCurrent ?? 0)} / ${formatValue(item.secondaryTarget ?? 1)}`}
              subLabel={item.secondaryLabelBottom ?? ""}
              value={item.secondaryCurrent ?? 0}
              max={item.secondaryTarget ?? 1}
            />
          ) : (
            <RankBadge labelTop={item.secondaryLabelTop} valueText={item.secondaryLabelBottom ?? ""} />
          )}
        </div>

        <div className="card full">
          <MilestoneBar
            milestones={item.milestones}
            current={item.milestoneCurrent}
            unit={item.milestoneUnit}
          />
        </div>
      </div>

      <FooterNav
        category={category}
        autoCycle={autoCycle}
        isPinned={isPinned}
        onPrev={onPrev}
        onNext={onNext}
        onToggleAuto={onToggleAuto}
        onOpenPicker={onOpenPicker}
        onPinToggle={onPinToggle}
        onCategoryChange={onCategoryChange}
      />
    </div>
  );
}

function formatValue(n: number) {
  // You can refine this later (xp formatting like 1.5m etc)
  return n.toLocaleString();
}
