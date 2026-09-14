import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncSkillConfigs } from "./config-loader";
import { listSkills, runSource, runSourceWithLogging } from "./runner";

async function main() {
  const args = process.argv.slice(2);
  const fileMode = args.includes("--file");
  const dryRun = args.includes("--dry-run");
  const maxPageArg = args.find((arg) => arg.startsWith("--max-pages="));
  const maxPages = Number(maxPageArg?.split("=")[1] ?? process.env.CRAWL_MAX_PAGES ?? 2);
  const sinceArg = args.find((arg) => arg.startsWith("--since="));
  const sinceRaw = sinceArg?.split("=")[1] ?? "";
  const sinceDate = sinceRaw
    ? new Date(`${sinceRaw}T00:00:00+08:00`)
    : undefined;
  if (sinceArg && (isNaN(sinceDate!.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(sinceRaw))) {
    console.error(`--since 格式应为 YYYY-MM-DD，收到：${sinceRaw}`);
    process.exitCode = 1;
    return;
  }
  const targets = args.filter((arg) => !arg.startsWith("-"));
  const skills = targets.length > 0 ? targets : listSkills();

  if (skills.length === 0) {
    console.log("没有可运行的数据源 skill（crawler/skills/ 下无 config.yaml）");
    return;
  }

  if (fileMode || dryRun) {
    for (const skill of skills) {
      console.log(`${dryRun ? "🧪 测试" : "▶ 抓取"} ${skill}${fileMode ? "（文件配置）" : ""} …`);
      const result = await runSource(skill, {
        maxPages,
        dryRun,
        file: fileMode,
        sinceDate,
      });
      if (dryRun) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`  完成：抓取 ${result.fetched} 条，新增 ${result.newCount} 条${result.skippedOld > 0 ? `，跳过旧数据 ${result.skippedOld} 条` : ""}`);
      }
    }
    return;
  }

  await syncSkillConfigs();
  for (const skill of skills) {
    console.log(`▶ 抓取 ${skill}${sinceDate ? `（仅保留 ${sinceRaw} 及之后发布）` : ""} …`);
    const result = await runSourceWithLogging(skill, { maxPages, trigger: "manual", sinceDate });
    if (result.ok) console.log(`  完成：${result.message}`);
    else console.error(`  失败：${result.message}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
