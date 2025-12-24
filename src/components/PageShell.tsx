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
              value={item.primaryCurrent}
              max={item.primaryTarget}
              labelTop={item.primaryLabelTop}
              centerMainParts={{
                top: `${fmt(item.primaryCurrent)}`,
                bottom: `${fmt(item.primaryTarget)}`
              }}
              centerSub={`${fmt(item.primaryTarget - item.primaryCurrent)} XP Left`}
              centerHint={item.milestoneUnit === "kills" ? "To next milestone" : "To next level"}
            />
        </div>

        <div className="card">
          {item.secondaryType === "gauge" ? (
            <ArcGauge
              value={item.primaryCurrent}
              max={item.primaryTarget}
              labelTop={item.primaryLabelTop}
              centerMainParts={{
                top: `${fmt(item.secondaryCurrent ?? 0)}`,
                bottom: `${fmt(item.secondaryTarget ?? 1)}`
              }}
              centerSub={`${fmt(item.primaryTarget - item.primaryCurrent)} XP Left`}
              centerHint="To 99"
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

function fmt(n: number) {
  return Math.max(0, n).toLocaleString();
}
