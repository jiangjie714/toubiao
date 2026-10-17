import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncSkillConfigs } from "./config-loader";
import { processTaskQueue } from "./queue";
import { scheduleDueSources } from "./scheduler";

const POLL_MS = Number(process.env.CRAWL_POLL_MS || 30_000);
let isRunning = false;

async function tick() {
  if (isRunning) return;
  isRunning = true;
  try {
    const enqueued = await scheduleDueSources();
    if (enqueued > 0) console.log(`[${new Date().toLocaleTimeString("zh-CN")}] 已入队 ${enqueued} 个抓取任务`);
    const processed = await processTaskQueue({ drain: true });
    if (processed > 0) console.log(`[${new Date().toLocaleTimeString("zh-CN")}] 本轮队列处理完成，已执行 ${processed} 个抓取任务`);
  } catch (error) {
    console.error("采集任务异常：", error);
  } finally {
    isRunning = false;
  }
}

async function main() {
  await syncSkillConfigs();
  console.log(`[${new Date().toLocaleString("zh-CN")}] 采集 Worker 已启动 (轮询间隔: ${POLL_MS / 1000}秒)`);

  if (process.env.CRAWL_ONCE === "1") {
    await tick();
    return;
  }

  await tick();
  setInterval(() => {
    void tick();
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
