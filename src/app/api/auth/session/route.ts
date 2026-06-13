import { getCurrentUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await getCurrentUser();
  return ok({ user });
});
