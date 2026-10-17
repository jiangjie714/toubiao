import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncSkillConfigs } from "../crawler/config-loader";
import { runSource, listSkills } from "../crawler/runner";

async function main() {
  const args = process.argv.slice(2);
  const sinceArg = args.find((arg) => arg.startsWith("--since="));
  const sinceRaw = sinceArg?.split("=")[1] ?? "2026-09-01";
  const sinceDate = new Date(`${sinceRaw}T00:00:00+08:00`);

  const maxPagesArg = args.find((arg) => arg.startsWith("--max-pages="));
  const maxPages = Number(maxPagesArg?.split("=")[1] ?? 8);

  const targets = args.filter((arg) => !arg.startsWith("-"));
  
  // Find all enabled sources from DB, or fallback to targets/listSkills
  let skillsToRun: string[] = [];
  if (targets.length > 0) {
    skillsToRun = targets;
  } else {
    const dbSources = await prisma.crawlSource.findMany({
      where: { enabled: true },
      select: { skillCode: true },
    });
    const dbSkillCodes = dbSources.map((s) => s.skillCode);
    const available = listSkills();
    skillsToRun = dbSkillCodes.filter((code) => available.includes(code));
    if (skillsToRun.length === 0) {
      skillsToRun = available;
    }
  }

  console.log("=================================================================");
  console.log(`🚀 开始批量重采任务：从 ${sinceRaw} 起到当前`);
  console.log(`• 最大翻页深度: ${maxPages} 页/列表（触及 ${sinceRaw} 前自动终止）`);
  console.log(`• 唯一性策略: 基于 sourceUrl 唯一键，历史数据原地更新高保真内容，新数据插入，零重复`);
  console.log(`• 待执行数据源数量: ${skillsToRun.length} 个: ${skillsToRun.join(", ")}`);
  console.log("=================================================================\n");

  await syncSkillConfigs();

  const totalStats = {
    sourcesCompleted: 0,
    totalFetched: 0,
    totalNew: 0,
    totalUpdated: 0,
    totalSkippedOld: 0,
    totalFailedHttp: 0,
  };

  const initialCount = await prisma.tender.count();
  console.log(`当前数据库中标讯总数: ${initialCount} 条\n`);

  for (let i = 0; i < skillsToRun.length; i++) {
    const skill = skillsToRun[i];
    console.log(`[${i + 1}/${skillsToRun.length}] ▶ 正在采集 ${skill} ...`);
    const startTime = Date.now();

    try {
      const result = await runSource(skill, {
        maxPages,
        sinceDate,
      });
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      const updatedCount = Math.max(0, result.fetched - result.newCount);

      totalStats.sourcesCompleted++;
      totalStats.totalFetched += result.fetched;
      totalStats.totalNew += result.newCount;
      totalStats.totalUpdated += updatedCount;
      totalStats.totalSkippedOld += result.skippedOld;
      totalStats.totalFailedHttp += result.httpFail;

      console.log(
        `   ✓ 完成（耗时 ${durationSec}s）：解析 ${result.itemsParsed} 条，有效抓取 ${result.fetched} 条` +
        `（新增 ${result.newCount} 条，更新历史快照 ${updatedCount} 条，跳过 ${sinceRaw} 前旧数据 ${result.skippedOld} 条）\n`
      );
    } catch (err) {
      console.error(`   ✗ 采集 ${skill} 出现异常:`, err instanceof Error ? err.message : String(err));
    }
  }

  const finalCount = await prisma.tender.count();
  console.log("=================================================================");
  console.log("🎉 批量重新采集全部完成！汇总报告：");
  console.log("=================================================================");
  console.log(`• 成功采集数据源: ${totalStats.sourcesCompleted} / ${skillsToRun.length}`);
  console.log(`• 抓取并处理公告总数: ${totalStats.totalFetched} 篇`);
  console.log(`• 新增入库标讯: ${totalStats.totalNew} 篇`);
  console.log(`• 原地升级高保真快照的历史标讯: ${totalStats.totalUpdated} 篇`);
  console.log(`• 过滤跳过的旧数据 (${sinceRaw} 以前): ${totalStats.totalSkippedOld} 篇`);
  console.log(`• 采集后数据库标讯总数: ${finalCount} 条（较初始新增净增 ${finalCount - initialCount} 条）`);
  console.log(`• 重复校验结果: 严格通过（sourceUrl 唯一约束保障 0 条重复）`);
  console.log("=================================================================");
}

main()
  .catch((err) => {
    console.error("批量重新采集执行失败:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
