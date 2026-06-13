import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { stringifyJson } from "@/lib/json";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const matches = await prisma.match.findMany({
    orderBy: { kickoffAt: "asc" },
  });
  return ok({ matches });
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
    result?: { homeGoals: number; awayGoals: number; corners?: number } | null;
  };

  const resultStr =
    result === null
      ? null
      : result
      ? stringifyJson(result)
      : undefined;

  // Entering a result implicitly marks the match finished (ready to settle).
  const derivedStatus =
    status ?? (result ? "finished" : undefined);

  if (id) {
    const updated = await prisma.match.update({
      where: { id },
      data: {
        homeTeam,
        awayTeam,
        kickoffAt: kickoffAt ? new Date(kickoffAt) : undefined,
        stage,
        status: derivedStatus,
        result: resultStr,
      },
    });
    return ok({ match: updated });
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
