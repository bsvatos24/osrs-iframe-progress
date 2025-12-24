import type { Category } from "../lib/types";

type Props = {
  category: Category;
  autoCycle: boolean;
  isPinned: boolean;

  onPrev: () => void;
  onNext: () => void;
  onToggleAuto: () => void;
  onOpenPicker: () => void;
  onPinToggle: () => void;
  onCategoryChange: (c: Category) => void;
};

export function FooterNav({
  category,
  autoCycle,
  isPinned,
  onPrev,
  onNext,
  onToggleAuto,
  onOpenPicker,
  onPinToggle,
  onCategoryChange
}: Props) {
  return (
    <div className="footer">
      <div className="tabs">
        <Tab active={category === "skills"} onClick={() => onCategoryChange("skills")}>Skills</Tab>
        <Tab active={category === "bosses"} onClick={() => onCategoryChange("bosses")}>Bosses</Tab>
        <Tab active={category === "activities"} onClick={() => onCategoryChange("activities")}>Activities</Tab>
      </div>

      <div className="controls">
        <button className="btn" onClick={onPrev} title="Previous">◀</button>
        <button className="btn" onClick={onNext} title="Next">▶</button>

        <button className={`btn ${autoCycle ? "btnOn" : ""}`} onClick={onToggleAuto}>
          {autoCycle ? "Auto: On" : "Auto: Off"}
        </button>

        <button className="btn" onClick={onOpenPicker}>Pick</button>

        <button className={`btn ${isPinned ? "btnPin" : ""}`} onClick={onPinToggle}>
          {isPinned ? "Unpin" : "Pin"}
        </button>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: any) {
  return (
    <button className={`tab ${active ? "tabActive" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
