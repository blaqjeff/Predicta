export function formatKickoff(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPoints(n: number): string {
  return n.toLocaleString();
}

export function shortAddress(addr?: string | null): string {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export {
  isLocked,
  isPredictionLocked,
  isPredictionOpen,
  isPredictionTooEarly,
  getPredictionOpensAt,
  formatPredictionOpensAt,
  getMatchDayTimezone,
} from "./predictionWindow";
