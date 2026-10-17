import { prisma } from "../src/lib/prisma";
import { processSubscriptionLifecycleAlerts } from "../src/lib/subscription-lifecycle";

async function main() {
  console.log("=== 启动标讯通会员生命周期到期巡检 (T-15 / T-3 / Expiry) ===");
  const results = await processSubscriptionLifecycleAlerts({ dryRun: false });
  console.log(`巡检完成，共处理 ${results.length} 位会员状态：`);
  for (const r of results) {
    console.log(
      `[${r.stage}] 用户: ${r.userName} (ID: ${r.userId}) - 套餐: ${r.planName} - 剩余天数: ${r.daysRemaining}天 - 渠道: ${r.sentChannels.join(", ")}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
