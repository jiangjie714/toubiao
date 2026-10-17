import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncSkillConfigs } from "./config-loader";
import { listSkills, runSource, runSourceWithLogging } from "./runner";

async function main() {
  const args = process.argv.slice(2);
  const fileMode = args.includes("--file");
  const dryRun = args.includes("--dry-run");

  // 断点续采：默认开启，除非显式指定 --no-resume
  const noResume = args.includes("--no-resume");
  const forceResume = args.includes("--resume");

  const maxPageArg = args.find((arg) => arg.startsWith("--max-pages="));
  const maxPages = maxPageArg ? Number(maxPageArg.split("=")[1]) : undefined;

  const sinceArg = args.find((arg) => arg.startsWith("--since=") || arg.startsWith("--start-date="));
  const sinceRaw = sinceArg ? sinceArg.split("=")[1] : "";
  const sinceDate = sinceRaw ? new Date(`${sinceRaw}T00:00:00+08:00`) : undefined;
  if (sinceArg && (isNaN(sinceDate!.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(sinceRaw))) {
    console.error(`起始日期格式应为 YYYY-MM-DD，收到：${sinceRaw}`);
    process.exitCode = 1;
    return;
  }

  const untilArg = args.find((arg) => arg.startsWith("--until=") || arg.startsWith("--end-date="));
  const untilRaw = untilArg ? untilArg.split("=")[1] : "";
  const untilDate = untilRaw ? new Date(`${untilRaw}T23:59:59+08:00`) : undefined;
  if (untilArg && (isNaN(untilDate!.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(untilRaw))) {
    console.error(`截止日期格式应为 YYYY-MM-DD，收到：${untilRaw}`);
    process.exitCode = 1;
    return;
  }

  const isTimeRange = Boolean(sinceDate || untilDate);
  const resume = !isTimeRange && (forceResume || !noResume);

  const targets = args.filter((arg) => !arg.startsWith("-"));
  const skills = targets.length > 0 ? targets : listSkills();

  if (skills.length === 0) {
    console.log("没有可运行的数据源 skill（crawler/skills/ 下无 config.yaml）");
    return;
  }

  let modeLabel = "断点续采模式（默认）";
  if (isTimeRange) {
    modeLabel = `时间段补采模式 [${sinceRaw || "起始"} ~ ${untilRaw || "最新"}]`;
  } else if (!resume) {
    modeLabel = `普通采集模式（指定深度 ${maxPages ?? 2} 页）`;
  }

  console.log(`🧭 当前采集配置：${modeLabel}${dryRun ? " [Dry Run 试运行]" : ""}`);

  if (fileMode || dryRun) {
    for (const skill of skills) {
      console.log(`${dryRun ? "🧪 测试" : "▶ 抓取"} ${skill}${fileMode ? "（文件配置）" : ""} …`);
      const result = await runSource(skill, {
        maxPages,
        dryRun,
        file: fileMode,
        resume,
        sinceDate,
        untilDate,
      });
      if (dryRun) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(
          `  完成：抓取 ${result.fetched} 条，新增 ${result.newCount} 条${
            result.skippedExisting > 0 ? `，跳过已存在旧数据 ${result.skippedExisting} 条` : ""
          }${result.checkpointDate ? `，断点: ${result.checkpointDate}` : ""}`,
        );
      }
    }
    return;
  }

  await syncSkillConfigs();
  for (const skill of skills) {
    console.log(`▶ 抓取 ${skill} …`);
    const result = await runSourceWithLogging(skill, {
      maxPages,
      trigger: "manual",
      resume,
      sinceDate,
      untilDate,
    });
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
