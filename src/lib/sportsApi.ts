/**
 * Free sports data client (football-data.org free tier, which covers the World Cup
 * via the "WC" competition code). Set FOOTBALL_DATA_TOKEN in .env.
 *
 * Note: the free tier does not report corner counts, so corner predictions stay
 * unsettled when results come from this source. An admin can fill corners manually
 * via the admin match editor for full settlement.
 */

const BASE = "https://api.football-data.org/v4";

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
  return Boolean(process.env.FOOTBALL_DATA_TOKEN);
}

export async function fetchCompetitionMatches(): Promise<NormalizedMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not set");
  const comp = process.env.FOOTBALL_DATA_COMPETITION || "WC";

  const res = await fetch(`${BASE}/competitions/${comp}/matches`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `football-data.org request failed: ${res.status} ${res.statusText}`
    );
  }
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
