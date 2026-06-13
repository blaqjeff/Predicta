import { NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { settleMatch } from "@/lib/settlement";

export const POST = route(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  const matchId = String(body.matchId ?? "");
  if (!matchId) return fail("matchId is required", 422);
  const result = await settleMatch(matchId);
  return ok(result);
});
