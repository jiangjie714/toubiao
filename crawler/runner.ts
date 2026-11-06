import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { fetchText, sleep } from "./fetcher";
import { parseDate, formatDate, toDayStart, toDayEnd } from "./dates";
import { loadRegionMatcher } from "./regions";
import { loadCompiledConfig } from "./config-loader";
import { recalculateHealthScore } from "./health";
import { dispatchAlerts } from "./alerts";
import { handleFailureAndDegrade, attemptAutoHealing } from "@/lib/crawler/circuit-breaker";
import {
  extractBuiltinFields,
  extractConfiguredFields,
  extractPurchaser,
  normalizeExtraFields,
  type AttachmentMeta,
  type ExtraFieldTarget,
  type NormalizedExtraFields,
  type RawExtraFields,
} from "./extraction";
import { extractFidelityHtml } from "./fidelity";
import { persistTender } from "./persist";
import { formatJsonTenderContent, isJsonString } from "@/lib/tender-json-formatter";
import type { FieldSpec, ListConfig, ParsedItem, SkillConfig } from "./types";

const MAX_CONTENT_LEN = 50_000;
const MAX_HTML_LEN = 500_000;

export type RunOptions = {
  maxPages?: number;
  dryRun?: boolean;
  file?: boolean;
  trigger?: "cron" | "manual" | "api" | "retry";
  /** 是否启用断点续采（默认 true，若显式传 false 或传了 sinceDate 则关闭） */
  resume?: boolean;
  /** 只保留发布日期不早于该时刻的公告，列表按日期倒序、整页过期时提前停止翻页 */
  sinceDate?: Date;
  /** 只保留发布日期不晚于该时刻的公告，晚于该日期的公告跳过不抓详情 */
  untilDate?: Date;
  /** 断点续采或时间段补采时的最大安全翻页深度，默认 50 */
  safeMaxPages?: number;
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
  skippedFuture: number;
  skippedExisting: number;
  checkpointDate: string | null;
  checkpointHit: boolean;
  mode: "resume" | "timerange" | "normal";
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
  if (typeof spec === "string") {
    if (spec.includes("{") && spec.includes("}")) {
      return spec.replace(/\{([A-Za-z0-9_.]+)\}/g, (_, p) => String(getByPath(item, p) ?? ""));
    }
    const val = getByPath(item, spec);
    if (val !== undefined && val !== null) {
      return typeof val === "string" ? val : String(val);
    }
    return "";
  }

  if (spec.const !== undefined) return spec.const;
  const path = spec.selector ?? "";
  if (!path) return "";
  const val = getByPath(item, path);
  if (val == null) return "";
  const raw = typeof val === "string" ? val : JSON.stringify(val);
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

/**
 * 同 getByPath，但路径中间遇到 JSON 字符串时自动再解析一层。
 * 适配「响应体里塞了一段 JSON 字符串」的接口（如重庆 `{code, content:"{...}"}` 的 `content.result.records`）。
 */
function getByPathAuto(obj: unknown, dotPath: string): unknown {
  let current: unknown = obj;
  for (const segment of dotPath.split(".")) {
    if (typeof current === "string") {
      const text = current.trim();
      if (
        (text.startsWith("{") && text.endsWith("}")) ||
        (text.startsWith("[") && text.endsWith("]"))
      ) {
        try {
          current = JSON.parse(text);
        } catch {
          return undefined;
        }
      }
    }
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** {page} 占位渲染，支持乘法与加减偏移（如 {page*20-20}），适配 pn/rn 偏移量式分页接口 */
function renderPageUrl(template: string, page: number): string {
  return template.replace(/\{page(?:\*(\d+))?(?:([+-])(\d+))?\}/g, (_, mult, sign, offset) => {
    const value = page * (mult ? Number.parseInt(mult, 10) : 1);
    const delta = offset ? Number.parseInt(offset, 10) : 0;
    return String(sign === "-" ? value - delta : value + delta);
  });
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

    let body = request.body ? renderPageUrl(request.body, page) : undefined;
    if (request.json) {
      body = JSON.stringify(request.json)
        .replace(/"\{page([+-]\d+)?\}"/g, (_, offset) =>
          String(page + (offset ? Number.parseInt(offset, 10) : 0)),
        )
        .replace(/\{page([+-]\d+)?\}/g, (_, offset) =>
          String(page + (offset ? Number.parseInt(offset, 10) : 0)),
        );
    }

    const raw = await fetchText(url, {
      method: request.method,
      headers: { ...settings.headers, ...request.headers },
      form,
      body,
      timeoutMs: settings.timeoutMs,
      retries: settings.retries,
      userAgent: settings.userAgent,
    });

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
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
  const resolve = (href: string) => {
    const normalized = list.urlReplace
      ? href.split(list.urlReplace.pattern).join(list.urlReplace.replacement)
      : href;
    return new URL(normalized, pageUrl || baseUrl).toString();
  };
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
    let dataObj = payload;
    if (typeof payload === "string") {
      try {
        dataObj = JSON.parse(payload);
      } catch {
        dataObj = null;
      }
    }
    const array = getByPathAuto(dataObj, list.parse.itemsPath ?? "data");
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
  const parsedUrl = new URL(item.url, "http://placeholder.invalid");
  const params = parsedUrl.searchParams;
  // 列表页常常只给 /xxhz/<分类>/.../<id>.html 这类壳页路径，ID 是最后一段文件名
  const lastSegment = parsedUrl.pathname.split("/").filter(Boolean).pop() ?? "";
  const stem = lastSegment.replace(/\.[a-z0-9]{1,5}$/i, "");
  const idFromPath = /[0-9]/.test(stem) && stem.length >= 6 ? stem : "";
  const uuidMatch = item.url.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  const slugMatch = item.url.match(/[\/=]([a-zA-Z0-9_-]{8,})\b/);
  const autoId =
    params.get("id") ||
    params.get("articleId") ||
    idFromPath ||
    (uuidMatch ? uuidMatch[0] : slugMatch ? slugMatch[1] : "");

  return template
    .replace(/\{id\}/g, autoId)
    .replace(/\{query:([A-Za-z0-9_]+)\}/g, (_, name: string) => params.get(name) ?? "")
    .replace(/\{YYYY\}/g, String(date.getFullYear()))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, "0"))
    .replace(/\{DD\}/g, String(date.getDate()).padStart(2, "0"));
}

const NUXT_WRAPPER_TAGS = new Set([
  "ShallowReactive",
  "Reactive",
  "ShallowRef",
  "Ref",
  "EmptyRef",
  "Object",
]);
const NUXT_SPECIAL_TAGS = new Set(["Set", "Map", "BigInt", "RegExp", "URL", "null"]);

/**
 * 解析 Nuxt 3 SSR payload（devalue 序列化的引用数组，形如 [["ShallowReactive",1],{...}]）。
 * 只做「按下标还原」，标签做惰性展开，遇到循环引用返回 undefined 而不是死循环。
 */
function resolveNuxtRef(
  payload: unknown[],
  ref: unknown,
  cache: Map<number, unknown>,
  stack: Set<number>,
): unknown {
  if (typeof ref !== "number" || !Number.isInteger(ref)) return ref;
  if (ref < 0 || ref >= payload.length) return undefined;
  if (cache.has(ref)) return cache.get(ref);
  if (stack.has(ref)) return undefined;

  const value = payload[ref];
  if (value === null || typeof value !== "object") {
    cache.set(ref, value);
    return value;
  }

  stack.add(ref);
  let resolved: unknown;
  if (Array.isArray(value)) {
    const tag = typeof value[0] === "string" ? value[0] : null;
    if (tag && NUXT_WRAPPER_TAGS.has(tag)) {
      resolved = resolveNuxtRef(payload, value[1], cache, stack);
    } else if (tag === "Date") {
      const ms = Number(resolveNuxtRef(payload, value[1], cache, stack));
      resolved = Number.isFinite(ms) ? new Date(ms) : null;
    } else if (tag && NUXT_SPECIAL_TAGS.has(tag)) {
      resolved = {
        __nuxtTag: tag,
        args: value.slice(1).map((entry) => resolveNuxtRef(payload, entry, cache, stack)),
      };
    } else {
      resolved = value.map((entry) => resolveNuxtRef(payload, entry, cache, stack));
    }
  } else {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      obj[key] = resolveNuxtRef(payload, entry, cache, stack);
    }
    resolved = obj;
  }
  stack.delete(ref);
  cache.set(ref, resolved);
  return resolved;
}

function findNuxtRichContent(node: unknown, seen: Set<object>): string | null {
  if (node === null || typeof node !== "object") return null;
  if (seen.has(node)) return null;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findNuxtRichContent(entry, seen);
      if (found) return found;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;
  const candidate = obj.infoContent;
  if (typeof candidate === "string" && candidate.length > 100 && candidate.includes("<")) {
    return candidate;
  }
  for (const entry of Object.values(obj)) {
    const found = findNuxtRichContent(entry, seen);
    if (found) return found;
  }
  return null;
}

/** 从 Nuxt SSR 页面里取出正文富文本（如重庆公共资源交易详情的 currentRecord.infoContent） */
function extractNuxtRichContent(html: string): string | null {
  if (!html.includes("__NUXT_DATA__")) return null;
  const match = html.match(
    /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!Array.isArray(payload) || payload.length < 2) return null;
  const root = resolveNuxtRef(payload, 1, new Map(), new Set());
  return findNuxtRichContent(root, new Set());
}

async function fetchDetail(
  itemUrl: string,
  detail: NonNullable<ListConfig["detail"]>,
  settings: SkillConfig["settings"],
): Promise<FetchedDetail> {
  const rawText = await fetchText(itemUrl, {
    headers: settings.headers,
    timeoutMs: settings.timeoutMs,
    retries: settings.retries,
    userAgent: settings.userAgent,
  });

  let htmlToParse = rawText;
  const trimmed = rawText.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidateHtml =
        parsed?.data?.data?.body ||
        parsed?.data?.body ||
        parsed?.data?.content ||
        parsed?.data?.noticeContent ||
        parsed?.data?.html ||
        parsed?.result?.data?.content ||
        parsed?.result?.content ||
        parsed?.content ||
        parsed?.noticeContent;

      if (typeof candidateHtml === "string" && candidateHtml.trim()) {
        const str = candidateHtml.trim();
        // 判断是否为 base64 字符串（如山东省政府采购网接口）
        if (/^[A-Za-z0-9+/=\s]+$/.test(str) && str.length > 50) {
          try {
            const buf = Buffer.from(str.replace(/\s+/g, ""), "base64");
            let decoded = buf.toString("utf-8");
            // 若 UTF-8 出现替换字符，自动尝试 GB18030（山东等政采站标准编码）
            if (decoded.includes("\uFFFD")) {
              try {
                const gbkDecoded = new TextDecoder("gb18030", { fatal: false }).decode(buf);
                if (!gbkDecoded.includes("\uFFFD")) {
                  decoded = gbkDecoded;
                }
              } catch {
                // keep utf-8
              }
            }
            if (decoded.includes("<") && decoded.includes(">")) {
              htmlToParse = decoded;
            } else {
              htmlToParse = decoded || candidateHtml;
            }
          } catch {
            htmlToParse = candidateHtml;
          }
        } else {
          htmlToParse = candidateHtml;
        }
      } else {
        // 无富文本 HTML 字段，说明是纯结构化 JSON 接口（如广东省政府采购网）
        const formatted = formatJsonTenderContent(trimmed);
        if (formatted.isJson && Object.keys(formatted.fields).length > 0) {
          htmlToParse = formatted.htmlText;
        }
      }
    } catch {
      // 保持 rawText
    }
  } else {
    // Nuxt SSR 页面：正文在 __NUXT_DATA__ payload 里，不在 DOM 中（如重庆公共资源交易）
    const nuxtContent = extractNuxtRichContent(rawText);
    if (nuxtContent) htmlToParse = nuxtContent;
  }

  const fidelity = extractFidelityHtml(htmlToParse, {
    contentSelector: detail.contentSelector,
    removeSelector: detail.removeSelector,
    baseUrl: itemUrl,
    maxHtmlLen: MAX_HTML_LEN,
    maxContentLen: MAX_CONTENT_LEN,
  });

  let finalContent = fidelity.plainText;
  let finalHtml = fidelity.fidelityHtml;

  // 兜底保障：若提取结果仍为原始未解开的 JSON 串，强制转换为公文排版
  if (isJsonString(finalContent)) {
    const formatted = formatJsonTenderContent(finalContent);
    finalContent = formatted.plainText;
    if (!finalHtml || isJsonString(finalHtml)) {
      finalHtml = formatted.htmlText;
    }
  }

  return {
    content: finalContent,
    contentHtml: finalHtml,
    attachments: fidelity.attachments,
  };
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

  const isTimeRangeMode = Boolean(options.sinceDate || options.untilDate);
  const isResumeMode = !isTimeRangeMode && options.resume !== false;
  const mode: "resume" | "timerange" | "normal" = isTimeRangeMode
    ? "timerange"
    : isResumeMode
      ? "resume"
      : "normal";

  let checkpointDate: Date | null = null;
  if (isResumeMode && !options.file) {
    const latestTender = await prisma.tender.findFirst({
      where: { sourceName: config.source.name },
      orderBy: { publishDate: "desc" },
      select: { publishDate: true },
    });
    if (latestTender?.publishDate) {
      checkpointDate = toDayStart(latestTender.publishDate);
    }
  }

  const sinceMs = isTimeRangeMode
    ? (options.sinceDate ? toDayStart(options.sinceDate).getTime() : null)
    : isResumeMode
      ? (checkpointDate ? checkpointDate.getTime() : null)
      : (options.sinceDate ? options.sinceDate.getTime() : null);

  const untilMs = isTimeRangeMode
    ? (options.untilDate ? toDayEnd(options.untilDate).getTime() : null)
    : null;

  const defaultMaxPages = (isResumeMode || isTimeRangeMode)
    ? (options.safeMaxPages ?? 50)
    : (config.settings.maxPages ?? source?.maxPages ?? 2);
  const maxPagesLimit = options.maxPages ?? defaultMaxPages;

  const settings = {
    requestDelayMs: config.settings.requestDelayMs ?? 1500,
    timeoutMs: config.settings.timeoutMs ?? 20_000,
    retries: config.settings.retries ?? 2,
    maxPages: maxPagesLimit,
    headers: config.settings.headers,
    userAgent: config.settings.userAgent,
  };
  const regionMatcher = await loadRegionMatcher();
  const dryItems: DryRunItem[] = [];
  const errors: string[] = [];
  let newCount = 0;
  let fetched = 0;
  let itemsParsed = 0;
  let skippedOld = 0;
  let skippedFuture = 0;
  let skippedExisting = 0;
  let checkpointHit = false;
  let httpOk = 0;
  let httpFail = 0;
  let latencyTotal = 0;

  for (const list of config.lists) {
    const startPage = list.startPage ?? 1;
    const maxPages = options.maxPages ?? (list.maxPages ? Math.min(list.maxPages, maxPagesLimit) : maxPagesLimit);

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

      const urls = items.map((it) => it.url).filter(Boolean);
      const existingList = options.file || options.dryRun
        ? []
        : await prisma.tender.findMany({
            where: { sourceUrl: { in: urls } },
            select: { sourceUrl: true },
          });
      const existingUrls = new Set(existingList.map((t) => t.sourceUrl));

      for (const item of items) {
        if (item.date) {
          const itemMs = item.date.getTime();
          if (untilMs !== null && itemMs > untilMs) {
            skippedFuture++;
            continue;
          }
          if (sinceMs !== null && itemMs < sinceMs) {
            skippedOld++;
            continue;
          }
        }

        // 断点续采模式下的去重短路：数据库已存在且日期不晚于断点，无需重新拉取详情
        if (isResumeMode && checkpointDate && existingUrls.has(item.url)) {
          if (!item.date || item.date.getTime() <= checkpointDate.getTime()) {
            skippedExisting++;
            continue;
          }
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
  // 列表接口常无采购人（如 ggzy），用正文兜底；列表值优先
  const purchaser = item.purchaser ?? extractPurchaser(detail.content) ?? null;

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
            // 采购人名称常带行政区（如「新疆生产建设兵团…」），放在标题之后作为兜底文本，
            // 不改变「列表地区优先、标题/正文就近匹配」的既有判定顺序。
            const regionText = `${item.province ?? ""}${item.city ?? ""} ${item.title} ${item.hint ?? ""} ${item.purchaser ?? ""} ${detail.content.slice(0, 300)}`;
            const region = regionMatcher.match(regionText);

            const created = await persistTender(
              {
                title: item.title,
                type: list.type,
                publishDate: item.date ?? new Date(),
                expireDate: extractExpireDate(detail.content),
                provinceCode: region.provinceCode,
                cityCode: region.cityCode,
                purchaser,
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

      // 时间段模式下：列表按发布日期倒序，当整页所有已知日期的条目都早于起始时间时，提前终止翻页
      if (isTimeRangeMode && sinceMs !== null && items.length > 0) {
        const datedItems = items.filter((it) => it.date !== null);
        if (datedItems.length > 0 && datedItems.every((it) => it.date!.getTime() < sinceMs)) {
          break;
        }
      }

      // 断点续采模式下：如果存在历史断点，且整页条目均早于断点，或者整页所有条目均已入库且日期不晚于断点，说明已触及断点，提前停止翻页
      if (isResumeMode && checkpointDate !== null && items.length > 0) {
        const datedItems = items.filter((it) => it.date !== null);
        const allDatedBeforeCheckpoint =
          datedItems.length > 0 && datedItems.every((it) => it.date!.getTime() < sinceMs!);
        const allItemsAlreadyExisting =
          items.every((it) => existingUrls.has(it.url)) &&
          items.every((it) => !it.date || it.date.getTime() <= checkpointDate!.getTime());

        if (allDatedBeforeCheckpoint || allItemsAlreadyExisting) {
          checkpointHit = true;
          break;
        }
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
    skippedFuture,
    skippedExisting,
    checkpointDate: checkpointDate ? formatDate(checkpointDate) : null,
    checkpointHit,
    mode,
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

/** 供 crawler/doctor.ts 做无数据库健康巡检（不涉及持久化与区划匹配） */
export { fetchListPage, parseListItems, fetchDetail, resolveDetailUrl };

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

    let message = "";
    if (result.mode === "timerange") {
      const rangeStr = `${options.sinceDate ? formatDate(options.sinceDate) : "起始"} 至 ${options.untilDate ? formatDate(options.untilDate) : "最新"}`;
      message = `时间段采集 [${rangeStr}]：抓取 ${result.fetched} 条，新增 ${result.newCount} 条，解析 ${result.itemsParsed} 条${
        result.skippedOld > 0 ? `，过滤范围外旧数据 ${result.skippedOld} 条` : ""
      }${result.skippedFuture > 0 ? `，过滤范围外新数据 ${result.skippedFuture} 条` : ""}`;
    } else if (result.mode === "resume") {
      message = `断点续采：抓取 ${result.fetched} 条，新增 ${result.newCount} 条，解析 ${result.itemsParsed} 条${
        result.skippedExisting > 0 ? `，跳过已入库历史数据 ${result.skippedExisting} 条` : ""
      }${
        result.checkpointDate
          ? result.checkpointHit
            ? `，已衔接历史断点 (${result.checkpointDate}) 自动停止`
            : `，从历史断点 (${result.checkpointDate}) 补采`
          : "，首次抓取建立初始断点"
      }`;
    } else {
      message = `抓取 ${result.fetched} 条，新增 ${result.newCount} 条，解析 ${result.itemsParsed} 条${
        result.skippedOld > 0 ? `，跳过截止日期前旧数据 ${result.skippedOld} 条` : ""
      }`;
    }

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
