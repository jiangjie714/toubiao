import * as cheerio from "cheerio";
import { parseDate } from "./dates";
import type { ExtractionSpec } from "./types";

export const EXTRA_FIELD_TARGETS = {
  projectNo: { column: "projectNo", type: "string" },
  budgetAmount: { column: "budgetAmount", type: "decimal" },
  awardAmount: { column: "awardAmount", type: "decimal" },
  openTime: { column: "openTime", type: "datetime" },
  industryCode: { column: "industryCode", type: "industry" },
  winningSupplier: { column: "winningSupplier", type: "string" },
  agency: { column: "agency", type: "string" },
  contactPhone: { column: "OrgContact.phone", type: "phone" },
  contactEmail: { column: "OrgContact.email", type: "email" },
  contactAddress: { column: "OrgContact.address", type: "string" },
} as const;

export type ExtraFieldTarget = keyof typeof EXTRA_FIELD_TARGETS;
export type RawExtraFields = Partial<Record<ExtraFieldTarget, string>>;

export type NormalizedExtraFields = {
  projectNo?: string;
  budgetAmount?: number;
  awardAmount?: number;
  openTime?: Date;
  industryCode?: string;
  winningSupplier?: string;
  agency?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactAddress?: string;
};

export type AttachmentMeta = {
  name: string;
  sourceUrl: string;
};

export const BUILTIN_EXTRACTION: Record<ExtraFieldTarget, ExtractionSpec> = {
  projectNo: { regex: "(?:项目编号|采购编号|招标编号)[：:]\\s*([A-Za-z0-9\\-—]{6,40})" },
  budgetAmount: { regex: "(?:预算金额|最高限价)[（(]?[^)）]*[)）]?[：:]\\s*([\\d,，.]+)\\s*(万)?元?" },
  awardAmount: { regex: "(?:中标金额|成交金额)[：:]\\s*([\\d,，.]+)\\s*(万)?元?" },
  openTime: { regex: "(?:开标时间|开启时间)[：:]\\s*(\\d{4}年\\d{1,2}月\\d{1,2}日[^，,。\\s]{0,10})" },
  industryCode: { regex: "(医疗设备|信息化|软件开发|工程施工|办公物资|物业服务|维修保养|检验检测|教育装备|环保设备)" },
  winningSupplier: { regex: "中标(?:供应商|人)[：:]\\s*([^\\s，,。；;]{4,40})" },
  agency: { regex: "(?:采购代理机构|代理机构|集中采购机构)(?:[\\s\\S]{0,10}?名\\s*称\\s*[：:]|[：:])\\s*([^\\s，,。；;]{4,40})" },
  contactPhone: { regex: "(?:联系电话|联系方式|电\\s*话)[：:]\\s*([\\d\\-—()]{7,20})" },
  contactEmail: { regex: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}" },
  contactAddress: { regex: "(?:地址|通讯地址)[：:]\\s*([^\\s]{6,60})" },
};

const INDUSTRY_DICT: Record<string, string> = {
  医疗设备: "MEDICAL_EQUIPMENT",
  信息化: "IT",
  软件开发: "IT_SOFTWARE",
  工程施工: "ENGINEERING",
  办公物资: "OFFICE_SUPPLIES",
  物业服务: "PROPERTY_SERVICE",
  维修保养: "MAINTENANCE",
  检验检测: "INSPECTION",
  教育装备: "EDUCATION_EQUIPMENT",
  环保设备: "ENVIRONMENTAL_EQUIPMENT",
};

function applyRegex(value: string, regex: string): string {
  const match = value.match(new RegExp(regex, "u"));
  if (!match) return "";
  const captures = match.slice(1).filter((capture) => capture !== undefined);
  return (captures.length > 0 ? captures.join(" ") : match[0]).trim();
}

export function extractWithSpec(
  $: cheerio.CheerioAPI,
  scope: cheerio.Cheerio<never>,
  spec: ExtractionSpec,
): string {
  let raw = "";
  if (spec.selector) {
    const target = scope.find(spec.selector).first();
    raw = spec.attr && spec.attr !== "text" ? target.attr(spec.attr) ?? "" : target.text();
  } else {
    raw = scope.text();
  }
  return applyRegex(raw.replace(/\u00a0/g, " "), spec.regex);
}

export function extractConfiguredFields(
  html: string,
  extraction: Record<string, ExtractionSpec> | undefined,
): { fields: RawExtraFields; confidence: Record<string, number> } {
  const $ = cheerio.load(`<div>${html}</div>`);
  const scope = $("div").first() as cheerio.Cheerio<never>;
  const fields: RawExtraFields = {};
  const confidence: Record<string, number> = {};

  for (const [key, spec] of Object.entries(extraction ?? {})) {
    const value = extractWithSpec($, scope, spec);
    if (value) {
      fields[key as ExtraFieldTarget] = value;
      confidence[key] = 0.8;
    }
  }
  return { fields, confidence };
}

export function extractBuiltinFields(
  text: string,
): { fields: RawExtraFields; confidence: Record<string, number> } {
  const fields: RawExtraFields = {};
  const confidence: Record<string, number> = {};
  const normalized = text.replace(/\u00a0/g, " ");

  for (const [key, spec] of Object.entries(BUILTIN_EXTRACTION)) {
    const value = applyRegex(normalized, spec.regex);
    if (value) {
      fields[key as ExtraFieldTarget] = value;
      confidence[key] = 0.6;
    }
  }
  return { fields, confidence };
}

export function parseDecimalAmount(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const text = input.replace(/,/g, "").replace(/，/g, "");
  const match = text.match(/([\d.]+)\s*(万)?元?/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Number((match[2] === "万" ? value * 10_000 : value).toFixed(2));
}

export function normalizePhone(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const normalized = input.replace(/[（）()]/g, "").replace(/[—–]/g, "-").trim();
  return /^[\d-]{7,20}$/.test(normalized) ? normalized : undefined;
}

export function normalizeEmail(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(input) ? input : undefined;
}

export function normalizeIndustry(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const matched = Object.keys(INDUSTRY_DICT)
    .filter((keyword) => input.includes(keyword))
    .sort((a, b) => b.length - a.length)[0];
  return matched ? INDUSTRY_DICT[matched] : undefined;
}

export function normalizeExtraFields(
  raw: RawExtraFields,
): { fields: NormalizedExtraFields; validKeys: string[] } {
  const fields: NormalizedExtraFields = {};
  const validKeys: string[] = [];

  if (raw.projectNo) {
    fields.projectNo = raw.projectNo;
    validKeys.push("projectNo");
  }
  if (raw.budgetAmount) {
    const value = parseDecimalAmount(raw.budgetAmount);
    if (value !== undefined) {
      fields.budgetAmount = value;
      validKeys.push("budgetAmount");
    }
  }
  if (raw.awardAmount) {
    const value = parseDecimalAmount(raw.awardAmount);
    if (value !== undefined) {
      fields.awardAmount = value;
      validKeys.push("awardAmount");
    }
  }
  if (raw.openTime) {
    const value = parseDate(raw.openTime);
    if (value) {
      fields.openTime = value;
      validKeys.push("openTime");
    }
  }
  if (raw.industryCode) {
    const value = normalizeIndustry(raw.industryCode);
    if (value) {
      fields.industryCode = value;
      validKeys.push("industryCode");
    }
  }
  if (raw.winningSupplier) {
    fields.winningSupplier = raw.winningSupplier;
    validKeys.push("winningSupplier");
  }
  if (raw.agency) {
    fields.agency = raw.agency;
    validKeys.push("agency");
  }
  if (raw.contactPhone) {
    const value = normalizePhone(raw.contactPhone);
    if (value) {
      fields.contactPhone = value;
      validKeys.push("contactPhone");
    }
  }
  if (raw.contactEmail) {
    const value = normalizeEmail(raw.contactEmail);
    if (value) {
      fields.contactEmail = value;
      validKeys.push("contactEmail");
    }
  }
  if (raw.contactAddress) {
    fields.contactAddress = raw.contactAddress;
    validKeys.push("contactAddress");
  }

  return { fields, validKeys };
}

export function extractAttachments(html: string, baseUrl: string): AttachmentMeta[] {
  const $ = cheerio.load(`<div>${html}</div>`);
  const attachments: AttachmentMeta[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, anchor) => {
    const $anchor = $(anchor);
    const rawHref = ($anchor.attr("href") ?? "").trim();
    if (!rawHref || rawHref.startsWith("#")) return;
    try {
      const href = new URL(rawHref, baseUrl);
      if (href.protocol !== "http:" && href.protocol !== "https:") return;
      const url = href.toString();
      if (seen.has(url)) return;
      seen.add(url);
      attachments.push({ name: $anchor.text().trim() || url, sourceUrl: url });
    } catch {
      return;
    }
  });
  return attachments;
}
