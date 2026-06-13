/**
 * When predictions open and close for a match.
 *
 * Opens: midnight (00:00) on the calendar day *before* kickoff, in MATCH_DAY_TIMEZONE
 * (default Africa/Lagos / WAT). So a 2am Tuesday kickoff is open from Monday 00:00 WAT.
 * Locks: at kickoff (UTC instant from the API).
 */

const DEFAULT_TZ = "Africa/Lagos";

export function getMatchDayTimezone(): string {
  return process.env.MATCH_DAY_TIMEZONE?.trim() || DEFAULT_TZ;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function getLocalParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour") % 24,
    minute: pick("minute"),
  };
}

/** Calendar date arithmetic (Y-M-D), independent of timezone. */
function addCalendarDays(y: number, m: number, d: number, delta: number) {
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
  };
}

/** Finds the UTC instant for a local wall-clock time in `timeZone`. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0);
  for (let offsetMs = -18 * 3_600_000; offsetMs <= 18 * 3_600_000; offsetMs += 15 * 60_000) {
    const candidate = new Date(anchor + offsetMs);
    const p = getLocalParts(candidate, timeZone);
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      return candidate;
    }
  }
  throw new Error(`Could not resolve ${year}-${month}-${day} ${hour}:${minute} in ${timeZone}`);
}

/** Midnight at the start of the calendar day before kickoff (fan-facing timezone). */
export function getPredictionOpensAt(
  kickoffAt: Date | string,
  timeZone = getMatchDayTimezone()
): Date {
  const kickoff = new Date(kickoffAt);
  const local = getLocalParts(kickoff, timeZone);
  const openDay = addCalendarDays(local.year, local.month, local.day, -1);
  return zonedTimeToUtc(
    openDay.year,
    openDay.month,
    openDay.day,
    0,
    0,
    timeZone
  );
}

export function isPredictionLocked(kickoffAt: Date | string, now = new Date()): boolean {
  return now >= new Date(kickoffAt);
}

export function isPredictionOpen(
  kickoffAt: Date | string,
  now = new Date()
): boolean {
  if (isPredictionLocked(kickoffAt, now)) return false;
  return now >= getPredictionOpensAt(kickoffAt);
}

export function isPredictionTooEarly(
  kickoffAt: Date | string,
  now = new Date()
): boolean {
  if (isPredictionLocked(kickoffAt, now)) return false;
  return now < getPredictionOpensAt(kickoffAt);
}

/** @deprecated Use isPredictionLocked */
export function isLocked(kickoffAt: Date | string): boolean {
  return isPredictionLocked(kickoffAt);
}

export function formatPredictionOpensAt(kickoffAt: Date | string): string {
  const opens = getPredictionOpensAt(kickoffAt);
  const tz = getMatchDayTimezone();
  return opens.toLocaleString(undefined, {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
