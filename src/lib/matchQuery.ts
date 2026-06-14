import type { Prisma } from "@prisma/client";

export const SEED_MATCH_PREFIX = "seed-";

/** Prisma filter for football-data.org fixtures (excludes local seed/demo rows). */
export function apiMatchWhere(
  extra?: Prisma.MatchWhereInput
): Prisma.MatchWhereInput {
  return {
    AND: [
      { externalId: { not: null } },
      { NOT: { externalId: { startsWith: SEED_MATCH_PREFIX } } },
      ...(extra ? [extra] : []),
    ],
  };
}

export function isApiFixture(externalId: string | null | undefined): boolean {
  return Boolean(
    externalId &&
      !externalId.startsWith(SEED_MATCH_PREFIX)
  );
}
