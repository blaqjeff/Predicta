/**
 * football-data.org v4 client (free tier covers World Cup via competition code `WC`).
 *
 * Auth: send `X-Auth-Token` on every request (see their docs).
 * Throttling: read response headers on every call:
 *   - X-RequestsAvailable (documented) or X-Requests-Available-Minute (free tier)
 *   - X-RequestCounter-Reset — seconds until the counter resets
 * https://docs.football-data.org/general/v4/lookup_tables.html#_response_headers
 *
 * Corners are not on the free tier; admin can enter them manually for settlement.
 */

const BASE = "https://api.football-data.org/v4";

/** Parsed from football-data.org response headers after each request. */
export interface FootballDataRateLimit {
  requestsAvailable: number | null;
  counterResetSeconds: number | null;
  apiVersion: string | null;
  authenticatedClient: string | null;
  observedAt: string;
}

let lastRateLimit: FootballDataRateLimit | null = null;

export function getLastFootballDataRateLimit(): FootballDataRateLimit | null {
  return lastRateLimit;
}

function parseRateLimitHeaders(res: Response): FootballDataRateLimit {
  const available =
    res.headers.get("X-RequestsAvailable") ??
    res.headers.get("X-Requests-Available-Minute");
  const reset = res.headers.get("X-RequestCounter-Reset");
  const state: FootballDataRateLimit = {
    requestsAvailable: available !== null ? Number(available) : null,
    counterResetSeconds: reset !== null ? Number(reset) : null,
    apiVersion: res.headers.get("X-API-Version"),
    authenticatedClient: res.headers.get("X-Authenticated-Client"),
    observedAt: new Date().toISOString(),
  };
  lastRateLimit = state;
  return state;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Minimum requests we want left after a call; skip/wait if we'd go below this. */
const MIN_REQUESTS_BUFFER = 1;

/**
 * Rate-limit-aware fetch for football-data.org.
 * Waits when the prior response said we're out of quota, retries once on HTTP 429.
 */
async function footballDataFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not set");

  // If the last response said we're blocked, wait for the reset window.
  if (
    lastRateLimit?.requestsAvailable === 0 &&
    lastRateLimit.counterResetSeconds &&
    lastRateLimit.counterResetSeconds > 0
  ) {
    const waitMs = (lastRateLimit.counterResetSeconds + 1) * 1000;
    console.warn(
      `[football-data] quota exhausted; waiting ${lastRateLimit.counterResetSeconds}s (X-RequestCounter-Reset)`
    );
    await sleep(waitMs);
  }

  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = new Headers(init?.headers);
  headers.set("X-Auth-Token", token);

  let res = await fetch(url, { ...init, headers, cache: "no-store" });
  let rate = parseRateLimitHeaders(res);

  if (rate.requestsAvailable !== null && rate.requestsAvailable <= MIN_REQUESTS_BUFFER) {
    console.warn(
      `[football-data] low quota: ${rate.requestsAvailable} request(s) left, reset in ${rate.counterResetSeconds ?? "?"}s`
    );
  }

  if (res.status === 429) {
    const waitSec = rate.counterResetSeconds ?? 60;
    console.warn(
      `[football-data] HTTP 429; waiting ${waitSec}s then retrying once (X-RequestCounter-Reset)`
    );
    await sleep((waitSec + 1) * 1000);
    res = await fetch(url, { ...init, headers, cache: "no-store" });
    rate = parseRateLimitHeaders(res);
    if (!res.ok) {
      throw new Error(
        `football-data.org rate limited after retry: ${res.status}. ` +
          `Requests available: ${rate.requestsAvailable ?? "unknown"}, ` +
          `reset in ${rate.counterResetSeconds ?? "unknown"}s`
      );
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `football-data.org request failed: ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }

  return res;
}

export interface NormalizedMatch {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string; // ISO
  stage: string;
  status: "scheduled" | "live" | "finished";
  result: { homeGoals: number; awayGoals: number } | null;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  homeTeam: { name: string | null };
  awayTeam: { name: string | null };
  score: { fullTime: { home: number | null; away: number | null } };
}

function mapStatus(s: string): NormalizedMatch["status"] {
  switch (s) {
    case "IN_PLAY":
    case "PAUSED":
    case "EXTRA_TIME":
    case "PENALTY_SHOOTOUT":
      return "live";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    default:
      return "scheduled";
  }
}

function prettyStage(stage: string): string {
  return stage
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isSportsApiConfigured(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_TOKEN?.trim());
}

export async function fetchCompetitionMatches(): Promise<NormalizedMatch[]> {
  const comp = process.env.FOOTBALL_DATA_COMPETITION || "WC";

  const res = await footballDataFetch(`/competitions/${comp}/matches`);
  const data = (await res.json()) as { matches: FdMatch[] };

  return (data.matches ?? [])
    .filter((m) => m.homeTeam.name && m.awayTeam.name)
    .map((m) => {
      const status = mapStatus(m.status);
      const home = m.score.fullTime.home;
      const away = m.score.fullTime.away;
      const result =
        status === "finished" && home !== null && away !== null
          ? { homeGoals: home, awayGoals: away }
          : null;
      return {
        externalId: String(m.id),
        homeTeam: m.homeTeam.name as string,
        awayTeam: m.awayTeam.name as string,
        kickoffAt: m.utcDate,
        stage: prettyStage(m.stage),
        status,
        result,
      };
    });
}

/** Lightweight connectivity + quota check (one API call). */
export async function probeFootballDataApi(): Promise<{
  ok: boolean;
  competition: string;
  rateLimit: FootballDataRateLimit;
  matchCount?: number;
  error?: string;
}> {
  const comp = process.env.FOOTBALL_DATA_COMPETITION || "WC";
  try {
    const res = await footballDataFetch(`/competitions/${comp}`);
    const data = (await res.json()) as { name?: string };
    const rateLimit = getLastFootballDataRateLimit()!;
    return {
      ok: true,
      competition: data.name ?? comp,
      rateLimit,
    };
  } catch (err) {
    return {
      ok: false,
      competition: comp,
      rateLimit: getLastFootballDataRateLimit() ?? {
        requestsAvailable: null,
        counterResetSeconds: null,
        apiVersion: null,
        authenticatedClient: null,
        observedAt: new Date().toISOString(),
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
