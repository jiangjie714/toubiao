import "dotenv/config";
import cron from "node-cron";
import { runDailyPushes } from "../src/lib/push";

const CRON = process.env.PUSH_CRON || "0 8 * * *";

async function tick() {
  const results = await runDailyPushes();
  for (const result of results) {
    console.log(
      `${result.watchName}: 命中 ${result.matched} 条，${result.sent ? "已发送" : "未发送"}${result.error ? `，错误：${result.error}` : ""}`,
    );
  }
}

async function main() {
  await tick();
  cron.schedule(CRON, () => {
    tick().catch((error) => console.error("每日推送异常：", error));
  });
  console.log(`每日推送 Worker 已启动，计划：${CRON}`);
}

main().catch((error) => {
  console.error("推送 Worker 启动失败：", error);
  process.exitCode = 1;
});
