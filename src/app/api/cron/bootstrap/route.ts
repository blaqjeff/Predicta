import { NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { purgeDemoData } from "@/lib/purgeDemo";
import { prisma } from "@/lib/prisma";
import { runMatchSyncIfDue } from "@/lib/matchSync";
import { apiMatchWhere } from "@/lib/matchQuery";

export const dynamic = "force-dynamic";

/**
 * One-time production bootstrap: remove seed/demo rows and pull real fixtures.
 * Auth: x-cron-secret header or admin session.
 */
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const authorizedByCron = Boolean(cronSecret && provided === cronSecret);

  if (!authorizedByCron) {
    const user = await getCurrentUser();
    if (!user?.isAdmin) return fail("Unauthorized", 401);
  }

  const purged = await purgeDemoData(prisma);
  const sync = await runMatchSyncIfDue(true);
  const fixtureCount = await prisma.match.count({ where: apiMatchWhere() });

  return ok({
    purged,
    sync: sync.summary,
    syncRan: sync.synced,
    fixtureCount,
    lastMatchSyncAt: sync.lastSyncAt?.toISOString() ?? null,
  });
}

export const POST = route(handle);
export const GET = route(handle);
