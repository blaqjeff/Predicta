import { PrismaClient } from "@prisma/client";
import { CATEGORY_DEFS, categorySchema } from "../src/lib/categories";

const prisma = new PrismaClient();

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

/** Seeds categories and tracks only — no demo matches, users, or predictions. */
async function main() {
  console.log("Seeding categories...");
  const categories = [] as { id: string; key: string; baseWeight: number }[];
  for (const def of CATEGORY_DEFS) {
    const cat = await prisma.category.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        label: def.label,
        baseWeight: def.baseWeight,
        schema: categorySchema(def),
        sortOrder: def.sortOrder,
      },
      update: {
        label: def.label,
        baseWeight: def.baseWeight,
        schema: categorySchema(def),
        sortOrder: def.sortOrder,
      },
    });
    categories.push(cat);
  }
  const catByKey = Object.fromEntries(categories.map((c) => [c.key, c]));

  console.log("Seeding main track...");
  const mainTrack = await prisma.track.upsert({
    where: { slug: "world-cup" },
    create: {
      slug: "world-cup",
      name: "Predicta Main Track",
      isMain: true,
      branding: JSON.stringify({ color: "#16a34a", tagline: "The global board" }),
    },
    update: { isMain: true, active: true },
  });
  for (const def of CATEGORY_DEFS) {
    await prisma.trackCategory.upsert({
      where: {
        trackId_categoryId: {
          trackId: mainTrack.id,
          categoryId: catByKey[def.key].id,
        },
      },
      create: {
        trackId: mainTrack.id,
        categoryId: catByKey[def.key].id,
        weight: def.baseWeight,
        enabled: true,
      },
      update: { weight: def.baseWeight, enabled: true },
    });
  }

  console.log("Seeding sponsor track...");
  const sponsorTrack = await prisma.track.upsert({
    where: { slug: "solana-track" },
    create: {
      slug: "solana-track",
      name: "Solana Speed Track",
      sponsor: "Solana Foundation",
      branding: JSON.stringify({
        color: "#9945FF",
        tagline: "Predict fast. Win onchain.",
      }),
      startAt: daysFromNow(-7),
      endAt: daysFromNow(60),
    },
    update: { active: true },
  });
  const sponsorWeights: Record<string, number> = {
    exact_score: 1200,
    correct_result: 500,
    btts: 400,
  };
  for (const [key, weight] of Object.entries(sponsorWeights)) {
    await prisma.trackCategory.upsert({
      where: {
        trackId_categoryId: {
          trackId: sponsorTrack.id,
          categoryId: catByKey[key].id,
        },
      },
      create: {
        trackId: sponsorTrack.id,
        categoryId: catByKey[key].id,
        weight,
        enabled: true,
      },
      update: { weight, enabled: true },
    });
  }

  console.log("Seed complete (categories + tracks only).");
  console.log("Run: npm run db:purge-demo  — remove old demo fixtures if present");
  console.log("Run: npm run sync:matches  — pull World Cup fixtures from the API");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
