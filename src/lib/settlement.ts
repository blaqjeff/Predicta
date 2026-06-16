import { prisma } from "./prisma";
import { parseJson } from "./json";
import { scorePrediction, MatchResult, PredictionValue } from "./scoring";
import {
  CategoryKey,
  CORNERS_CATEGORY,
  GOAL_CATEGORY_KEYS,
} from "./categories";
import {
  fetchCompetitionMatches,
  getLastFootballDataRateLimit,
  isSportsApiConfigured,
  type FootballDataRateLimit,
} from "./sportsApi";
import { postResultCommitment } from "./solana";

export interface SyncSummary {
  created: number;
  updated: number;
  finishedWithResult: number;
  rateLimit?: FootballDataRateLimit | null;
}

export interface SettleResult {
  matchId: string;
  scored: number;
  unsettled: number;
  commitmentTx: string | null;
  affectedTracks: string[];
  phase: "goals" | "corners" | "full";
}

export interface MatchSettlementState {
  goalsSettled: boolean;
  cornersPending: boolean;
  cornerPredictionCount: number;
  unsettledCornerPredictions: number;
}

/** Downgrade wrongly-settled matches that still have pending corner predictions. */
export async function reconcileMatchStatus(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "settled") return;

  const state = await getMatchSettlementState(matchId);
  if (state.cornersPending) {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: "finished", settledAt: null },
    });
  }
}

/** Pulls matches from the free sports API and upserts them by externalId. */
export async function syncMatchesFromApi(): Promise<SyncSummary> {
  const summary: SyncSummary = { created: 0, updated: 0, finishedWithResult: 0 };
  if (!isSportsApiConfigured()) return summary;

  const matches = await fetchCompetitionMatches();
  summary.rateLimit = getLastFootballDataRateLimit();
  for (const m of matches) {
    const existing = await prisma.match.findUnique({
      where: { externalId: m.externalId },
    });

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
      await reconcileMatchStatus(existing.id);
      const current = await prisma.match.findUnique({
        where: { id: existing.id },
        select: { status: true, result: true },
      });
      if (!current) continue;
      if (current.status === "settled") continue;

      const preservedCorners = current.result
        ? parseJson<MatchResult | null>(current.result, null)?.corners
        : existingResult?.corners;
      const resultForUpdate =
        m.result !== null
          ? JSON.stringify({
              ...m.result,
              ...(preservedCorners !== undefined
                ? { corners: preservedCorners }
                : {}),
            })
          : current.result;

      await prisma.match.update({
        where: { id: existing.id },
        data: {
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          kickoffAt: new Date(m.kickoffAt),
          stage: m.stage,
          status: m.status === "finished" ? "finished" : m.status,
          result: resultForUpdate,
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

export async function getMatchSettlementState(
  matchId: string
): Promise<MatchSettlementState> {
  const cornerPredictionCount = await prisma.prediction.count({
    where: { matchId, category: { key: CORNERS_CATEGORY } },
  });
  const unsettledNonCorner = await prisma.prediction.count({
    where: {
      matchId,
      category: { key: { not: CORNERS_CATEGORY } },
      pointsAwarded: null,
    },
  });
  const unsettledCornerPredictions = await prisma.prediction.count({
    where: {
      matchId,
      category: { key: CORNERS_CATEGORY },
      pointsAwarded: null,
    },
  });

  return {
    goalsSettled: unsettledNonCorner === 0,
    cornersPending:
      cornerPredictionCount > 0 && unsettledCornerPredictions > 0,
    cornerPredictionCount,
    unsettledCornerPredictions,
  };
}

async function scorePredictionsForCategories(
  matchId: string,
  result: MatchResult,
  categoryKeys: CategoryKey[]
): Promise<Pick<SettleResult, "scored" | "unsettled" | "affectedTracks">> {
  const predictions = await prisma.prediction.findMany({
    where: {
      matchId,
      category: { key: { in: categoryKeys } },
      pointsAwarded: null,
    },
    include: { category: true },
  });

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

  return { scored, unsettled, affectedTracks: [...affectedTracks] };
}

async function maybeCommitResult(
  matchId: string,
  resultJson: string,
  existingTx: string | null
): Promise<string | null> {
  if (existingTx) return existingTx;
  try {
    return await postResultCommitment(matchId, resultJson);
  } catch {
    return null;
  }
}

async function finalizeMatchIfComplete(
  matchId: string,
  resultJson: string,
  commitmentTx: string | null
): Promise<void> {
  const state = await getMatchSettlementState(matchId);
  if (state.cornersPending) {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: "finished",
        resultCommitmentTx: commitmentTx,
      },
    });
    return;
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: "settled",
      settledAt: new Date(),
      resultCommitmentTx: commitmentTx,
    },
  });
}

/** Score exact score, result, total goals, and BTTS from the pulled final score. */
export async function settleMatchGoals(matchId: string): Promise<SettleResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");
  if (!match.result) throw new Error("Match has no result to settle");

  const result = parseJson<MatchResult | null>(match.result, null);
  if (!result) throw new Error("Match result is invalid");
  if (
    result.homeGoals === undefined ||
    result.awayGoals === undefined ||
    Number.isNaN(result.homeGoals) ||
    Number.isNaN(result.awayGoals)
  ) {
    throw new Error("Match is missing a final score");
  }

  const { scored, unsettled, affectedTracks } =
    await scorePredictionsForCategories(matchId, result, GOAL_CATEGORY_KEYS);

  const commitmentTx = await maybeCommitResult(
    matchId,
    match.result,
    match.resultCommitmentTx
  );

  await finalizeMatchIfComplete(matchId, match.result, commitmentTx);

  for (const trackId of affectedTracks) {
    await recalcLeaderboard(trackId);
  }

  return {
    matchId,
    scored,
    unsettled,
    commitmentTx,
    affectedTracks,
    phase: "goals",
  };
}

/** Score corner predictions after admin enters total corners. */
export async function settleMatchCorners(matchId: string): Promise<SettleResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");
  if (!match.result) throw new Error("Match has no result to settle");

  const result = parseJson<MatchResult | null>(match.result, null);
  if (!result) throw new Error("Match result is invalid");
  if (result.corners === undefined || result.corners === null) {
    throw new Error("Enter total corners before settling the corners market");
  }

  const state = await getMatchSettlementState(matchId);
  if (!state.goalsSettled) {
    throw new Error("Goal markets must be settled before corners");
  }

  const { scored, unsettled, affectedTracks } =
    await scorePredictionsForCategories(matchId, result, [CORNERS_CATEGORY]);

  const commitmentTx = await maybeCommitResult(
    matchId,
    match.result,
    match.resultCommitmentTx
  );

  await finalizeMatchIfComplete(matchId, match.result, commitmentTx);

  for (const trackId of affectedTracks) {
    await recalcLeaderboard(trackId);
  }

  return {
    matchId,
    scored,
    unsettled,
    commitmentTx,
    affectedTracks,
    phase: "corners",
  };
}

/** Scores every category (legacy full settle). Prefer goals + corners split. */
export async function settleMatch(matchId: string): Promise<SettleResult> {
  const goals = await settleMatchGoals(matchId);
  const state = await getMatchSettlementState(matchId);
  if (!state.cornersPending) {
    return { ...goals, phase: "full" };
  }
  const corners = await settleMatchCorners(matchId);
  return {
    matchId,
    scored: goals.scored + corners.scored,
    unsettled: corners.unsettled,
    commitmentTx: corners.commitmentTx,
    affectedTracks: [
      ...new Set([...goals.affectedTracks, ...corners.affectedTracks]),
    ],
    phase: "full",
  };
}

/** Auto-settle goal markets for every finished match with a final score. */
export async function settleAllFinished(): Promise<SettleResult[]> {
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ["finished", "settled"] },
      result: { not: null },
    },
  });

  const results: SettleResult[] = [];
  for (const m of matches) {
    try {
      await reconcileMatchStatus(m.id);
      const state = await getMatchSettlementState(m.id);
      if (!state.goalsSettled) {
        results.push(await settleMatchGoals(m.id));
      }
    } catch {
      // Skip matches missing scores or not ready yet.
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
      rank = processed;
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
