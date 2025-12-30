import { useEffect, useMemo, useState } from "react";
import { fetchHiscores, type HiscoresResponse } from "../lib/hiscoresApi";
import { GimPanel } from "./GimPanel";

const GIM_PLAYERS = [
  { name: "IronBengal", pos: "tl" as const },
  { name: "Kobenhamner", pos: "tr" as const },
  { name: "Z o i n k z", pos: "bl" as const },
  { name: "PacmanPier", pos: "br" as const },
  { name: "BenjiFresh91", pos: "c" as const }
];

type PlayerData = {
  name: string;
  data: HiscoresResponse;
  ok: boolean;
};

export function GimView() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      const results: PlayerData[] = [];

      // fetch one at a time (sequential)
      for (const p of GIM_PLAYERS) {
        try {
          const data = await fetchHiscores(p.name, ac.signal);
          results.push({ name: p.name, data, ok: true });
        } catch (e: any) {
          // Fallback if not found (404) or other error:
          // "put all their levels and experience at 1"
          results.push({ name: p.name, data: fallbackHiscores(p.name), ok: false });
        }
      }

      setPlayers(results);
      setLoading(false);
    })().catch((e) => {
      if ((e as any)?.name === "AbortError") return;
      setError((e as Error).message ?? "Unknown error");
      setLoading(false);
    });

    return () => ac.abort();
  }, []);

  const lookup = useMemo(() => {
    const map = new Map<string, PlayerData>();
    for (const p of players) map.set(p.name, p);
    return map;
  }, [players]);

  if (loading) return <div>Loading GIM…</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="gimLayout">
      {GIM_PLAYERS.map((slot) => (
        <div key={slot.name} className={`gimSlot ${slot.pos}`}>
          <GimPanel
            name={slot.name}
            hiscores={lookup.get(slot.name)?.data ?? fallbackHiscores(slot.name)}
            ok={lookup.get(slot.name)?.ok ?? false}
          />
        </div>
      ))}
    </div>
  );
}

function fallbackHiscores(name: string): HiscoresResponse {
  // 23 core skills + Sailing (your API includes it)
  const skillNames = [
    "Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic",
    "Cooking","Woodcutting","Fletching","Fishing","Firemaking","Crafting",
    "Smithing","Mining","Herblore","Agility","Thieving","Slayer","Farming",
    "Runecraft","Hunter","Construction","Sailing"
  ];

  return {
    name,
    skills: skillNames.map((sn, i) => ({
      id: i + 1,
      name: sn,
      rank: -1,
      level: 1,
      xp: 1
    })),
    activities: []
  };
}
