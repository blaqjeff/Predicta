/**
 * Pull World Cup fixtures from football-data.org into the database.
 * Requires FOOTBALL_DATA_TOKEN and DATABASE_URL in the environment.
 */
import { runMatchSyncIfDue } from "../src/lib/matchSync";
import { isSportsApiConfigured } from "../src/lib/sportsApi";

async function main() {
  if (!isSportsApiConfigured()) {
    console.error("FOOTBALL_DATA_TOKEN is not set.");
    process.exit(1);
  }

  const result = await runMatchSyncIfDue(true);
  if (!result.synced || !result.summary) {
    console.error("Sync did not run:", result.skippedReason ?? "unknown");
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        created: result.summary.created,
        updated: result.summary.updated,
        finishedWithResult: result.summary.finishedWithResult,
        lastSyncAt: result.lastSyncAt?.toISOString() ?? null,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
