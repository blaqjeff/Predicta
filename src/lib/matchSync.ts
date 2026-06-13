import {
  isSportsApiConfigured,
  type FootballDataRateLimit,
} from "./sportsApi";
import { syncMatchesFromApi, type SyncSummary } from "./settlement";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // at most one API pull per 5 minutes per instance

let lastSyncAt = 0;
let lastSyncSummary: SyncSummary | null = null;

export interface EnsureSyncResult {
  synced: boolean;
  summary: SyncSummary | null;
  skippedReason?: "cooldown" | "not_configured";
}

/**
 * Pulls World Cup fixtures from football-data.org when configured.
 * Throttled so page loads do not burn the free-tier minute quota.
 */
export async function ensureMatchesSynced(
  force = false
): Promise<EnsureSyncResult> {
  if (!isSportsApiConfigured()) {
    return { synced: false, summary: null, skippedReason: "not_configured" };
  }

  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_COOLDOWN_MS) {
    return {
      synced: false,
      summary: lastSyncSummary,
      skippedReason: "cooldown",
    };
  }

  lastSyncAt = now;
  lastSyncSummary = await syncMatchesFromApi();
  return { synced: true, summary: lastSyncSummary };
}

export function getLastSyncSummary(): SyncSummary | null {
  return lastSyncSummary;
}

export function getLastRateLimitFromSync(): FootballDataRateLimit | null {
  return lastSyncSummary?.rateLimit ?? null;
}
