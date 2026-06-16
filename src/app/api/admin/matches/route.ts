import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { parseJson, stringifyJson } from "@/lib/json";
import {
  getMatchSettlementState,
  reconcileMatchStatus,
  settleMatchGoals,
} from "@/lib/settlement";
import type { MatchResult } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const matches = await prisma.match.findMany({
    orderBy: { kickoffAt: "asc" },
  });

  const enriched = await Promise.all(
    matches.map(async (m) => {
      await reconcileMatchStatus(m.id);
      const settlement = await getMatchSettlementState(m.id);
      return { ...m, settlement };
    })
  );

  return ok({ matches: enriched });
});

/** Create or update a match, including entering an official result. */
export const POST = route(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  const {
    id,
    externalId,
    homeTeam,
    awayTeam,
    kickoffAt,
    stage,
    status,
    result,
  } = body as {
    id?: string;
    externalId?: string;
    homeTeam?: string;
    awayTeam?: string;
    kickoffAt?: string;
    stage?: string;
    status?: string;
    result?: Partial<{
      homeGoals: number;
      awayGoals: number;
      corners?: number;
    }> | null;
  };

  const resultStr =
    result === null
      ? null
      : result
      ? stringifyJson(result)
      : undefined;

  // Entering a result implicitly marks the match finished (ready to settle).
  const derivedStatus =
    status ??
    (result?.homeGoals !== undefined && result?.awayGoals !== undefined
      ? "finished"
      : undefined);

  if (id) {
    const existing = await prisma.match.findUnique({ where: { id } });
    if (!existing) return fail("Match not found", 404);

    let mergedResultStr = resultStr;
    if (result && existing.result) {
      const prev = parseJson<MatchResult | null>(existing.result, null);
      mergedResultStr = stringifyJson({ ...prev, ...result });
    }

    const updated = await prisma.match.update({
      where: { id },
      data: {
        homeTeam,
        awayTeam,
        kickoffAt: kickoffAt ? new Date(kickoffAt) : undefined,
        stage,
        status: derivedStatus,
        result: mergedResultStr ?? resultStr,
      },
    });

    const hasScore =
      result?.homeGoals !== undefined && result?.awayGoals !== undefined;
    if (hasScore) {
      try {
        await settleMatchGoals(id);
      } catch {
        // Score may be incomplete; admin can retry via settlement run.
      }
    }

    const settlement = await getMatchSettlementState(id);
    return ok({ match: updated, settlement });
  }

  if (!homeTeam || !awayTeam || !kickoffAt) {
    return fail("homeTeam, awayTeam and kickoffAt are required", 422);
  }

  const created = await prisma.match.create({
    data: {
      externalId: externalId || null,
      homeTeam,
      awayTeam,
      kickoffAt: new Date(kickoffAt),
      stage: stage || "Group Stage",
      status: derivedStatus ?? "scheduled",
      result: resultStr ?? null,
    },
  });
  return ok({ match: created });
});
