import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { loadCompiledConfig } from "@/../crawler/config-loader";
import { fetchText } from "@/../crawler/fetcher";

export interface ProbeResult {
  skillCode: string;
  sourceName: string;
  success: boolean;
  status: "OK" | "WARNING" | "ERROR";
  healthScore: number;
  durationMs: number;
  httpStatus: number | null;
  matchedCount: number;
  message: string;
  probedAt: string;
}

export interface DebugItem {
  title: string;
  url: string;
  date?: string;
  purchaser?: string;
}

export interface DebugCrawlResult {
  success: boolean;
  skillCode: string;
  sourceName: string;
  listUrl: string;
  itemSelector: string;
  totalFound: number;
  items: DebugItem[];
  durationMs: number;
  error?: string;
}

export async function probeSourceHealth(skillCode: string): Promise<ProbeResult> {
  const startTime = Date.now();
  let sourceName = skillCode;

  try {
    const config = await loadCompiledConfig(skillCode);
    sourceName = config.source.name;

    const listConfig = config.lists[0];
    const targetUrl = listConfig?.firstPageUrl || listConfig?.url || config.source.baseUrl;
    const itemSelector = listConfig?.parse?.itemSelector || "li";

    // 1. 发起探测请求
    const res = await fetch(targetUrl, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
        ...(config.settings.headers || {}),
      },
    });

    const durationMs = Date.now() - startTime;
    const httpStatus = res.status;

    if (!res.ok) {
      const score = 30;
      const message = `HTTP 异常响应 [${httpStatus}]：${res.statusText}`;
      await updateSourceHealth(skillCode, score, "ERROR", message);
      return {
        skillCode,
        sourceName,
        success: false,
        status: "ERROR",
        healthScore: score,
        durationMs,
        httpStatus,
        matchedCount: 0,
        message,
        probedAt: new Date().toISOString(),
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const matchedCount = $(itemSelector).length;

    let healthScore = 100;
    let status: "OK" | "WARNING" | "ERROR" = "OK";
    let message = `探测成功：耗时 ${durationMs}ms，匹配条目 ${matchedCount} 条`;

    // 评估延迟惩罚
    if (durationMs > 4000) {
      healthScore -= 15;
    } else if (durationMs > 2000) {
      healthScore -= 5;
    }

    // 评估选择器匹配
    if (matchedCount === 0) {
      healthScore = Math.min(healthScore, 75);
      status = "WARNING";
      message = `网络连通正常（${durationMs}ms），但选择器 "${itemSelector}" 匹配为 0，可能站点结构变动`;
    }

    await updateSourceHealth(skillCode, healthScore, status, message);

    return {
      skillCode,
      sourceName,
      success: true,
      status,
      healthScore,
      durationMs,
      httpStatus,
      matchedCount,
      message,
      probedAt: new Date().toISOString(),
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errMessage = error instanceof Error ? error.message : String(error);
    const score = 20;
    const message = `网络探测失败（${durationMs}ms）：${errMessage}`;

    await updateSourceHealth(skillCode, score, "ERROR", message);

    return {
      skillCode,
      sourceName,
      success: false,
      status: "ERROR",
      healthScore: score,
      durationMs,
      httpStatus: null,
      matchedCount: 0,
      message,
      probedAt: new Date().toISOString(),
    };
  }
}

async function updateSourceHealth(
  skillCode: string,
  healthScore: number,
  status: "OK" | "WARNING" | "ERROR",
  message: string,
) {
  try {
    const source = await prisma.crawlSource.findUnique({ where: { skillCode } });
    if (!source) return;

    await prisma.crawlSource.update({
      where: { skillCode },
      data: {
        healthScore,
        status,
        lastMessage: message,
      },
    });

    // 若评分低于 70 分，且配置了告警规则，触发告警留痕
    if (healthScore < 70) {
      const alertRule = await prisma.alertRule.findFirst({
        where: { scope: "global", enabled: true },
      });

      if (alertRule) {
        await prisma.alertRecord.create({
          data: {
            ruleId: alertRule.id,
            message: `[数据源预警] 数据源【${source.name}】健康评分降至 ${healthScore} 分，原因：${message}`,
          },
        });
      }
    }
  } catch (err) {
    console.error("updateSourceHealth error:", err);
  }
}

export async function probeAllSources(): Promise<{
  total: number;
  healthy: number;
  warning: number;
  error: number;
  avgDurationMs: number;
  results: ProbeResult[];
}> {
  const sources = await prisma.crawlSource.findMany({
    where: { enabled: true },
    select: { skillCode: true },
  });

  const results: ProbeResult[] = [];
  const chunkSize = 4;

  for (let i = 0; i < sources.length; i += chunkSize) {
    const chunk = sources.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((s) => probeSourceHealth(s.skillCode)),
    );
    results.push(...chunkResults);
  }

  let healthy = 0;
  let warning = 0;
  let error = 0;
  let totalDuration = 0;

  for (const r of results) {
    totalDuration += r.durationMs;
    if (r.status === "OK") healthy++;
    else if (r.status === "WARNING") warning++;
    else error++;
  }

  return {
    total: results.length,
    healthy,
    warning,
    error,
    avgDurationMs: results.length > 0 ? Math.round(totalDuration / results.length) : 0,
    results,
  };
}

export async function debugCrawlSource(skillCode: string): Promise<DebugCrawlResult> {
  const startTime = Date.now();
  try {
    const config = await loadCompiledConfig(skillCode);
    const listConfig = config.lists[0];
    const targetUrl = listConfig?.firstPageUrl || listConfig?.url || config.source.baseUrl;
    const itemSelector = listConfig?.parse?.itemSelector || "li";

    const html = await fetchText(targetUrl, {
      timeoutMs: 15_000,
      userAgent: config.settings.userAgent,
      headers: config.settings.headers,
    });

    const $ = cheerio.load(html);
    const totalFound = $(itemSelector).length;
    const items: DebugItem[] = [];

    const fieldConfig = listConfig?.parse?.fields;

    $(itemSelector)
      .slice(0, 5)
      .each((_, el) => {
        const titleSel = typeof fieldConfig?.title === "object" ? fieldConfig.title.selector : "a";
        const urlSel = typeof fieldConfig?.url === "object" ? fieldConfig.url.selector : "a";
        const dateSel = typeof fieldConfig?.date === "object" ? fieldConfig.date.selector : "span";

        const title = $(el).find(titleSel || "a").text().trim();
        let itemUrl = $(el).find(urlSel || "a").attr("href") || "";
        if (itemUrl && !itemUrl.startsWith("http")) {
          try {
            itemUrl = new URL(itemUrl, targetUrl).toString();
          } catch {
            // ignore
          }
        }
        const date = dateSel ? $(el).find(dateSel).text().trim() : undefined;

        if (title) {
          items.push({
            title,
            url: itemUrl,
            date,
          });
        }
      });

    return {
      success: true,
      skillCode,
      sourceName: config.source.name,
      listUrl: targetUrl,
      itemSelector,
      totalFound,
      items,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      skillCode,
      sourceName: skillCode,
      listUrl: "",
      itemSelector: "",
      totalFound: 0,
      items: [],
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
