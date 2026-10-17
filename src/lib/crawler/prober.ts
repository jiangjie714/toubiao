import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { loadCompiledConfig } from "@/../crawler/config-loader";
import { fetchText } from "@/../crawler/fetcher";
import { dispatchAlerts } from "@/../crawler/alerts";
import { attemptAutoHealing } from "./circuit-breaker";
import type { ListConfig } from "@/../crawler/types";

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

function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function getListRequestInfo(
  listConfig: ListConfig | null | undefined,
  settings: { headers?: Record<string, string> } | null | undefined,
) {
  const isJson = listConfig?.mode === "json";
  const request = listConfig?.request;
  const targetUrl = isJson && request?.url
    ? request.url.replace(/\{page([+-]\d+)?\}/g, "1")
    : listConfig?.firstPageUrl || listConfig?.url || "";
  const method = isJson && request?.method ? request.method : "GET";
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
    ...(settings?.headers || {}),
    ...(isJson && request?.headers ? request.headers : {}),
  };

  let body: string | undefined = undefined;
  if (isJson) {
    if (request?.json) {
      body = JSON.stringify(request.json)
        .replace(/"\{page([+-]\d+)?\}"/g, "1")
        .replace(/\{page([+-]\d+)?\}/g, "1");
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json;charset=UTF-8";
      }
    } else if (request?.form) {
      const renderedForm = Object.fromEntries(
        Object.entries(request.form).map(([k, v]) => [k, String(v).replace(/\{page([+-]\d+)?\}/g, "1")]),
      );
      body = new URLSearchParams(renderedForm).toString();
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      }
    } else if (request?.body) {
      body = request.body.replace(/\{page([+-]\d+)?\}/g, "1");
    }
  }

  return { targetUrl, method, headers, body, isJson };
}

export async function probeSourceHealth(skillCode: string): Promise<ProbeResult> {
  const startTime = Date.now();
  let sourceName = skillCode;

  try {
    const config = await loadCompiledConfig(skillCode);
    sourceName = config.source.name;

    const listConfig = config.lists[0];
    const { targetUrl, method, headers, body, isJson } = getListRequestInfo(listConfig, config.settings);
    const itemSelector = listConfig?.parse?.itemSelector || "li";

    // 1. 发起探测请求
    const res = await fetch(targetUrl, {
      method,
      signal: AbortSignal.timeout(10_000),
      headers,
      body,
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

    let matchedCount = 0;
    if (isJson) {
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        const array = getByPath(parsed, listConfig?.parse?.itemsPath || "data");
        matchedCount = Array.isArray(array) ? array.length : (array ? 1 : 0);
      } catch {
        matchedCount = 0;
      }
    } else {
      const html = await res.text();
      const $ = cheerio.load(html);
      matchedCount = $(itemSelector).length;
    }

    let healthScore = 100;
    let status: "OK" | "WARNING" | "ERROR" = "OK";
    let message = `探测成功：耗时 ${durationMs}ms，匹配条目 ${matchedCount} 条`;

    // 评估延迟惩罚
    if (durationMs > 4000) {
      healthScore -= 15;
    } else if (durationMs > 2000) {
      healthScore -= 5;
    }

    // 评估选择器或条目匹配
    if (matchedCount === 0) {
      healthScore = Math.min(healthScore, 75);
      status = "WARNING";
      message = isJson
        ? `网络连通正常（${durationMs}ms），但 JSON 路径 "${listConfig?.parse?.itemsPath || "data"}" 匹配为 0 条`
        : `网络连通正常（${durationMs}ms），但选择器 "${itemSelector}" 匹配为 0，可能站点结构变动`;
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

    // 若原本处于熔断降级或异常，而本次探测恢复正常，执行自愈流程
    if (
      status === "OK" &&
      (source.status === "CIRCUIT_DEGRADED" ||
        source.status === "FAILED" ||
        source.consecutiveFailures > 0)
    ) {
      await attemptAutoHealing(skillCode);
    } else {
      await prisma.crawlSource.update({
        where: { skillCode },
        data: {
          healthScore,
          status,
          lastMessage: message,
        },
      });

      // 若健康分发生变化或处于报警条件，调用全平台告警分发网络（含防刷静默期与多通道推送）
      await dispatchAlerts({
        sourceId: source.id,
        skillCode: source.skillCode,
        healthScore,
        status,
        itemsParsed: -1, // 探针探测
        consecutiveFailures: status === "ERROR" ? 1 : 0,
      });
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
    const { targetUrl, method, headers, body, isJson } = getListRequestInfo(listConfig, config.settings);
    const itemSelector = listConfig?.parse?.itemSelector || "li";

    const items: DebugItem[] = [];
    let totalFound = 0;

    const raw = await fetchText(targetUrl, {
      method: method as "GET" | "POST",
      headers,
      body,
      timeoutMs: 15_000,
      userAgent: config.settings.userAgent,
    });

    if (isJson) {
      let data: unknown = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      const rawList = getByPath(data, listConfig?.parse?.itemsPath || "data");
      const array = Array.isArray(rawList) ? rawList : [];
      totalFound = array.length;

      const fieldConfig = listConfig?.parse?.fields;
      for (const rawItem of array.slice(0, 5)) {
        if (!rawItem || typeof rawItem !== "object") continue;
        const item = rawItem as Record<string, unknown>;
        const titleProp = typeof fieldConfig?.title === "string" ? fieldConfig.title : "title";
        const urlProp = typeof fieldConfig?.url === "string" ? fieldConfig.url : "url";
        const dateProp = typeof fieldConfig?.date === "string" ? fieldConfig.date : "date";
        const purchaserProp = typeof fieldConfig?.purchaser === "string" ? fieldConfig.purchaser : "purchaser";

        const title = String(getByPath(item, titleProp) || "").trim();
        let itemUrl = String(getByPath(item, urlProp) || "").trim();
        if (itemUrl && !itemUrl.startsWith("http")) {
          try {
            itemUrl = new URL(itemUrl, config.source.baseUrl).toString();
          } catch {
            // ignore
          }
        }
        const date = getByPath(item, dateProp) ? String(getByPath(item, dateProp)).trim() : undefined;
        const purchaser = getByPath(item, purchaserProp) ? String(getByPath(item, purchaserProp)).trim() : undefined;

        if (title) {
          items.push({
            title,
            url: itemUrl,
            date,
            purchaser,
          });
        }
      }
    } else {
      const $ = cheerio.load(raw);
      totalFound = $(itemSelector).length;
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
    }

    return {
      success: true,
      skillCode,
      sourceName: config.source.name,
      listUrl: targetUrl,
      itemSelector: isJson ? (listConfig?.parse?.itemsPath || "json") : itemSelector,
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
