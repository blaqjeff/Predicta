/**
 * Category metadata: the canonical list of predictable categories, their default
 * weights, the shape of a valid prediction value, and the selectable options the
 * UI renders. This is the source of truth used by the seed and by validation.
 */

export type CategoryKey =
  | "exact_score"
  | "correct_result"
  | "total_goals"
  | "corners"
  | "btts";

export type CategoryInputType = "score" | "options" | "boolean";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  description: string;
  baseWeight: number;
  inputType: CategoryInputType;
  /** For "options" inputs: the selectable values. */
  options?: { value: string; label: string }[];
  sortOrder: number;
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: "exact_score",
    label: "Exact Score",
    description: "Predict the exact final score. Hardest to get right.",
    baseWeight: 1000,
    inputType: "score",
    sortOrder: 1,
  },
  {
    key: "total_goals",
    label: "Total Goals",
    description: "Pick the range for total goals scored by both teams.",
    baseWeight: 300,
    inputType: "options",
    options: [
      { value: "0-1", label: "0 - 1 goals" },
      { value: "2-3", label: "2 - 3 goals" },
      { value: "4-5", label: "4 - 5 goals" },
      { value: "6+", label: "6+ goals" },
    ],
    sortOrder: 2,
  },
  {
    key: "corners",
    label: "Corners",
    description: "Pick the range for total corner kicks in the match.",
    baseWeight: 150,
    inputType: "options",
    options: [
      { value: "0-7", label: "0 - 7 corners" },
      { value: "8-10", label: "8 - 10 corners" },
      { value: "11-13", label: "11 - 13 corners" },
      { value: "14+", label: "14+ corners" },
    ],
    sortOrder: 3,
  },
  {
    key: "correct_result",
    label: "Correct Result",
    description: "Predict the winner (or a draw).",
    baseWeight: 400,
    inputType: "options",
    options: [
      { value: "home", label: "Home win" },
      { value: "draw", label: "Draw" },
      { value: "away", label: "Away win" },
    ],
    sortOrder: 4,
  },
  {
    key: "btts",
    label: "Both Teams To Score",
    description: "Will both teams score at least one goal?",
    baseWeight: 350,
    inputType: "boolean",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    sortOrder: 5,
  },
];

export const CATEGORY_BY_KEY: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.key, c])
);

export const CORNERS_CATEGORY: CategoryKey = "corners";

/** Categories scoreable from final score alone (API auto-settlement). */
export const GOAL_CATEGORY_KEYS: CategoryKey[] = [
  "exact_score",
  "correct_result",
  "total_goals",
  "btts",
];

export function categorySchema(def: CategoryDef): string {
  return JSON.stringify({
    inputType: def.inputType,
    options: def.options ?? null,
  });
}
