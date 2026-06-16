import { NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { settleMatchCorners, settleMatchGoals } from "@/lib/settlement";

export const POST = route(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  const matchId = String(body.matchId ?? "");
  const phase = String(body.phase ?? "corners");
  if (!matchId) return fail("matchId is required", 422);

  if (phase === "goals") {
    return ok(await settleMatchGoals(matchId));
  }
  if (phase === "corners") {
    return ok(await settleMatchCorners(matchId));
  }
  return fail("phase must be goals or corners", 422);
});
