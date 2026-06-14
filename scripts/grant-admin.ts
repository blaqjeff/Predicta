import { PrismaClient } from "@prisma/client";

const username = process.argv[2];
if (!username) {
  console.error("Usage: npx tsx scripts/grant-admin.ts <username>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`User @${username} not found. They must sign in once first.`);
    process.exit(1);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: true },
  });
  console.log(`@${username} is now an admin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
