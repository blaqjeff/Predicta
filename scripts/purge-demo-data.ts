import { purgeDemoData } from "@/lib/purgeDemo";
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await purgeDemoData(prisma);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
