import { clearSession } from "@/lib/session";
import { ok, route } from "@/lib/api";

export const POST = route(async () => {
  await clearSession();
  return ok({ loggedOut: true });
});
