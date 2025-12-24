export type HiscoresSkill = {
  id: number;
  name: string;
  rank: number;
  level: number;
  xp: number;
};

export type HiscoresActivity = {
  id: number;
  name: string;
  rank: number;
  score: number;
};

export type HiscoresResponse = {
  name: string;
  skills: HiscoresSkill[];
  activities: HiscoresActivity[];
};

export async function fetchHiscores(player: string, signal?: AbortSignal): Promise<HiscoresResponse> {
  const url = `https://osrs-highscore-proxy.bensvatos.workers.dev/?player=${encodeURIComponent(player)}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`Hiscores fetch failed (${res.status})`);
  }

  return res.json();
}
