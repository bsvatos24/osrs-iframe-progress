import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, DisplayItem } from "./lib/types";
import { fetchHiscores } from "./lib/hiscoresApi";
import { mapHiscoresToDisplayItems } from "./lib/mapToDisplayItems";

import { ArcGauge } from "./components/ArcGauge";
import { RankBadge } from "./components/RankBadge";
import { MilestoneBar } from "./components/MilestoneBar";
import { PickerModal } from "./components/PickerModal";
import { TotalGrid } from "./components/TotalGrid";
import { GimView } from "./components/GimView";
import { PlayerMenu } from "./components/PlayerMenu";

import "./styles.css";

const DEFAULT_PLAYER = "BenjiFresh91";

// ✅ dropdown options (add more as you want)
const PLAYER_OPTIONS = [
  "BenjiFresh91",
  "IronBengal",
  "Kobenhamner",
  "Z o i n k z",
  "PacmanPier"
];

// ✅ skill order used in picker + total
const SKILL_GRID_ORDER: string[] = [
  "Attack", "Hitpoints", "Mining",
  "Strength", "Agility", "Smithing",
  "Defence", "Herblore", "Fishing",
  "Ranged", "Thieving", "Cooking",
  "Prayer", "Crafting", "Firemaking",
  "Magic", "Fletching", "Woodcutting",
  "Runecraft", "Slayer", "Farming",
  "Construction", "Hunter", "Sailing"
];

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

  const [refreshNonce, setRefreshNonce] = useState(0);

  const lastSelectedIdRef = useRef<string | null>(null);

  // Skills subset for Total tab + ordering
  const skillItems = useMemo(
    () => items.filter((i) => i.category === "skills"),
    [items]
  );

  const filtered = useMemo(() => {
    if (category === "total") return [];
    return items.filter((i) => i.category === category);
  }, [items, category]);

  const current = filtered[index] ?? null;

  useEffect(() => {
    lastSelectedIdRef.current = current?.id ?? null;
  }, [current?.id]);

  // Fetch only on player/apply + refresh button
  useEffect(() => {
    const ac = new AbortController();

    setError(null);
    if (refreshNonce === 0 && items.length === 0) setLoading(true);

    fetchHiscores(player, ac.signal)
      .then((data) => {
        const mapped = mapHiscoresToDisplayItems(data);
        setItems(mapped);

        // keep selection in current category (non-total)
        if (category !== "total") {
          const desiredId = pinnedId ?? lastSelectedIdRef.current;
          if (desiredId) {
            const nextFiltered = mapped.filter((i) => i.category === category);
            const idx = nextFiltered.findIndex((x) => x.id === desiredId);
            setIndex(idx >= 0 ? idx : 0);
          } else {
            setIndex((prev) => {
              const nextFiltered = mapped.filter((i) => i.category === category);
              if (nextFiltered.length === 0) return 0;
              return Math.min(prev, nextFiltered.length - 1);
            });
          }
        }
      })
      .catch((e: unknown) => {
        if ((e as any)?.name === "AbortError") return;
        setError((e as Error).message ?? "Unknown error");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, refreshNonce]);

  // Auto cycle (disabled on Total)
  useEffect(() => {
    if (category === "total") return;
    if (pinned || pinnedId) return;
    if (filtered.length <= 1) return;

    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % filtered.length);
    }, 6000);

    return () => window.clearInterval(t);
  }, [category, pinned, pinnedId, filtered.length]);

  function onRefresh() {
    setRefreshing(true);
    setRefreshNonce((n) => n + 1);
  }

  function jumpToId(id: string) {
    const idx = filtered.findIndex((x) => x.id === id);
    if (idx >= 0) setIndex(idx);
  }

  // Ordered items for picker when Skills
  const pickerItems = useMemo(() => {
    if (category === "skills") {
      const byName = new Map(filtered.map((s) => [s.name, s]));
      const ordered = SKILL_GRID_ORDER.map((n) => byName.get(n)).filter(Boolean) as DisplayItem[];
      return ordered;
    }
    // bosses/activities: keep as-is or sort alphabetically
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [category, filtered]);

  return (
    <div className="app">
      <header className="header">
        <div className="headerActions">
          <button
            type="button"
            className="iconBtn"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            disabled={loading || refreshing}
          >
            <RefreshIcon spinning={refreshing} />
          </button>

          <button
            type="button"
            className="iconBtn"
            onClick={() => setPickerOpen(true)}
            aria-label="Pick item"
            title="Pick item"
            disabled={loading || category === "total"}
          >
            <GridIcon />
          </button>
        </div>

        <div className="headerCenter">
          {category === "gim" ? (
            <div className="headerGimOnly">GIM Levels</div>
          ) : (
            <>
            <div className="headerPlayer">{player}</div>

          <div className="headerItemRow">
            <div className="iconWrap">
              {category === "total" ? (
                <img className="icon" src={`${import.meta.env.BASE_URL}icons/skills/total.png`} alt="Total"/>
              ) : current?.iconUrl ? (
                <img className="icon" src={current.iconUrl} alt={current.name} />
              ) : null}
            </div>


            <div className="title">
              {category === "total"
                ? "Totals"
                : current
                ? current.category === "skills"
                  ? `${current.name} - ${(current.skillLevel ?? current.milestoneCurrent) ?? 0}`
                  : current.name
                : loading
                ? "Loading..."
                : "No data"}
            </div>
          </div>
          </>
          )}

        </div>
      </header>

      {/* MAIN */}
{category === "total" ? (
  <main className="grid">
    <section className="card full cardTotal">
      {loading ? (
        <div>Loading…</div>
      ) : error ? (
        <div>{error}</div>
      ) : (
        <TotalGrid skillItems={skillItems} />
      )}
    </section>
  </main>
) : category === "gim" ? (
  <main className="mainFill">
    <section className="card full cardTotal" style={{ width: "100%", height: "100%" }}>
      <GimView />
    </section>
  </main>
) : (
  <main className="grid">
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

    <section className="card full cardTotal">
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
)}


      {/* FOOTER */}
      <footer className="footer">
        <div className="tabs">
          <button type="button" className={`tab ${category === "skills" ? "tabActive" : ""}`} onClick={() => setCategory("skills")}>
            Skills
          </button>
          <button type="button" className={`tab ${category === "bosses" ? "tabActive" : ""}`} onClick={() => setCategory("bosses")}>
            Bosses
          </button>
          <button type="button" className={`tab ${category === "activities" ? "tabActive" : ""}`} onClick={() => setCategory("activities")}>
            Activities
          </button>
          <button type="button" className={`tab ${category === "total" ? "tabActive" : ""}`} onClick={() => setCategory("total")}>
            Total
          </button>
          <button type="button" className={`tab ${category === "gim" ? "tabActive" : ""}`} onClick={() => setCategory("gim")}>
            GIM
          </button>

        </div>

        <div className="controls">
          <button
            type="button"
            className={`btn ${pinned || pinnedId ? "btnPin" : ""}`}
            onClick={() => {
              setPinned((p) => {
                const next = !p;
                if (next) setPinnedId(null);
                return next;
              });
            }}
            disabled={category === "total"}
          >
            {pinned || pinnedId ? "Pinned" : "Pin"}
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={filtered.length === 0 || category === "total"}
          >
            Prev
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0))}
            disabled={filtered.length === 0 || category === "total"}
          >
            Next
          </button>

          {/* ✅ player dropdown */}
          <PlayerMenu
            value={player}
            options={PLAYER_OPTIONS}
            onChange={(next) => setPlayer(next)}
            disabled={loading || refreshing}
          />

        </div>
      </footer>

      {/* PICKER MODAL */}
      <PickerModal
        open={pickerOpen}
        title={`Pick a ${category.slice(0, 1).toUpperCase() + category.slice(1)}`}
        items={pickerItems}
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
      style={spinning ? { animation: "spin 1s linear infinite" } : undefined}
    >
      <path
        d="M21 12a9 9 0 1 1-2.64-6.36"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 3v7h-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
