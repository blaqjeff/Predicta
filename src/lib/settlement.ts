import { prisma } from "./prisma";
import { parseJson } from "./json";
import { scorePrediction, MatchResult, PredictionValue } from "./scoring";
import { CategoryKey } from "./categories";
import { fetchCompetitionMatches, isSportsApiConfigured } from "./sportsApi";
import { postResultCommitment } from "./solana";

export interface SyncSummary {
  created: number;
  updated: number;
  finishedWithResult: number;
}

/** Pulls matches from the free sports API and upserts them by externalId. */
export async function syncMatchesFromApi(): Promise<SyncSummary> {
  const summary: SyncSummary = { created: 0, updated: 0, finishedWithResult: 0 };
  if (!isSportsApiConfigured()) return summary;

  const matches = await fetchCompetitionMatches();
  for (const m of matches) {
    const existing = await prisma.match.findUnique({
      where: { externalId: m.externalId },
    });

    // Preserve any admin-entered corner data already on the match result.
    const existingResult = existing?.result
      ? parseJson<MatchResult | null>(existing.result, null)
      : null;
    const mergedResult =
      m.result !== null
        ? JSON.stringify({
            ...m.result,
            ...(existingResult?.corners !== undefined
              ? { corners: existingResult.corners }
              : {}),
          })
        : existing?.result ?? null;

    if (existing) {
      // Don't downgrade a match we've already settled locally.
      if (existing.status === "settled") continue;
      await prisma.match.update({
        where: { id: existing.id },
        data: {
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          kickoffAt: new Date(m.kickoffAt),
          stage: m.stage,
          status: m.status,
          result: mergedResult,
        },
      });
      summary.updated += 1;
    } else {
      await prisma.match.create({
        data: {
          externalId: m.externalId,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          kickoffAt: new Date(m.kickoffAt),
          stage: m.stage,
          status: m.status,
          result: mergedResult,
        },
      });
      summary.created += 1;
    }
    if (m.result) summary.finishedWithResult += 1;
  }
  return summary;
}

export interface SettleResult {
  matchId: string;
  scored: number;
  unsettled: number;
  commitmentTx: string | null;
  affectedTracks: string[];
}

/**
 * Scores every prediction for a finished match, posts an on-chain commitment of
 * the result, and refreshes the affected leaderboards.
 */
export async function settleMatch(matchId: string): Promise<SettleResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");
  if (!match.result) throw new Error("Match has no result to settle");

  const result = parseJson<MatchResult | null>(match.result, null);
  if (!result) throw new Error("Match result is invalid");

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    include: { category: true },
  });

  // Build a per-track weight lookup so track overrides apply.
  const trackIds = [...new Set(predictions.map((p) => p.trackId))];
  const trackCategories = await prisma.trackCategory.findMany({
    where: { trackId: { in: trackIds } },
  });
  const weightKey = (trackId: string, categoryId: string) =>
    `${trackId}:${categoryId}`;
  const weightMap = new Map<string, number>();
  for (const tc of trackCategories) {
    weightMap.set(weightKey(tc.trackId, tc.categoryId), tc.weight);
  }

  let scored = 0;
  let unsettled = 0;
  const affectedTracks = new Set<string>();

  for (const p of predictions) {
    const value = parseJson<PredictionValue | null>(p.value, null);
    if (!value) {
      unsettled += 1;
      continue;
    }
    const weight =
      weightMap.get(weightKey(p.trackId, p.categoryId)) ?? p.category.baseWeight;
    const points = scorePrediction(
      p.category.key as CategoryKey,
      value,
      result,
      weight
    );
    if (points === null) {
      // Not scoreable yet (e.g. corners without data) - leave for later.
      unsettled += 1;
      continue;
    }
    await prisma.prediction.update({
      where: { id: p.id },
      data: { pointsAwarded: points, status: "settled" },
    });
    scored += 1;
    affectedTracks.add(p.trackId);
  }

  // Post on-chain commitment of the result hash (best-effort).
  let commitmentTx = match.resultCommitmentTx;
  if (!commitmentTx) {
    try {
      commitmentTx = await postResultCommitment(match.id, match.result);
    } catch {
      commitmentTx = null;
    }
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: "settled",
      settledAt: new Date(),
      resultCommitmentTx: commitmentTx,
    },
  });

  for (const trackId of affectedTracks) {
    await recalcLeaderboard(trackId);
  }

  return {
    matchId,
    scored,
    unsettled,
    commitmentTx: commitmentTx ?? null,
    affectedTracks: [...affectedTracks],
  };
}

/** Settles all finished, unsettled matches that have a result. */
export async function settleAllFinished(): Promise<SettleResult[]> {
  const matches = await prisma.match.findMany({
    where: { status: "finished", result: { not: null } },
  });
  const results: SettleResult[] = [];
  for (const m of matches) {
    try {
      results.push(await settleMatch(m.id));
    } catch {
      // Skip matches that can't be settled yet.
    }
  }
  return results;
}

/** Rebuilds the materialized leaderboard for a track and assigns ranks. */
export async function recalcLeaderboard(trackId: string): Promise<void> {
  const grouped = await prisma.prediction.groupBy({
    by: ["userId"],
    where: { trackId, status: "settled" },
    _sum: { pointsAwarded: true },
  });

  const rows = grouped
    .map((g) => ({
      userId: g.userId,
      totalPoints: g._sum.pointsAwarded ?? 0,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  let rank = 0;
  let lastPoints: number | null = null;
  let processed = 0;
  for (const row of rows) {
    processed += 1;
    if (lastPoints === null || row.totalPoints < lastPoints) {
      rank = processed; // standard competition ranking (ties share a rank)
      lastPoints = row.totalPoints;
    }
    await prisma.leaderboardEntry.upsert({
      where: { userId_trackId: { userId: row.userId, trackId } },
      create: {
        userId: row.userId,
        trackId,
        totalPoints: row.totalPoints,
        rank,
      },
      update: { totalPoints: row.totalPoints, rank },
    });
  }
}
