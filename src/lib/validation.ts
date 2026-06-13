import { z } from "zod";
import { CATEGORY_BY_KEY, CategoryKey } from "./categories";
import { PredictionValue } from "./scoring";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only");

export function validateUsername(input: unknown): string {
  return usernameSchema.parse(input);
}

const scoreSchema = z.object({
  homeGoals: z.number().int().min(0).max(50),
  awayGoals: z.number().int().min(0).max(50),
});

const outcomeSchema = z.object({
  outcome: z.enum(["home", "draw", "away"]),
});

const bttsSchema = z.object({
  btts: z.enum(["yes", "no"]),
});

function rangeSchema(allowed: string[]) {
  return z.object({ range: z.enum(allowed as [string, ...string[]]) });
}

/**
 * Validates and normalizes a prediction value against its category definition.
 * Throws (ZodError / Error) on invalid input.
 */
export function validatePredictionValue(
  categoryKey: string,
  rawValue: unknown
): PredictionValue {
  const def = CATEGORY_BY_KEY[categoryKey];
  if (!def) throw new Error(`Unknown category: ${categoryKey}`);

  switch (def.key as CategoryKey) {
    case "exact_score":
      return scoreSchema.parse(rawValue) as PredictionValue;
    case "correct_result":
      return outcomeSchema.parse(rawValue) as PredictionValue;
    case "btts":
      return bttsSchema.parse(rawValue) as PredictionValue;
    case "total_goals":
    case "corners": {
      const allowed = (def.options ?? []).map((o) => o.value);
      return rangeSchema(allowed).parse(rawValue) as PredictionValue;
    }
    default:
      throw new Error(`Unsupported category: ${categoryKey}`);
  }
}

export const emailSchema = z.string().trim().toLowerCase().email();
