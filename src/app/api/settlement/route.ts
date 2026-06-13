import { NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { settleAllFinished, syncMatchesFromApi } from "@/lib/settlement";

export const dynamic = "force-dynamic";

/**
 * Settlement entrypoint. Intended to be hit by a scheduler (cron) with the
 * x-cron-secret header, or manually by an admin. Syncs results from the free
 * sports API and settles every finished match.
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

  const sync = await syncMatchesFromApi();
  const settled = await settleAllFinished();

  return ok({
    sync,
    settledMatches: settled.length,
    details: settled,
  });
}

export const POST = route(handle);
export const GET = route(handle);
