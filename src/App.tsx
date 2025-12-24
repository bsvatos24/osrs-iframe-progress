import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, DisplayItem } from "./lib/types";
import { fetchHiscores } from "./lib/hiscoresApi";
import { mapHiscoresToDisplayItems } from "./lib/mapToDisplayItems";

import { ArcGauge } from "./components/ArcGauge";
import { RankBadge } from "./components/RankBadge";
import { MilestoneBar } from "./components/MilestoneBar";
import { PickerModal } from "./components/PickerModal";

import "./styles.css";

const DEFAULT_PLAYER = "BenjiFresh91";

export default function App() {
  const [player, setPlayer] = useState(DEFAULT_PLAYER);
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [category, setCategory] = useState<Category>("skills");
  const [index, setIndex] = useState(0);

  const [pinned, setPinned] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => items.filter((i) => i.category === category),
    [items, category]
  );

  const current = filtered[index] ?? null;

  // Jump to item by id within current category
  function jumpToId(id: string) {
    const idx = filtered.findIndex((x) => x.id === id);
    if (idx >= 0) setIndex(idx);
  }

  /**
   * Load data helper:
   * - if keepSelection = true, we keep category + current item (by id if possible)
   * - never touches pinned / pinnedId
   */
  const loadData = useCallback(
    async (opts?: { keepSelection?: boolean }) => {
      const keepSelection = opts?.keepSelection ?? false;

      const prevCategory = category;
      const prevIndex = index;
      const prevId = current?.id ?? null;

      const ac = new AbortController();

      setError(null);
      if (keepSelection) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await fetchHiscores(player, ac.signal);
        const mapped = mapHiscoresToDisplayItems(data);
        setItems(mapped);

        if (keepSelection) {
          // rebuild filtered list for the same category
          const nextFiltered = mapped.filter((i) => i.category === prevCategory);

          let nextIndex = 0;

          // prefer ID match if possible
          if (prevId) {
            const found = nextFiltered.findIndex((x) => x.id === prevId);
            if (found >= 0) nextIndex = found;
            else nextIndex = Math.min(prevIndex, Math.max(0, nextFiltered.length - 1));
          } else {
            nextIndex = Math.min(prevIndex, Math.max(0, nextFiltered.length - 1));
          }

          setCategory(prevCategory);
          setIndex(nextIndex);
        } else {
          // initial load / player change: reset selection
          setIndex(0);
        }
      } catch (e: unknown) {
        if ((e as any)?.name === "AbortError") return;
        setError((e as Error).message ?? "Unknown error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }

      return () => ac.abort();
    },
    [player, category, index, current?.id]
  );

  // Initial fetch + when player changes (reset selection)
  useEffect(() => {
    loadData({ keepSelection: false });
  }, [player, loadData]);

  // Auto cycle (only if not pinned and we have items)
  useEffect(() => {
    if (pinned || pinnedId) return;
    if (filtered.length <= 1) return;

    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % filtered.length);
    }, 6000);

    return () => window.clearInterval(t);
  }, [pinned, pinnedId, filtered.length]);

  // When category changes, just reset index (DO NOT reset pin states)
  useEffect(() => {
    setIndex(0);
  }, [category]);

  // If pinnedId is set, always keep us on it (within current category)
  useEffect(() => {
    if (!pinnedId) return;

    const idx = filtered.findIndex((x) => x.id === pinnedId);
    if (idx >= 0) {
      setPinned(true);
      setIndex(idx);
    }
  }, [pinnedId, filtered]);

  function onRefresh() {
    // re-fetch, keep same selection + pinned status
    loadData({ keepSelection: true });
  }

  return (
    <div className="app">
      <header className="header">
        {/* top-right buttons */}
        <div className="headerActions">
          <button
            className="iconBtn"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            disabled={loading || refreshing}
          >
            <RefreshIcon spinning={refreshing} />
          </button>

          <button
            className="iconBtn"
            onClick={() => setPickerOpen(true)}
            aria-label="Pick item"
            title="Pick item"
            disabled={loading}
          >
            <GridIcon />
          </button>
        </div>

        <div className="headerCenter">
          <div className="headerPlayer">{player}</div>

          <div className="headerItemRow">
            <div className="iconWrap">
              {current?.iconUrl ? (
                <img className="icon" src={current.iconUrl} alt={current.name} />
              ) : null}
            </div>

            <div className="title">
              {current
                ? current.category === "skills"
                  ? `${current.name} - ${current.skillLevel ?? current.milestoneCurrent}`
                  : current.name
                : loading
                ? "Loading..."
                : "No data"}
            </div>
          </div>

          {error ? <div style={{ marginTop: 6, color: "rgba(255,255,255,0.75)" }}>{error}</div> : null}
        </div>
      </header>

      <main className="grid">
        {/* LEFT ARC */}
        <section className="card cardArc">
          {loading ? (
            <div>Loading…</div>
          ) : error ? (
            <div>{error}</div>
          ) : current ? (
            <ArcGauge
              value={current.primaryCurrent}
              max={current.primaryTarget}
              labelTop={current.primaryLabelTop}
              centerMainParts={{
                top: `${fmt(current.primaryCurrent)}`,
                bottom: `${fmt(current.primaryTarget)}`
              }}
              centerSub={`${fmt(current.primaryTarget - current.primaryCurrent)} XP Left`}
              centerHint={current.milestoneUnit === "kills" ? "To next milestone" : "To next level"}
            />
          ) : (
            <div>No item</div>
          )}
        </section>

        {/* RIGHT ARC OR RANK */}
        <section className="card cardArc">
          {loading ? (
            <div>Loading…</div>
          ) : error ? (
            <div>{error}</div>
          ) : current ? (
            current.secondaryType === "rank" ? (
              <RankBadge
                labelTop={current.secondaryLabelTop}
                valueText={formatRank(current.secondaryCurrent ?? -1)}
              />
            ) : (
              <ArcGauge
                value={current.secondaryCurrent ?? 0}
                max={current.secondaryTarget ?? 1}
                labelTop={current.secondaryLabelTop}
                centerMainParts={{
                  top: `${fmt(current.secondaryCurrent ?? 0)}`,
                  bottom: `${fmt(current.secondaryTarget ?? 1)}`
                }}
                centerSub={`${fmt((current.secondaryTarget ?? 0) - (current.secondaryCurrent ?? 0))} XP Left`}
                centerHint="To 99"
              />
            )
          ) : (
            <div>No item</div>
          )}
        </section>

        {/* MILESTONES */}
        <section className="card full">
          {current ? (
            <MilestoneBar
              title={current.milestoneUnit === "level" ? "Level Milestones" : "Killcount Milestones"}
              milestones={current.milestones}
              current={current.milestoneCurrent}
              unit={current.milestoneUnit}
            />
          ) : null}
        </section>
      </main>

      <footer className="footer">
        <div className="tabs">
          <button
            className={`tab ${category === "skills" ? "tabActive" : ""}`}
            onClick={() => setCategory("skills")}
          >
            Skills
          </button>
          <button
            className={`tab ${category === "bosses" ? "tabActive" : ""}`}
            onClick={() => setCategory("bosses")}
          >
            Bosses
          </button>
          <button
            className={`tab ${category === "activities" ? "tabActive" : ""}`}
            onClick={() => setCategory("activities")}
          >
            Activities
          </button>
        </div>

        <div className="controls">
          <button
            className={`btn ${pinned || pinnedId ? "btnPin" : ""}`}
            onClick={() => {
              // Toggle manual pin; if pinning manually, clear pinnedId
              setPinned((p) => {
                const next = !p;
                if (next) setPinnedId(null);
                return next;
              });

              // If unpinning manually, also clear pinnedId (so cycling can resume)
              if (pinned || pinnedId) {
                setPinnedId(null);
              }
            }}
          >
            {pinned || pinnedId ? "Pinned" : "Pin"}
          </button>

          <button
            className="btn"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={filtered.length === 0}
          >
            Prev
          </button>

          <button
            className="btn"
            onClick={() => setIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0))}
            disabled={filtered.length === 0}
          >
            Next
          </button>

          <input
            className="input"
            style={{ width: 180 }}
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            placeholder="Player name"
          />
        </div>
      </footer>

      {/* PICKER MODAL */}
      <PickerModal
        open={pickerOpen}
        title={`Pick a ${category.slice(0, 1).toUpperCase() + category.slice(1)}`}
        items={filtered}
        pinnedId={pinnedId}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          jumpToId(id);
          setPickerOpen(false);
        }}
        onPin={(id) => {
          setPinnedId((cur) => (cur === id ? null : id));
          setPinned(true);
          jumpToId(id);
        }}
      />
    </div>
  );

  function formatRank(rank?: number) {
    if (rank == null || rank < 0) return "Unranked";
    return `#${rank.toLocaleString()}`;
  }

  function fmt(n: number) {
    return Math.max(0, n).toLocaleString();
  }
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="11" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="11" width="5" height="5" rx="1" />
      <rect x="11" y="11" width="5" height="5" rx="1" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={spinning ? "spin" : undefined}
    >
      <path
        fill="currentColor"
        d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 0 0 19 13c0-3.87-3.13-7-7-7zm-5 5a5 5 0 0 1 8.66-3.54l1.42-1.42A7 7 0 0 0 5 11c0 3.87 3.13 7 7 7v3l4-4-4-4v3c-2.76 0-5-2.24-5-5z"
      />
    </svg>
  );
}
