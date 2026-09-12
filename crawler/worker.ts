import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncSkillConfigs } from "./config-loader";
import { processTaskQueue } from "./queue";
import { scheduleDueSources } from "./scheduler";

const POLL_MS = Number(process.env.CRAWL_POLL_MS || 30_000);

async function tick() {
  const enqueued = await scheduleDueSources();
  if (enqueued > 0) console.log(`已入队 ${enqueued} 个抓取任务`);
  await processTaskQueue({ once: true });
}

async function main() {
  await syncSkillConfigs();
  console.log(`[${new Date().toLocaleString("zh-CN")}] 采集 Worker 已启动`);

  if (process.env.CRAWL_ONCE === "1") {
    await tick();
    return;
  }

  await tick();
  setInterval(() => {
    tick().catch((error) => console.error("采集任务异常：", error));
  }, POLL_MS);
}

main()
  .catch((error) => {
    console.error("Worker 启动失败：", error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (process.env.CRAWL_ONCE === "1") void prisma.$disconnect();
  });
