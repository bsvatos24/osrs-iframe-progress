import type { DisplayItem } from "../lib/types";

export function HeaderLabel({ item, isPinned }: { item: DisplayItem; isPinned: boolean }) {
  return (
    <div className="header">
      <div className="headerCenter">
        <img className="icon" src={item.iconUrl} alt={item.name} />
        <div className="headerText">
          <div className="titleRow">
            <span className="title">{item.name}</span>
            {isPinned && <span className="pill">Pinned</span>}
          </div>
          <span className="subtitle">{item.category.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
