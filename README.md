<p align="center">
  <img src="public/predicta-logo.png" alt="Predicta" width="420" />
</p>

# Predicta — World Cup Onchain Prediction Leaderboard

Predict World Cup matches across weighted categories (exact score, total goals,
corners, correct result, both-teams-to-score) and climb an onchain leaderboard.
Hybrid architecture: predictions and points live in a database for speed and cost,
while Solana handles the paid "revert" fee, reward payouts, and a verifiable
onchain hash of every settled result.

## Highlights

- **Self-hosted auth, zero per-user fees** — sign in with X (OAuth 2.0 + PKCE),
  email + OTP, or a Solana wallet (sign-in-with-Solana message signing).
- **Reward wallet logic** — wallet sign-in auto-sets your reward wallet; X/email
  users add one later in their profile. Multiple sign-in methods link to one account.
- **Weighted scoring** — each category is worth different points (exact score 1000,
  total goals 300, corners 200, correct result 200, BTTS 150 by default). Weights
  are DB-driven and overridable per track.
- **One prediction per category per match** — changing a placed pick requires a
  flat onchain revert fee (SOL or USDC) verified onchain before the edit unlocks.
- **Automatic settlement** — a scheduled job pulls results from a free sports API,
  auto-scores every prediction, and commits a `sha256` of the result onchain via
  the Memo program for public verification.
- **Tracks** — a main track plus sponsor tracks with their own category subset,
  custom weights, date window, branding, and isolated leaderboard.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind v4
- Prisma ORM (SQLite locally; switch to PostgreSQL for production)
- Solana web3.js + SPL Token; Memo program for result commitments
- `jose` (session JWTs), `tweetnacl` + `bs58` (wallet signature verification), `zod`

## Getting started

```bash
npm install
cp .env.example .env      # fill in values (works out of the box for local dev)
npm run db:migrate        # create the SQLite db + apply migrations
npm run db:seed           # seed categories, tracks, demo matches + predictions
npm run dev
```

Open http://localhost:3000. The seed creates an admin (`admin@example.com`) and
demo players (`alice`, `bob`, `carol`) with a populated leaderboard. To sign in as
any of them, use email login — when no email provider is configured the OTP is
printed to the **server console**.

## Configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file by default; a Postgres URL in production (also change `provider` in `prisma/schema.prisma`). |
| `SESSION_SECRET` | Signs session JWTs. Use a long random string. |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X OAuth app. Callback: `<app>/api/auth/x/callback`. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Send real OTP emails (Resend free tier). Optional locally. |
| `SOLANA_RPC_URL` / `NEXT_PUBLIC_*` | RPC endpoint + public cluster config. Devnet by default. |
| `NEXT_PUBLIC_TREASURY_WALLET` | Receives revert fees. Required for the revert flow. |
| `NEXT_PUBLIC_USDC_MINT` | USDC mint (devnet by default). |
| `NEXT_PUBLIC_REVERT_FEE_SOL` / `_USDC` | Flat revert fee amounts (manually adjustable). |
| `ORACLE_SECRET_KEY` | Signer that posts result-hash commitments onchain. Optional. |
| `CRON_SECRET` | Authorizes the settlement endpoint for schedulers. |
| `FOOTBALL_DATA_TOKEN` | Free football-data.org token (covers the World Cup via `WC`). Sent as the `X-Auth-Token` header. |
| `FOOTBALL_DATA_COMPETITION` | League code (default `WC` = FIFA World Cup). |

The client reads football-data.org **response headers** on every call to avoid hitting the rate limiter:

- `X-RequestsAvailable` (or on the free tier, `X-Requests-Available-Minute`) - requests left before you are blocked
- `X-RequestCounter-Reset` - seconds until the counter resets

If quota is exhausted the client waits for the reset window; HTTP 429 triggers one automatic retry. Settlement responses include the last observed rate-limit snapshot as `footballDataRateLimit`.

### Match sync and prediction windows

Fixtures are stored in the database. **Page visits never call the sports API** — `/`, `/matches`, and match detail pages only read `Match` rows from Postgres/SQLite.

Background jobs keep data fresh:

- **Daily** — `GET /api/cron/sync-matches` (Vercel cron at 23:00 UTC ≈ midnight WAT) pulls the full fixture list and upserts it.
- **Every 30 minutes** — `/api/settlement` settles finished matches. It only re-syncs from the API when a match is live, finished, or within ±4 hours of kickoff; otherwise it skips the pull if data is younger than `MATCH_SYNC_INTERVAL_HOURS` (default 24h).

Admins can also run either job manually from `/admin` or with the `x-cron-secret` header.

Predictions **open** at **00:00 on the calendar day before kickoff** in `MATCH_DAY_TIMEZONE` (default `Africa/Lagos`, WAT). They **lock** at kickoff. Example: a Tuesday 2am WAT kickoff is open from Monday 00:00 WAT.

## How it works

### Auth
`src/lib/auth.ts` maps each sign-in method to an `AuthIdentity` row; all identities
for a person point to one `User`. X handles become the username automatically; other
users set theirs in the profile.

### Predictions & scoring
`POST /api/predictions` enforces one prediction per `(user, match, category, track)`.
A second attempt returns HTTP 402 with `code: REVERT_REQUIRED`. Scoring lives in
`src/lib/scoring.ts`; weights come from `TrackCategory` (per-track override) or the
category's `baseWeight`.

### Revert (paid edit)
The client builds a SOL or USDC transfer to the treasury (`src/lib/solanaClient.ts`),
then `POST /api/revert` verifies the transaction onchain (`src/lib/solana.ts`),
records a `RevertPayment`, and unlocks exactly one edit.

### Settlement
`POST /api/settlement` (cron or admin) runs `syncMatchesFromApi()` then
`settleAllFinished()` in `src/lib/settlement.ts`: scores predictions, posts the
result-hash commitment via the Memo program, and rebuilds leaderboards. Admins can
also enter results manually and settle individual matches in `/admin`.

> Note: the free sports API tier does not report corner counts, so corner
> predictions stay unsettled unless an admin enters corners on the match.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run db:migrate` / `db:seed` / `db:reset` / `db:generate`

## Production notes

- Switch `prisma/schema.prisma` `datasource.provider` to `postgresql` and set a
  Postgres `DATABASE_URL`; the JSON-as-text columns work on both.
- Set a strong `SESSION_SECRET` and `CRON_SECRET`, real X credentials, a funded
  treasury, an oracle signer, and mainnet RPC + mainnet USDC mint.
- `vercel.json` schedules settlement every 30 minutes; Vercel Cron sends
  `Authorization: Bearer <CRON_SECRET>`, which the route accepts.
