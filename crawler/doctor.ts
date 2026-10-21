import "dotenv/config";
import { listSkills, readSkillConfigFile } from "./config-loader";
import { fetchDetail, fetchListPage, parseListItems } from "./runner";
import { sleep } from "./fetcher";
import type { SkillConfig } from "./types";

type ListReport = {
  skillCode: string;
  sourceName: string;
  listType: string;
  pageUrl: string;
  ok: boolean;
  httpOk: boolean;
  items: number;
  fill: { date: number; province: number; purchaser: number };
  detail: { ok: boolean; contentLength: number; attachments: number } | null;
  latencyMs: number;
  error: string | null;
};

type Args = {
  json: boolean;
  detail: boolean;
  only: string[];
  lists: number;
};

function parseArgs(argv: string[]): Args {
  const only = argv.find((a) => a.startsWith("--only="));
  const lists = argv.find((a) => a.startsWith("--lists="));
  return {
    json: argv.includes("--json"),
    detail: argv.includes("--detail"),
    only: only ? only.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean) : [],
    lists: lists ? Number(lists.split("=")[1]) || 1 : Number.POSITIVE_INFINITY,
  };
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function pct(count: number, total: number): string {
  if (total <= 0) return "-";
  return `${Math.round((count / total) * 100)}%`;
}

async function inspectList(
  skillCode: string,
  config: SkillConfig,
  list: SkillConfig["lists"][number],
  index: number,
  args: Args,
): Promise<ListReport> {
  const settings = config.settings;
  const report: ListReport = {
    skillCode,
    sourceName: config.source.name,
    listType: list.type,
    pageUrl: list.firstPageUrl || list.url || "",
    ok: false,
    httpOk: false,
    items: 0,
    fill: { date: 0, province: 0, purchaser: 0 },
    detail: null,
    latencyMs: 0,
    error: null,
  };

  const startedAt = Date.now();
  try {
    const pageUrl = (list.firstPageUrl || list.url || "").replace(/\{page[+-]?\d*\}/g, String(index + 1));
    const payload = await fetchListPage(list, 1, settings);
    report.httpOk = true;
    const items = parseListItems(list, payload, config.source.baseUrl, pageUrl);
    report.items = items.length;

    if (items.length > 0) {
      report.fill.date = items.filter((item) => item.date !== null).length;
      report.fill.province = items.filter((item) => item.province).length;
      report.fill.purchaser = items.filter((item) => item.purchaser).length;
    }

    if (args.detail && list.detail && items.length > 0) {
      const sample = items.find((item) => item.url);
      if (sample) {
        try {
          const fetched = await fetchDetail(sample.url, list.detail, settings);
          report.detail = {
            ok: fetched.content.length > 0,
            contentLength: fetched.content.length,
            attachments: fetched.attachments.length,
          };
        } catch (error) {
          report.detail = {
            ok: false,
            contentLength: 0,
            attachments: 0,
          };
          report.error = `详情页失败：${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }

    report.ok = items.length > 0 && (report.detail === null || report.detail.ok);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    report.latencyMs = Date.now() - startedAt;
  }

  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const skills = args.only.length > 0 ? args.only : listSkills();
  const reports: ListReport[] = [];

  for (const skillCode of skills) {
    let config: SkillConfig;
    try {
      config = readSkillConfigFile(skillCode).config;
    } catch (error) {
      reports.push({
        skillCode,
        sourceName: skillCode,
        listType: "-",
        pageUrl: "",
        ok: false,
        httpOk: false,
        items: 0,
        fill: { date: 0, province: 0, purchaser: 0 },
        detail: null,
        latencyMs: 0,
        error: `配置无效：${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    const delay = config.settings.requestDelayMs ?? 1200;
    for (let index = 0; index < Math.min(args.lists, config.lists.length); index++) {
      const list = config.lists[index];
      reports.push(await inspectList(skillCode, config, list, index, args));
      await sleep(delay);
    }
  }

  if (args.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    console.log(
      `${pad("技能", 22)}${pad("类型", 10)}${pad("条目", 6)}${pad("日期", 6)}${pad("地区", 6)}${pad("采购人", 8)}${pad("正文", 8)}${pad("耗时", 8)}状态`,
    );
    console.log("-".repeat(92));
    for (const report of reports) {
      const detailCell = report.detail
        ? `${report.detail.ok ? report.detail.contentLength : 0}字`
        : "-";
      const status = report.ok ? "OK" : report.error ? `FAIL ${report.error.slice(0, 28)}` : "EMPTY";
      console.log(
        `${pad(report.skillCode, 22)}${pad(report.listType, 10)}${pad(String(report.items), 6)}${pad(
          pct(report.fill.date, report.items),
          6,
        )}${pad(pct(report.fill.province, report.items), 6)}${pad(
          pct(report.fill.purchaser, report.items),
          8,
        )}${pad(detailCell, 8)}${pad(`${report.latencyMs}ms`, 8)}${status}`,
      );
    }
    console.log("-".repeat(92));

    const okCount = reports.filter((r) => r.ok).length;
    const totalItems = reports.reduce((acc, r) => acc + r.items, 0);
    const broken = reports.filter((r) => !r.ok);
    console.log(`巡检 ${reports.length} 个列表，可用 ${okCount} 个，合计解析 ${totalItems} 条公告。`);
    if (broken.length > 0) {
      console.log(`需修复 ${broken.length} 个：${broken.map((r) => `${r.skillCode}/${r.listType}`).join("、")}`);
    }
  }

  if (reports.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
