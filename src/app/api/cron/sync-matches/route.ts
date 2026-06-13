import { NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { runMatchSyncIfDue } from "@/lib/matchSync";

export const dynamic = "force-dynamic";

/**
 * Scheduled fixture sync. Intended for daily cron (see vercel.json).
 * Upserts all competition matches into the DB; page routes read from the DB only.
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

  const result = await runMatchSyncIfDue(true);

  return ok({
    synced: result.synced,
    summary: result.summary,
    lastMatchSyncAt: result.lastSyncAt?.toISOString() ?? null,
    footballDataRateLimit: result.summary?.rateLimit ?? null,
  });
}

export const POST = route(handle);
export const GET = route(handle);
