import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function PlayerMenu({ value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => options, [options]);

  // close on outside click
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // close on Esc
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="playerMenu" ref={wrapRef}>
      <button
        type="button"
        className="btn playerMenuBtn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title="Select player"
      >
        <span className="playerMenuValue">{value}</span>
        <span className={`playerMenuChevron ${open ? "open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="playerMenuPanel" role="listbox" aria-label="Select player">
          {items.map((name) => {
            const active = name === value;
            return (
              <button
                key={name}
                type="button"
                className={`playerMenuItem ${active ? "active" : ""}`}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                role="option"
                aria-selected={active}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
