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
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>

        <input
          className="input"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="pickerGrid">
          {filtered.map((it) => {
            const isPinned = pinnedId === it.id;

            return (
              <button
                key={it.id}
                type="button"
                className={`pickerCell ${isPinned ? "pickerCellPinned" : ""}`}
                onClick={() => onSelect(it.id)}
                title={it.name}
              >
                <img className="pickerIcon" src={it.iconUrl} alt="" />
                <div className="pickerName">{it.name}</div>

                <div className="pickerPinRow">
                  <span className="pickerPinText">{isPinned ? "Pinned" : "Pin"}</span>
                  <button
                    type="button"
                    className={`btn btnMini ${isPinned ? "btnPin" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPin(it.id);
                    }}
                    aria-label={isPinned ? "Unpin" : "Pin"}
                  >
                    📌
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
