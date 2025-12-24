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

        {/* GRID instead of rows */}
        <div className="pickerGrid">
          {filtered.map((it) => {
            const pinned = pinnedId === it.id;

            return (
              <button
                type="button"
                key={it.id}
                className={`pickerTile ${pinned ? "pickerTilePinned" : ""}`}
                onClick={() => onSelect(it.id)}
                title={it.name}
              >
                <img className="pickerTileIcon" src={it.iconUrl} alt="" />
                <div className="pickerTileName">{it.name}</div>
              </button>
            );
          })}
        </div>

        {/* Optional pin controls row (only if you still want pinning in modal) */}
        {/* If you want pin on right-click instead, tell me and I’ll wire it. */}
        <div style={{ display: "none" }}>
          {filtered.map((it) => (
            <button type="button" key={it.id} onClick={() => onPin(it.id)}>{it.name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
