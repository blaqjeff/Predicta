import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { SEED_MATCH_PREFIX } from "./matchQuery";
import { stringifyJson } from "./json";
import {
  isSportsApiConfigured,
  type FootballDataRateLimit,
} from "./sportsApi";
import { syncMatchesFromApi, type SyncSummary } from "./settlement";

const LAST_SYNC_KEY = "lastMatchSync";

export interface MatchSyncState {
  lastSyncAt: Date | null;
  summary: SyncSummary | null;
}

export interface RunMatchSyncResult {
  synced: boolean;
  summary: SyncSummary | null;
  skippedReason?: "not_configured" | "fresh";
  lastSyncAt: Date | null;
}

function defaultSyncIntervalMs(): number {
  const hours = Number(process.env.MATCH_SYNC_INTERVAL_HOURS ?? "24");
  if (!Number.isFinite(hours) || hours <= 0) return 24 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

async function readSyncState(): Promise<MatchSyncState> {
  const row = await prisma.appMeta.findUnique({ where: { key: LAST_SYNC_KEY } });
  if (!row) return { lastSyncAt: null, summary: null };

  try {
    const parsed = JSON.parse(row.value) as {
      at: string;
      summary: SyncSummary;
    };
    return {
      lastSyncAt: new Date(parsed.at),
      summary: parsed.summary ?? null,
    };
  } catch {
    return { lastSyncAt: new Date(row.updatedAt), summary: null };
  }
}

async function writeSyncState(summary: SyncSummary): Promise<Date> {
  const at = new Date();
  await prisma.appMeta.upsert({
    where: { key: LAST_SYNC_KEY },
    create: {
      key: LAST_SYNC_KEY,
      value: stringifyJson({ at: at.toISOString(), summary }),
    },
    update: {
      value: stringifyJson({ at: at.toISOString(), summary }),
    },
  });
  return at;
}

/** Read-only snapshot of when fixtures were last pulled from the sports API. */
export async function getMatchSyncState(): Promise<MatchSyncState> {
  return readSyncState();
}

/**
 * Pull fixtures from football-data.org when due, upsert into the DB, and record
 * the sync time. Page routes should NOT call this — they read Match rows only.
 *
 * @param force When true (cron/admin), always sync. When false, skip if synced
 *              within MATCH_SYNC_INTERVAL_HOURS (default 24h).
 */
export async function runMatchSyncIfDue(
  force = false
): Promise<RunMatchSyncResult> {
  if (!isSportsApiConfigured()) {
    return {
      synced: false,
      summary: null,
      skippedReason: "not_configured",
      lastSyncAt: null,
    };
  }

  const state = await readSyncState();
  const intervalMs = defaultSyncIntervalMs();
  const isFresh =
    state.lastSyncAt !== null &&
    Date.now() - state.lastSyncAt.getTime() < intervalMs;

  if (!force && isFresh) {
    return {
      synced: false,
      summary: state.summary,
      skippedReason: "fresh",
      lastSyncAt: state.lastSyncAt,
    };
  }

  const summary = await syncMatchesFromApi();
  const lastSyncAt = await writeSyncState(summary);

  return { synced: true, summary, lastSyncAt };
}

export function getLastRateLimitFromSync(
  summary: SyncSummary | null
): FootballDataRateLimit | null {
  return summary?.rateLimit ?? null;
}

/** True when we should bypass the daily interval and pull fresh API data. */
export async function shouldForceMatchSync(): Promise<boolean> {
  const now = Date.now();
  const windowMs = 4 * 60 * 60 * 1000; // kickoff ±4h or live/finished
  const from = new Date(now - windowMs);
  const to = new Date(now + windowMs);

  const activeCount = await prisma.match.count({
    where: {
      AND: [
        { externalId: { not: null } },
        { NOT: { externalId: { startsWith: SEED_MATCH_PREFIX } } },
        {
          OR: [
            { status: "live" },
            { status: "finished" },
            {
              status: "scheduled",
              kickoffAt: { gte: from, lte: to },
            },
          ],
        },
      ],
    } satisfies Prisma.MatchWhereInput,
  });

  return activeCount > 0;
}
