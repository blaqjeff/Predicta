import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appUrl } from "@/lib/config";
import {
  buildAuthorizeUrl,
  generatePkce,
  isXConfigured,
  resolveAppOrigin,
  xRedirectUri,
  X_REDIRECT_COOKIE,
  X_STATE_COOKIE,
  X_VERIFIER_COOKIE,
} from "@/lib/x";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isXConfigured()) {
    return NextResponse.redirect(`${appUrl}/login?error=x_not_configured`);
  }

  const origin = resolveAppOrigin(
    req.headers.get("x-forwarded-host"),
    req.headers.get("x-forwarded-proto"),
    req.nextUrl.origin || appUrl
  );
  const redirectUri = xRedirectUri(origin);

  const { verifier, challenge, state } = generatePkce();
  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  cookieStore.set(X_STATE_COOKIE, state, opts);
  cookieStore.set(X_VERIFIER_COOKIE, verifier, opts);
  cookieStore.set(X_REDIRECT_COOKIE, redirectUri, opts);

  return NextResponse.redirect(buildAuthorizeUrl(challenge, state, redirectUri));
}
