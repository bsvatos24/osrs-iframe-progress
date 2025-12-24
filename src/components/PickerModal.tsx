import { useMemo, useState } from "react";
import type { DisplayItem } from "../lib/types";

type Props = {
  open: boolean;
  title: string;
  items: DisplayItem[];
  pinnedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
};

export function PickerModal({ open, title, items, pinnedId, onClose, onSelect, onPin }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => x.name.toLowerCase().includes(s));
  }, [items, q]);

  if (!open) return null;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <input
          className="input"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="list">
          {filtered.map((it) => {
            const pinned = pinnedId === it.id;
            return (
              <div key={it.id} className="listRow">
                <button className="listMain" onClick={() => onSelect(it.id)}>
                  <img className="listIcon" src={it.iconUrl} alt="" />
                  <span>{it.name}</span>
                </button>
                <button className={`btn ${pinned ? "btnPin" : ""}`} onClick={() => onPin(it.id)}>
                  {pinned ? "Pinned" : "Pin"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
