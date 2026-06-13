import { PrismaClient } from "@prisma/client";
import { CATEGORY_DEFS, categorySchema } from "../src/lib/categories";
import { settleMatch } from "../src/lib/settlement";

const prisma = new PrismaClient();

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

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
      name: "World Cup Main Track",
      isMain: true,
      branding: JSON.stringify({ color: "#16a34a", tagline: "The global board" }),
    },
    update: {},
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
      endAt: daysFromNow(30),
    },
    update: {},
  });
  // Sponsor track uses a subset with its own weights.
  const sponsorWeights: Record<string, number> = {
    exact_score: 1200,
    correct_result: 250,
    btts: 200,
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

  console.log("Seeding matches...");
  const matchA = await prisma.match.upsert({
    where: { externalId: "seed-A" },
    create: {
      externalId: "seed-A",
      homeTeam: "Argentina",
      awayTeam: "France",
      kickoffAt: daysFromNow(-2),
      stage: "Final",
      status: "finished",
      result: JSON.stringify({ homeGoals: 2, awayGoals: 1, corners: 9 }),
    },
    update: {},
  });
  const matchB = await prisma.match.upsert({
    where: { externalId: "seed-B" },
    create: {
      externalId: "seed-B",
      homeTeam: "Brazil",
      awayTeam: "Spain",
      kickoffAt: daysFromNow(-1),
      stage: "Semi Final",
      status: "finished",
      result: JSON.stringify({ homeGoals: 0, awayGoals: 0, corners: 12 }),
    },
    update: {},
  });
  await prisma.match.upsert({
    where: { externalId: "seed-C" },
    create: {
      externalId: "seed-C",
      homeTeam: "Germany",
      awayTeam: "England",
      kickoffAt: daysFromNow(2),
      stage: "Group Stage",
      status: "scheduled",
    },
    update: {},
  });
  await prisma.match.upsert({
    where: { externalId: "seed-D" },
    create: {
      externalId: "seed-D",
      homeTeam: "Netherlands",
      awayTeam: "Portugal",
      kickoffAt: daysFromNow(3),
      stage: "Group Stage",
      status: "scheduled",
    },
    update: {},
  });

  console.log("Seeding users...");
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@example.com",
      isAdmin: true,
      identities: { create: { provider: "email", providerId: "admin@example.com" } },
    },
    update: { isAdmin: true },
  });

  const demoUsers = [
    { username: "alice", email: "alice@example.com" },
    { username: "bob", email: "bob@example.com" },
    { username: "carol", email: "carol@example.com" },
  ];
  const users = [admin];
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      create: {
        username: u.username,
        email: u.email,
        identities: { create: { provider: "email", providerId: u.email } },
      },
      update: {},
    });
    users.push(user);
  }

  console.log("Seeding predictions...");
  // value generators per category
  type Pred = { categoryKey: string; value: unknown };
  const predictionSets: Record<string, Pred[]> = {
    alice: [
      { categoryKey: "exact_score", value: { homeGoals: 2, awayGoals: 1 } }, // matchA correct
      { categoryKey: "correct_result", value: { outcome: "home" } },
      { categoryKey: "total_goals", value: { range: "2-3" } },
      { categoryKey: "corners", value: { range: "8-10" } },
      { categoryKey: "btts", value: { btts: "yes" } },
    ],
    bob: [
      { categoryKey: "exact_score", value: { homeGoals: 1, awayGoals: 1 } },
      { categoryKey: "correct_result", value: { outcome: "home" } },
      { categoryKey: "total_goals", value: { range: "2-3" } },
      { categoryKey: "corners", value: { range: "11-13" } },
      { categoryKey: "btts", value: { btts: "yes" } },
    ],
    carol: [
      { categoryKey: "exact_score", value: { homeGoals: 0, awayGoals: 0 } },
      { categoryKey: "correct_result", value: { outcome: "draw" } },
      { categoryKey: "total_goals", value: { range: "0-1" } },
      { categoryKey: "corners", value: { range: "11-13" } },
      { categoryKey: "btts", value: { btts: "no" } },
    ],
  };

  const userByName = Object.fromEntries(users.map((u) => [u.username, u]));
  for (const match of [matchA, matchB]) {
    for (const [name, preds] of Object.entries(predictionSets)) {
      const user = userByName[name];
      for (const pred of preds) {
        const cat = catByKey[pred.categoryKey];
        // Place in main track (all categories) + sponsor track (subset only).
        for (const track of [mainTrack, sponsorTrack]) {
          if (
            track.id === sponsorTrack.id &&
            !["exact_score", "correct_result", "btts"].includes(pred.categoryKey)
          ) {
            continue;
          }
          await prisma.prediction.upsert({
            where: {
              userId_matchId_categoryId_trackId: {
                userId: user.id,
                matchId: match.id,
                categoryId: cat.id,
                trackId: track.id,
              },
            },
            create: {
              userId: user.id,
              matchId: match.id,
              categoryId: cat.id,
              trackId: track.id,
              value: JSON.stringify(pred.value),
              status: "locked",
            },
            update: {},
          });
        }
      }
    }
  }

  console.log("Settling finished matches...");
  for (const match of [matchA, matchB]) {
    // Reset to finished so settleMatch processes it on re-seed.
    await prisma.match.update({
      where: { id: match.id },
      data: { status: "finished" },
    });
    const res = await settleMatch(match.id);
    console.log(`  ${match.homeTeam} vs ${match.awayTeam}:`, res.scored, "scored");
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
