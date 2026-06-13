import { createHash, randomBytes } from "crypto";
import { appUrl } from "./config";

export const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_USERINFO_URL = "https://api.x.com/2/users/me";
export const X_SCOPES = ["tweet.read", "users.read"].join(" ");

export const X_STATE_COOKIE = "x_oauth_state";
export const X_VERIFIER_COOKIE = "x_oauth_verifier";

export function xRedirectUri(): string {
  return `${appUrl}/api/auth/x/callback`;
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

export function buildAuthorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: xRedirectUri(),
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  verifier: string
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
      redirect_uri: xRedirectUri(),
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
