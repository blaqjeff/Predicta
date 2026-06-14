import { PrismaClient } from "@prisma/client";

const SEED_MATCH_PREFIX = "seed-";
const DEMO_USERNAMES = ["alice", "bob", "carol", "admin"];

export async function purgeDemoData(prisma: PrismaClient) {
  const seedMatches = await prisma.match.findMany({
    where: { externalId: { startsWith: SEED_MATCH_PREFIX } },
    select: { id: true },
  });

  let removedMatches = 0;
  if (seedMatches.length > 0) {
    const ids = seedMatches.map((m) => m.id);
    await prisma.prediction.deleteMany({ where: { matchId: { in: ids } } });
    const res = await prisma.match.deleteMany({ where: { id: { in: ids } } });
    removedMatches = res.count;
  }

  const demoUsers = await prisma.user.findMany({
    where: { username: { in: DEMO_USERNAMES } },
    select: { id: true, username: true },
  });

  let removedUsers = 0;
  for (const user of demoUsers) {
    await prisma.leaderboardEntry.deleteMany({ where: { userId: user.id } });
    await prisma.revertPayment.deleteMany({ where: { userId: user.id } });
    await prisma.prediction.deleteMany({ where: { userId: user.id } });
    await prisma.authIdentity.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    removedUsers += 1;
  }

  return { removedMatches, removedUsers };
}
