import { useEffect, useMemo, useState } from "react";
import type { Category, DisplayItem } from "./lib/types";
import { fetchHiscores } from "./lib/hiscoresApi";
import { mapHiscoresToDisplayItems } from "./lib/mapToDisplayItems";

// your existing components:
import { ArcGauge } from "./components/ArcGauge";
import { RankBadge } from "./components/RankBadge";
import { MilestoneBar } from "./components/MilestoneBar";
import "./styles.css";

const DEFAULT_PLAYER = "BenjiFresh91";

export default function App() {
  const [player, setPlayer] = useState(DEFAULT_PLAYER);
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [category, setCategory] = useState<Category>("skills");
  const [index, setIndex] = useState(0);
  const [pinned, setPinned] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    fetchHiscores(player, ac.signal)
      .then((data) => {
        const mapped = mapHiscoresToDisplayItems(data);
        setItems(mapped);
        setIndex(0);
      })
      .catch((e: unknown) => {
        if ((e as any)?.name === "AbortError") return;
        setError((e as Error).message ?? "Unknown error");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [player]);

  const filtered = useMemo(() => items.filter(i => i.category === category), [items, category]);
  const current = filtered[index] ?? null;

  // Auto cycle (only if not pinned and we have items)
  useEffect(() => {
    if (pinned) return;
    if (filtered.length <= 1) return;

    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % filtered.length);
    }, 6000);

    return () => window.clearInterval(t);
  }, [pinned, filtered.length]);

  // Keep index valid when category changes / data reloads
  useEffect(() => {
    setIndex(0);
  }, [category, player]);

  return (
    <div className="app">
      <header className="header">
        <div className="headerCenter">
          <div className="headerPlayer">{player}</div>

          <div className="headerItemRow">
            <div className="iconWrap">
              {current?.iconUrl ? (
              <img className = "icon" src={current.iconUrl} alt={current.name} />
            ) : null}
            </div>            
            <div className="title">
              {current?.name ?? (loading ? "Loading…" : "No item")}
            </div>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="card">
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

        <section className="card">
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
              value={current.primaryCurrent}
              max={current.primaryTarget}
              labelTop={current.primaryLabelTop}
              centerMainParts={{
                top: `${fmt(current.secondaryCurrent ?? 0)}`,
                bottom: `${fmt(current.secondaryTarget ?? 1)}`
              }}
              centerSub={`${fmt(current.primaryTarget - current.primaryCurrent)} XP Left`}
              centerHint="To 99"
            />
            )
          ) : (
            <div>No item</div>
          )}
        </section>

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
          <button className={`tab ${category === "skills" ? "tabActive" : ""}`} onClick={() => setCategory("skills")}>
            Skills
          </button>
          <button className={`tab ${category === "bosses" ? "tabActive" : ""}`} onClick={() => setCategory("bosses")}>
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
          <button className={`btn ${pinned ? "btnPin" : ""}`} onClick={() => setPinned(p => !p)}>
            {pinned ? "Pinned" : "Pin"}
          </button>

          <button className="btn" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={filtered.length === 0}>
            Prev
          </button>
          <button
            className="btn"
            onClick={() => setIndex(i => (filtered.length ? (i + 1) % filtered.length : 0))}
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
