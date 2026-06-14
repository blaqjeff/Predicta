import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const slug = req.nextUrl.searchParams.get("slug");
  let trackId = req.nextUrl.searchParams.get("trackId") ?? undefined;
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? 100),
    200
  );

  if (!trackId && slug) {
    const track = await prisma.track.findUnique({ where: { slug } });
    if (!track) return fail("Track not found", 404);
    trackId = track.id;
  }
  if (!trackId) {
    const main = await prisma.track.findFirst({ where: { isMain: true } });
    trackId = main?.id;
  }
  if (!trackId) return fail("No track available", 404);

  const entries = await prisma.leaderboardEntry.findMany({
    where: { trackId, totalPoints: { gt: 0 } },
    orderBy: [{ totalPoints: "desc" }, { updatedAt: "asc" }],
    take: limit,
    include: { user: { select: { id: true, username: true, xHandle: true } } },
  });

  const me = await getCurrentUser();
  let myEntry = null;
  if (me) {
    const entry = await prisma.leaderboardEntry.findUnique({
      where: { userId_trackId: { userId: me.id, trackId } },
      include: { user: { select: { id: true, username: true, xHandle: true } } },
    });
    myEntry = entry;
  }

  return ok({
    trackId,
    entries: entries.map((e) => ({
      userId: e.userId,
      username: e.user.username,
      xHandle: e.user.xHandle,
      totalPoints: e.totalPoints,
      rank: e.rank,
    })),
    myEntry: myEntry
      ? {
          userId: myEntry.userId,
          username: myEntry.user.username,
          totalPoints: myEntry.totalPoints,
          rank: myEntry.rank,
        }
      : null,
  });
});
