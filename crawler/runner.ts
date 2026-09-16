import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { fetchText, sleep } from "./fetcher";
import { parseDate } from "./dates";
import { loadRegionMatcher } from "./regions";
import { loadCompiledConfig } from "./config-loader";
import { recalculateHealthScore } from "./health";
import { dispatchAlerts } from "./alerts";
import { handleFailureAndDegrade, attemptAutoHealing } from "@/lib/crawler/circuit-breaker";
import {
  extractAttachments,
  extractBuiltinFields,
  extractConfiguredFields,
  normalizeExtraFields,
  type AttachmentMeta,
  type ExtraFieldTarget,
  type NormalizedExtraFields,
  type RawExtraFields,
} from "./extraction";
import { persistTender } from "./persist";
import type { FieldSpec, ListConfig, ParsedItem, SkillConfig } from "./types";

const MAX_CONTENT_LEN = 50_000;
const MAX_HTML_LEN = 200_000;

export type RunOptions = {
  maxPages?: number;
  dryRun?: boolean;
  file?: boolean;
  trigger?: "cron" | "manual" | "api" | "retry";
  /** 只保留发布日期不早于该时刻的公告，列表按日期倒序、整页过期时提前停止翻页 */
  sinceDate?: Date;
};

export type DryRunItem = {
  title: string;
  url: string;
  publishDate: string | null;
  fields: NormalizedExtraFields;
  attachments: AttachmentMeta[];
  confidence: Record<string, number>;
};

export type RunResult = {
  newCount: number;
  fetched: number;
  itemsParsed: number;
  httpOk: number;
  httpFail: number;
  avgLatencyMs: number;
  dryRun: boolean;
  skippedOld: number;
  items?: DryRunItem[];
  errors?: string[];
};

function applyRegex(value: string, regex: string | undefined): string {
  if (!value || !regex) return value;
  const match = value.match(new RegExp(regex, "u"));
  return match ? (match[1] ?? match[0]) : "";
}

function extractHtmlField(
  el: cheerio.Cheerio<never>,
  spec: FieldSpec | undefined,
): string {
  if (spec === undefined) return "";
  if (typeof spec === "string") return spec;

  if (spec.const !== undefined) return spec.const;
  const target = spec.selector ? el.find(spec.selector).first() : el;
  if (target.length === 0) return "";
  const attr = spec.attr ?? "text";
  const raw = attr === "text"
    ? target.text()
    : attr === "html"
      ? target.html() ?? ""
      : target.attr(attr) ?? "";
  return applyRegex(raw.replace(/\u00a0/g, " ").trim(), spec.regex).trim();
}

function extractJsonField(item: Record<string, unknown>, spec: FieldSpec | undefined): string {
  if (spec === undefined) return "";
  if (typeof spec === "string") return spec;

  if (spec.const !== undefined) return spec.const;
  const path = spec.selector ?? "";
  if (!path) return "";
  const segments = path.split(".");
  let current: unknown = item;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[segment];
  }
  if (current == null) return "";
  const raw = typeof current === "string" ? current : JSON.stringify(current);
  return applyRegex(raw.trim(), spec.regex).trim();
}

function getByPath(obj: unknown, dotPath: string): unknown {
  let current: unknown = obj;
  for (const segment of dotPath.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function renderPageUrl(template: string, page: number): string {
  return template.replace(/\{page([+-]\d+)?\}/g, (_, offset) =>
    String(page + (offset ? Number.parseInt(offset, 10) : 0)),
  );
}

async function fetchListPage(
  list: ListConfig,
  page: number,
  settings: SkillConfig["settings"],
): Promise<string | unknown> {
  const startPage = list.startPage ?? 1;
  const isFirstPage = page === startPage;

  if (list.mode === "json") {
    const request = list.request;
    if (!request?.url) throw new Error("json 模式缺少 request.url");
    const url = isFirstPage && list.firstPageUrl
      ? list.firstPageUrl
      : renderPageUrl(request.url, page);
    const form = request.form
      ? Object.fromEntries(
          Object.entries(request.form).map(([key, value]) => [key, renderPageUrl(value, page)]),
        )
      : undefined;
    return fetchText(url, {
      method: request.method,
      headers: { ...settings.headers, ...request.headers },
      form,
      timeoutMs: settings.timeoutMs,
      retries: settings.retries,
      userAgent: settings.userAgent,
    });
  }

  const url = isFirstPage && list.firstPageUrl ? list.firstPageUrl : renderPageUrl(list.url ?? "", page);
  return fetchText(url, {
    headers: settings.headers,
    timeoutMs: settings.timeoutMs,
    retries: settings.retries,
    userAgent: settings.userAgent,
  });
}

function parseListItems(
  list: ListConfig,
  payload: string | unknown,
  baseUrl: string,
  pageUrl: string,
): ParsedItem[] {
  const fields = list.parse.fields;
  const resolve = (href: string) => new URL(href, pageUrl || baseUrl).toString();
  const items: ParsedItem[] = [];

  const pushItem = (
    title: string,
    href: string,
    extract: (spec: FieldSpec | undefined) => string,
  ) => {
    if (!title || !href) return;
    const extraFields: Record<string, string> = {};
    for (const [key, spec] of Object.entries(list.parse.extraFields ?? {})) {
      const value = extract(spec);
      if (value) extraFields[key as ExtraFieldTarget] = value;
    }
    items.push({
      title,
      url: resolve(href.trim()),
      date: parseDate(extract(fields.date)),
      province: extract(fields.province) || null,
      city: extract(fields.city) || null,
      purchaser: extract(fields.purchaser) || null,
      agency: extract(fields.agency) || null,
      hint: extract(fields.hint) || null,
      extraFields,
    });
  };

  if (list.mode === "json") {
    const array = getByPath(payload, list.parse.itemsPath ?? "data");
    if (!Array.isArray(array)) return [];
    for (const raw of array) {
      if (raw == null || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      pushItem(
        extractJsonField(item, fields.title),
        extractJsonField(item, fields.url),
        (spec) => extractJsonField(item, spec),
      );
    }
    return items;
  }

  const $ = cheerio.load(payload as string);
  const selector = list.parse.itemSelector;
  if (!selector) return [];
  $(selector).each((_, node) => {
    const el = $(node) as cheerio.Cheerio<never>;
    pushItem(extractHtmlField(el, fields.title), extractHtmlField(el, fields.url), (spec) =>
      extractHtmlField(el, spec),
    );
  });
  return items;
}

type FetchedDetail = {
  content: string;
  contentHtml: string | null;
  attachments: AttachmentMeta[];
};

/** 列表条目壳页与详情正文分离的站点，用模板拼出真实详情地址 */
function resolveDetailUrl(
  detail: NonNullable<ListConfig["detail"]> | null | undefined,
  item: ParsedItem,
): string {
  const template = detail?.urlTemplate;
  if (!template) return item.url;
  const date = item.date ?? new Date();
  const params = new URL(item.url, "http://placeholder.invalid").searchParams;
  return template
    .replace(/\{query:([A-Za-z0-9_]+)\}/g, (_, name: string) => params.get(name) ?? "")
    .replace(/\{YYYY\}/g, String(date.getFullYear()))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, "0"))
    .replace(/\{DD\}/g, String(date.getDate()).padStart(2, "0"));
}

async function fetchDetail(
  itemUrl: string,
  detail: NonNullable<ListConfig["detail"]>,
  settings: SkillConfig["settings"],
): Promise<FetchedDetail> {
  const html = await fetchText(itemUrl, {
    headers: settings.headers,
    timeoutMs: settings.timeoutMs,
    retries: settings.retries,
    userAgent: settings.userAgent,
  });
  const $ = cheerio.load(html);
  if (detail.removeSelector) $(detail.removeSelector).remove();

  const content = $(detail.contentSelector).first().clone();
  if (content.length === 0) {
    return {
      content: $("body").text().replace(/\s{3,}/g, "\n").trim().slice(0, MAX_CONTENT_LEN),
      contentHtml: null,
      attachments: [],
    };
  }

  content
    .find("script,style,noscript,iframe,object,embed,form,input,button,select,textarea,link,meta,svg")
    .remove();
  content.find("*").each((_, node) => {
    const element = $(node);
    for (const attribute of Object.keys(element.attr() ?? {})) {
      if (!["href", "colspan", "rowspan"].includes(attribute.toLowerCase())) {
        element.removeAttr(attribute);
      }
    }
  });
  content.find("a[href]").each((_, node) => {
    const element = $(node);
    const rawHref = element.attr("href");
    if (!rawHref) return;
    try {
      const href = new URL(rawHref, itemUrl);
      if (href.protocol === "http:" || href.protocol === "https:") {
        element.attr("href", href.toString());
      } else {
        element.removeAttr("href");
      }
    } catch {
      element.removeAttr("href");
    }
  });

  const contentHtml = (content.html() ?? "").trim().slice(0, MAX_HTML_LEN);
  const attachments = extractAttachments(contentHtml, itemUrl);
  content.find("table").remove();
  content.find("a").each((_, node) => {
    $(node).replaceWith($(node).text());
  });
  $("br").replaceWith("\n");
  content.find("p,div,li,h1,h2,h3,h4,h5,h6,section,article,tr").append("\n");
  const plain = content
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { content: plain.slice(0, MAX_CONTENT_LEN), contentHtml, attachments };
}

function extractExpireDate(text: string): Date | null {
  const match = text.match(
    /截止[^，,。；;\d]{0,16}?[：:]?\s*(\d{4}[-年/.]\d{1,2}[-月./]\d{1,2}日?(?:[^，,。；;\s]{0,10})?)/,
  );
  return match ? parseDate(match[1]) : null;
}

export async function runSource(skillCode: string, options: RunOptions = {}): Promise<RunResult> {
  const config = await loadCompiledConfig(skillCode, {
    file: options.file,
    autoSync: !options.dryRun,
  });
  const source = options.file ? null : await prisma.crawlSource.findUnique({ where: { skillCode } });
  const settings = {
    requestDelayMs: config.settings.requestDelayMs ?? 1500,
    timeoutMs: config.settings.timeoutMs ?? 20_000,
    retries: config.settings.retries ?? 2,
    maxPages: options.maxPages ?? config.settings.maxPages ?? source?.maxPages ?? 2,
    headers: config.settings.headers,
    userAgent: config.settings.userAgent,
  };
  const regionMatcher = await loadRegionMatcher();
  const sinceMs = options.sinceDate ? options.sinceDate.getTime() : null;
  const dryItems: DryRunItem[] = [];
  const errors: string[] = [];
  let newCount = 0;
  let fetched = 0;
  let itemsParsed = 0;
  let skippedOld = 0;
  let httpOk = 0;
  let httpFail = 0;
  let latencyTotal = 0;

  for (const list of config.lists) {
    const startPage = list.startPage ?? 1;
    const maxPages = Math.min(list.maxPages ?? settings.maxPages, settings.maxPages);

    for (let page = startPage; page < startPage + maxPages; page++) {
      const startedAt = Date.now();
      let payload: string | unknown;
      try {
        payload = await fetchListPage(list, page, settings);
        httpOk++;
      } catch (error) {
        httpFail++;
        errors.push(error instanceof Error ? error.message : String(error));
        if (page === startPage) throw error;
        break;
      } finally {
        latencyTotal += Date.now() - startedAt;
      }

      const isFirstPage = page === startPage;
      const template = list.mode === "json" ? list.request?.url ?? "" : list.url ?? "";
      const pageUrl = isFirstPage && list.firstPageUrl
        ? list.firstPageUrl
        : renderPageUrl(template, page);
      const items = parseListItems(list, payload, config.source.baseUrl, pageUrl);
      itemsParsed += items.length;

      if (items.length === 0) {
        if (page === startPage) {
          throw new Error(
            list.mode === "html"
              ? `列表解析失败：itemSelector「${list.parse.itemSelector}」未匹配到任何条目，站点结构可能已变化`
              : `列表解析失败：itemsPath「${list.parse.itemsPath}」未返回数组`,
          );
        }
        break;
      }

      for (const item of items) {
        if (sinceMs !== null && (!item.date || item.date.getTime() < sinceMs)) {
          skippedOld++;
          continue;
        }
        const detailStartedAt = Date.now();
        try {
          const detail = list.detail
            ? await fetchDetail(resolveDetailUrl(list.detail, item), list.detail, settings)
            : { content: item.hint ?? item.title, contentHtml: null, attachments: [] };
          httpOk++;
          latencyTotal += Date.now() - detailStartedAt;

          const configured = list.detail?.extraction
            ? extractConfiguredFields(detail.contentHtml ?? detail.content, list.detail.extraction)
            : { fields: {} as RawExtraFields, confidence: {} as Record<string, number> };
          const builtin = extractBuiltinFields(detail.content);
          const rawFields: RawExtraFields = {
            ...item.extraFields,
            ...builtin.fields,
            ...configured.fields,
          };
          const confidence = {
            ...Object.fromEntries(
              Object.keys(item.extraFields).map((key) => [key, 0.8]),
            ),
            ...builtin.confidence,
            ...configured.confidence,
          };
          const { fields } = normalizeExtraFields(rawFields);

          if (options.dryRun) {
            dryItems.push({
              title: item.title,
              url: item.url,
              publishDate: item.date?.toISOString() ?? null,
              fields,
              attachments: detail.attachments,
              confidence,
            });
          } else {
            const region = item.province
              ? regionMatcher.match(
                  `${item.province}${item.city ?? ""} ${item.title} ${item.hint ?? ""} ${detail.content.slice(0, 300)}`,
                )
              : regionMatcher.match(`${item.title} ${item.hint ?? ""} ${detail.content.slice(0, 300)}`);

            const created = await persistTender(
              {
                title: item.title,
                type: list.type,
                publishDate: item.date ?? new Date(),
                expireDate: extractExpireDate(detail.content),
                provinceCode: region.provinceCode,
                cityCode: region.cityCode,
                purchaser: item.purchaser,
                agency: item.agency,
                sourceName: config.source.name,
                sourceUrl: item.url,
                content: detail.content,
                contentHtml: detail.contentHtml,
                extraFields: fields,
                attachments: detail.attachments,
                confidence,
              },
              {
                skillCode,
                priority: source?.priority ?? 50,
                regionMatcher,
              },
            );
            if (created) newCount++;
          }
          fetched++;
        } catch (error) {
          httpFail++;
          errors.push(error instanceof Error ? error.message : String(error));
        }
        await sleep(settings.requestDelayMs);
      }

      // 列表按发布日期倒序，整页都早于截止时间时无需继续翻页
      if (sinceMs !== null && items.length > 0 && items.every((it) => it.date && it.date.getTime() < sinceMs)) {
        break;
      }
    }
  }

  return {
    newCount,
    fetched,
    itemsParsed,
    httpOk,
    httpFail,
    avgLatencyMs: Math.round(latencyTotal / Math.max(httpOk + httpFail, 1)),
    dryRun: Boolean(options.dryRun),
    skippedOld,
    ...(options.dryRun ? { items: dryItems.slice(0, 20), errors } : { errors }),
  };
}

export async function runAllSources(options: RunOptions = {}) {
  const sources = await prisma.crawlSource.findMany({ where: { enabled: true } });
  const results: { skillCode: string; ok: boolean; newCount: number; message?: string }[] = [];
  for (const source of sources) {
    try {
      const result = await runSource(source.skillCode, options);
      results.push({ skillCode: source.skillCode, ok: true, newCount: result.newCount });
    } catch (error) {
      results.push({
        skillCode: source.skillCode,
        ok: false,
        newCount: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

export { listSkills } from "./config-loader";

export async function runSourceWithLogging(
  skillCode: string,
  options: RunOptions = {},
): Promise<{ ok: boolean; newCount: number; fetched: number; message: string }> {
  const source = await prisma.crawlSource.findUnique({ where: { skillCode } });
  if (!source) throw new Error(`数据源不存在：${skillCode}`);
  if (source.status === "RUNNING") throw new Error("该数据源正在抓取中，请稍后再试");

  const startedAt = new Date();
  await prisma.crawlSource.update({
    where: { id: source.id },
    data: { status: "RUNNING", lastMessage: null },
  });

  try {
    const result = await runSource(skillCode, options);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = `抓取 ${result.fetched} 条，新增 ${result.newCount} 条，解析 ${result.itemsParsed} 条${
      result.skippedOld > 0 ? `，跳过截止日期前旧数据 ${result.skippedOld} 条` : ""
    }`;

    await prisma.crawlLog.create({
      data: {
        sourceId: source.id,
        sourceName: source.name,
        status: "OK",
        trigger: options.trigger ?? "manual",
        newCount: result.newCount,
        httpOk: result.httpOk,
        httpFail: result.httpFail,
        itemsParsed: result.itemsParsed,
        avgLatencyMs: result.avgLatencyMs,
        durationMs,
        message,
        startedAt,
        finishedAt,
      },
    });
    await prisma.crawlSource.update({
      where: { id: source.id },
      data: {
        status: "OK",
        lastMessage: message,
        lastNewCount: result.newCount,
        lastRunAt: finishedAt,
        lastSuccessAt: finishedAt,
        consecutiveFailures: 0,
      },
    });
    const healthScore = await recalculateHealthScore(source.id, {
      status: "OK",
      itemsParsed: result.itemsParsed,
    });
    await dispatchAlerts({
      sourceId: source.id,
      skillCode,
      healthScore,
      status: "OK",
      itemsParsed: result.itemsParsed,
      consecutiveFailures: 0,
    });

    // 成功抓取时，若原处于降级或有历史失败，尝试触发自愈与恢复通知
    if (source.status === "CIRCUIT_DEGRADED" || source.consecutiveFailures > 0) {
      await attemptAutoHealing(skillCode);
    }

    return { ok: true, newCount: result.newCount, fetched: result.fetched, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date();
    const consecutiveFailures = source.consecutiveFailures + 1;

    await prisma.crawlLog.create({
      data: {
        sourceId: source.id,
        sourceName: source.name,
        status: "FAILED",
        trigger: options.trigger ?? "manual",
        message: message.slice(0, 500),
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
    });
    await prisma.crawlSource.update({
      where: { id: source.id },
      data: {
        status: "FAILED",
        lastMessage: message.slice(0, 500),
        lastRunAt: finishedAt,
        consecutiveFailures,
      },
    });
    const healthScore = await recalculateHealthScore(source.id, {
      status: "FAILED",
      itemsParsed: 0,
    });
    await dispatchAlerts({
      sourceId: source.id,
      skillCode,
      healthScore,
      status: "FAILED",
      itemsParsed: 0,
      consecutiveFailures,
    });

    // 检查并触发熔断降级保护
    await handleFailureAndDegrade(source.id, consecutiveFailures, message);

    return { ok: false, newCount: 0, fetched: 0, message };
  }
}
