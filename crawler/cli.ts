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
      });
      if (dryRun) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`  完成：抓取 ${result.fetched} 条，新增 ${result.newCount} 条`);
      }
    }
    return;
  }

  await syncSkillConfigs();
  for (const skill of skills) {
    console.log(`▶ 抓取 ${skill} …`);
    const result = await runSourceWithLogging(skill, { maxPages, trigger: "manual" });
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
