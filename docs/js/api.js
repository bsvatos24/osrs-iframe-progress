// Fetch hiscores from the Cloudflare Workers proxy
async function fetchHiscores(player, signal) {
  const url = "https://osrs-highscore-proxy.bensvatos.workers.dev/?player=" + encodeURIComponent(player);
  const res = await fetch(url, { signal: signal });
  if (!res.ok) {
    throw new Error("Hiscores fetch failed (" + res.status + ")");
  }
  return res.json();
}