import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { validatePredictionValue } from "@/lib/validation";
import { stringifyJson } from "@/lib/json";
import {
  isPredictionLocked,
  isPredictionOpen,
  formatPredictionOpensAt,
} from "@/lib/predictionWindow";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const trackId = req.nextUrl.searchParams.get("trackId") ?? undefined;
  const matchId = req.nextUrl.searchParams.get("matchId") ?? undefined;

  const predictions = await prisma.prediction.findMany({
    where: { userId: user.id, trackId, matchId },
    include: { category: { select: { key: true } } },
  });
  return ok({ predictions });
});

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json();
  const { matchId, categoryId, trackId } = body as {
    matchId?: string;
    categoryId?: string;
    trackId?: string;
  };
  if (!matchId || !categoryId || !trackId) {
    return fail("matchId, categoryId and trackId are required", 422);
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return fail("Match not found", 404);
  if (isPredictionLocked(match.kickoffAt)) {
    return fail("Predictions are locked for this match (kicked off)", 423);
  }
  if (!isPredictionOpen(match.kickoffAt)) {
    return fail(
      `Predictions open at ${formatPredictionOpensAt(match.kickoffAt)}`,
      423
    );
  }

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track || !track.active) return fail("Track not available", 404);
  const now = new Date();
  if ((track.startAt && now < track.startAt) || (track.endAt && now > track.endAt)) {
    return fail("This track is not open right now", 400);
  }

  const trackCategory = await prisma.trackCategory.findUnique({
    where: { trackId_categoryId: { trackId, categoryId } },
  });
  if (!trackCategory || !trackCategory.enabled) {
    return fail("This category is not part of the selected track", 400);
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return fail("Category not found", 404);

  // Validate + normalize the prediction value for this category.
  const value = validatePredictionValue(category.key, body.value);

  const existing = await prisma.prediction.findUnique({
    where: {
      userId_matchId_categoryId_trackId: {
        userId: user.id,
        matchId,
        categoryId,
        trackId,
      },
    },
  });

  if (!existing) {
    const created = await prisma.prediction.create({
      data: {
        userId: user.id,
        matchId,
        categoryId,
        trackId,
        value: stringifyJson(value),
        status: "open",
      },
    });
    return ok({ prediction: created, action: "created" });
  }

  if (existing.status === "settled") {
    return fail("This prediction is already settled", 409);
  }

  if (!existing.editUnlocked) {
    // One prediction per category: changing requires a paid revert.
    return fail(
      "You already predicted this category. Pay the revert fee to change it.",
      402,
      { code: "REVERT_REQUIRED", predictionId: existing.id }
    );
  }

  // Edit was unlocked by a verified revert payment; apply it and consume the unlock.
  const updated = await prisma.prediction.update({
    where: { id: existing.id },
    data: { value: stringifyJson(value), editUnlocked: false },
  });
  return ok({ prediction: updated, action: "updated" });
});
