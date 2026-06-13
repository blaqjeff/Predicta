import { CategoryKey } from "./categories";

/** Normalized, settled match result. */
export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  /** Total corners in the match. Optional: some matches may not report corners. */
  corners?: number;
}

/** A user's prediction value for a given category. */
export type PredictionValue =
  | { homeGoals: number; awayGoals: number } // exact_score
  | { range: string } // total_goals | corners
  | { outcome: "home" | "draw" | "away" } // correct_result
  | { btts: "yes" | "no" }; // btts

function totalGoals(r: MatchResult): number {
  return r.homeGoals + r.awayGoals;
}

function resultOutcome(r: MatchResult): "home" | "draw" | "away" {
  if (r.homeGoals > r.awayGoals) return "home";
  if (r.homeGoals < r.awayGoals) return "away";
  return "draw";
}

function inRange(value: number, range: string): boolean {
  if (range.endsWith("+")) {
    const min = parseInt(range.slice(0, -1), 10);
    return value >= min;
  }
  const [minStr, maxStr] = range.split("-");
  const min = parseInt(minStr, 10);
  const max = parseInt(maxStr, 10);
  return value >= min && value <= max;
}

/**
 * Returns true if the prediction is correct for the given result.
 * Returns null when the result lacks the data needed to score (e.g. no corners),
 * so the caller can leave the prediction unsettled rather than mark it wrong.
 */
export function isPredictionCorrect(
  categoryKey: CategoryKey,
  value: PredictionValue,
  result: MatchResult
): boolean | null {
  switch (categoryKey) {
    case "exact_score": {
      const v = value as { homeGoals: number; awayGoals: number };
      return v.homeGoals === result.homeGoals && v.awayGoals === result.awayGoals;
    }
    case "correct_result": {
      const v = value as { outcome: "home" | "draw" | "away" };
      return v.outcome === resultOutcome(result);
    }
    case "total_goals": {
      const v = value as { range: string };
      return inRange(totalGoals(result), v.range);
    }
    case "corners": {
      const v = value as { range: string };
      if (result.corners === undefined || result.corners === null) return null;
      return inRange(result.corners, v.range);
    }
    case "btts": {
      const v = value as { btts: "yes" | "no" };
      const actual = result.homeGoals > 0 && result.awayGoals > 0 ? "yes" : "no";
      return v.btts === actual;
    }
    default:
      return null;
  }
}

/**
 * Points awarded for a single prediction: the (track-overridden) category weight
 * if correct, 0 if wrong, null if not scoreable yet.
 */
export function scorePrediction(
  categoryKey: CategoryKey,
  value: PredictionValue,
  result: MatchResult,
  weight: number
): number | null {
  const correct = isPredictionCorrect(categoryKey, value, result);
  if (correct === null) return null;
  return correct ? weight : 0;
}
