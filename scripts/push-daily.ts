import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runDailyPushes } from "../src/lib/push";

async function main() {
  const results = await runDailyPushes({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
