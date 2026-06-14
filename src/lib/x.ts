import { createHash, randomBytes } from "crypto";
import { appUrl } from "./config";

/** x.com avoids the twitter.com login loop many users hit during OAuth 2.0. */
export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_USERINFO_URL = "https://api.x.com/2/users/me";
export const X_SCOPES = ["users.read", "tweet.read"].join(" ");

export const X_STATE_COOKIE = "x_oauth_state";
export const X_VERIFIER_COOKIE = "x_oauth_verifier";
export const X_REDIRECT_COOKIE = "x_oauth_redirect";

/** Prefer the live request origin on Vercel; fall back to configured app URL. */
export function resolveAppOrigin(forwardedHost: string | null, forwardedProto: string | null, fallbackOrigin: string): string {
  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";
    return `${proto}://${forwardedHost.split(",")[0]?.trim()}`;
  }
  return fallbackOrigin.replace(/\/$/, "");
}

export function xRedirectUri(origin = appUrl): string {
  return `${origin.replace(/\/$/, "")}/api/auth/x/callback`;
}

export function isXConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(challenge: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  verifier: string,
  redirectUri: string
): Promise<string> {
  const basic = Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`X token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchXUser(
  accessToken: string
): Promise<{ id: string; username: string; name: string }> {
  const res = await fetch(X_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`X user fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data: { id: string; username: string; name: string };
  };
  return data.data;
}
