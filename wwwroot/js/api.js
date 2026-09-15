// ============================================================
// Hiscores access
// ------------------------------------------------------------
// All requests go through a Cloudflare Worker that proxies the OSRS hiscores
// (the hiscores themselves send no CORS headers, so the browser cannot call
// them directly). On top of that this layer adds:
//   - a hard timeout, so a cold Worker cannot hang the UI forever
//   - one backoff retry for transient network / 5xx failures
//   - a localStorage "last known good" cache, so a failed poll falls back to
//     real (if stale) numbers instead of showing nothing or, worse, fake data
// ============================================================

export const HISCORES_ENDPOINT = "https://osrs-highscore-proxy.bensvatos.workers.dev/";
const REQUEST_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 1200;
const CACHE_PREFIX = "osrsgim.hiscores.";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // serve stale data for at most a day

function cacheKey(player) {
  return CACHE_PREFIX + String(player).toLowerCase();
}

// Returns { data, fetchedAt } or null. Never throws: storage can be disabled.
function readHiscoresCache(player) {
  try {
    const raw = localStorage.getItem(cacheKey(player));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.data || !entry.fetchedAt) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch (e) {
    return null;
  }
}

function writeHiscoresCache(player, data) {
  try {
    localStorage.setItem(
      cacheKey(player),
      JSON.stringify({ fetchedAt: Date.now(), data: data })
    );
  } catch (e) {
    // Quota exceeded or storage disabled (private mode / iframe policy).
    // Caching is an optimisation, never a requirement.
  }
}

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Wrap an optional caller-supplied signal with our own timeout so that both
// an external abort (player switched) and a timeout cancel the request.
// Built by hand rather than with AbortSignal.any() for wider engine support.
function withTimeout(externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, REQUEST_TIMEOUT_MS);

  let onExternalAbort = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      onExternalAbort = function () { controller.abort(externalSignal.reason); };
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    done: function () {
      clearTimeout(timer);
      if (onExternalAbort) externalSignal.removeEventListener("abort", onExternalAbort);
    }
  };
}

function isAbort(err) {
  return err && (err.name === "AbortError" || err.name === "TimeoutError");
}

async function requestHiscores(player, externalSignal) {
  const guard = withTimeout(externalSignal);
  try {
    const res = await fetch(
      HISCORES_ENDPOINT + "?player=" + encodeURIComponent(player),
      { signal: guard.signal }
    );
    if (!res.ok) {
      const err = new Error("Hiscores fetch failed (" + res.status + ")");
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    guard.done();
  }
}

// Fetch one player. Retries once on a transient failure. Throws on final
// failure so callers can decide between an error state and cached data.
export async function fetchHiscores(player, signal) {
  try {
    const data = await requestHiscores(player, signal);
    writeHiscoresCache(player, data);
    return data;
  } catch (err) {
    // A caller-cancelled or timed-out request is not worth retrying.
    if (isAbort(err)) throw err;
    // 4xx means "this player does not exist" - retrying changes nothing.
    if (err.status >= 400 && err.status < 500) throw err;

    await delay(RETRY_DELAY_MS);
    const data = await requestHiscores(player, signal);
    writeHiscoresCache(player, data);
    return data;
  }
}

// Fetch one player, falling back to cached data rather than failing outright.
// Always resolves to a uniform result so views can render a per-player state.
export async function loadPlayer(player, signal) {
  try {
    const data = await fetchHiscores(player, signal);
    return { player: player, data: data, fetchedAt: Date.now(), stale: false, error: null };
  } catch (err) {
    if (isAbort(err)) throw err;
    const cached = readHiscoresCache(player);
    if (cached) {
      return {
        player: player,
        data: cached.data,
        fetchedAt: cached.fetchedAt,
        stale: true,
        error: err.message || "Refresh failed"
      };
    }
    return {
      player: player,
      data: null,
      fetchedAt: null,
      stale: false,
      error: err.message || "Unknown error"
    };
  }
}

// Fetch many players concurrently. Five serial round-trips through the Worker
// was the single slowest thing in the app.
export function loadPlayers(players, signal) {
  return Promise.all(players.map(function (p) { return loadPlayer(p, signal); }));
}