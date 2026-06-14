import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/config";
import { setSession } from "@/lib/session";
import {
  exchangeCodeForToken,
  fetchXUser,
  resolveAppOrigin,
  xRedirectUri,
  X_REDIRECT_COOKIE,
  X_STATE_COOKIE,
  X_VERIFIER_COOKIE,
} from "@/lib/x";
import {
  findOrCreateUserByIdentity,
  getCurrentUser,
  linkIdentity,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get(X_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(X_VERIFIER_COOKIE)?.value;
  const savedRedirect =
    cookieStore.get(X_REDIRECT_COOKIE)?.value ??
    xRedirectUri(
      resolveAppOrigin(
        req.headers.get("x-forwarded-host"),
        req.headers.get("x-forwarded-proto"),
        req.nextUrl.origin || appUrl
      )
    );
  cookieStore.delete(X_STATE_COOKIE);
  cookieStore.delete(X_VERIFIER_COOKIE);
  cookieStore.delete(X_REDIRECT_COOKIE);

  if (!code || !state || !savedState || state !== savedState || !verifier) {
    return NextResponse.redirect(`${appUrl}/login?error=x_state`);
  }

  try {
    const accessToken = await exchangeCodeForToken(code, verifier, savedRedirect);
    const xUser = await fetchXUser(accessToken);

    const current = await getCurrentUser();
    if (current) {
      await linkIdentity({
        userId: current.id,
        provider: "x",
        providerId: xUser.id,
      });
      if (!current.xHandle) {
        await prisma.user.update({
          where: { id: current.id },
          data: { xHandle: xUser.username },
        });
      }
      return NextResponse.redirect(`${appUrl}/profile?linked=x`);
    }

    const { userId, isNew } = await findOrCreateUserByIdentity({
      provider: "x",
      providerId: xUser.id,
      xHandle: xUser.username,
      // X users get their handle as the prediction username.
      desiredUsername: xUser.username,
    });
    // Keep the X handle in sync even for returning users.
    await prisma.user.update({
      where: { id: userId },
      data: { xHandle: xUser.username },
    });
    await setSession(userId);
    return NextResponse.redirect(`${appUrl}/${isNew ? "profile?welcome=1" : ""}`);
  } catch (err) {
    console.error("[x callback]", err);
    return NextResponse.redirect(`${appUrl}/login?error=x_failed`);
  }
}
