import type { Prisma } from "@prisma/client";
import { buildFullTextWhere } from "@/lib/fulltext";

export type ListSearchParams = {
  q?: string;
  type?: string;
  province?: string;
  city?: string;
  from?: string;
  to?: string;
  page?: string;
  purchaser?: string;
  winningSupplier?: string;
  minBudget?: string;
  maxBudget?: string;
  industryCode?: string;
  hasAttachment?: string;
};

const VALID_TYPES = new Set(["NOTICE", "RESULT", "CHANGE", "INQUIRY"]);

export function buildWhere(sp: ListSearchParams): Prisma.TenderWhereInput {
  const where: Prisma.TenderWhereInput = {};

  // Determine if full‑text search mode is enabled via env var
  const useFullText = process.env.SEARCH_MODE === 'fulltext';

  // 1. 多关键词分词与组合逻辑 (AND 语义)
  const q = sp.q?.trim();
  if (q) {
    if (useFullText) {
      // Use PostgreSQL full‑text search helper
      Object.assign(where, buildFullTextWhere(q));
    } else {
      const tokens = q.split(/\s+/).filter(Boolean);
      if (tokens.length === 1) {
        where.OR = [
          { title: { contains: tokens[0] } },
          { content: { contains: tokens[0] } },
          { purchaser: { contains: tokens[0] } },
          { winningSupplier: { contains: tokens[0] } },
        ];
      } else if (tokens.length > 1) {
        where.AND = tokens.map((token) => ({
          OR: [
            { title: { contains: token } },
            { content: { contains: token } },
            { purchaser: { contains: token } },
            { winningSupplier: { contains: token } },
          ],
        }));
      }
    }
  }

  // 2. 信息类型
  if (sp.type && VALID_TYPES.has(sp.type)) {
    where.type = sp.type;
  }

  // 3. 行政区划
  if (sp.province) where.provinceCode = sp.province;
  if (sp.city) where.cityCode = sp.city;

  // 4. 采购人与中标商
  if (sp.purchaser?.trim()) {
    where.purchaser = { contains: sp.purchaser.trim() };
  }
  if (sp.winningSupplier?.trim()) {
    where.winningSupplier = { contains: sp.winningSupplier.trim() };
  }

  // 5. 预算金额区间筛选 (单位: 万元，转为元计算)
  const minB = sp.minBudget ? parseFloat(sp.minBudget) : NaN;
  const maxB = sp.maxBudget ? parseFloat(sp.maxBudget) : NaN;
  if (!isNaN(minB) || !isNaN(maxB)) {
    const bFilter: Prisma.DecimalNullableFilter = {};
    if (!isNaN(minB)) bFilter.gte = minB * 10000;
    if (!isNaN(maxB)) bFilter.lte = maxB * 10000;
    where.budgetAmount = bFilter;
  }

  // 6. 行业分类筛选
  if (sp.industryCode && sp.industryCode !== "ALL" && sp.industryCode.trim()) {
    where.industryCode = sp.industryCode.trim();
  }

  // 7. 是否含标书附件
  if (sp.hasAttachment === "1" || sp.hasAttachment === "true") {
    where.attachments = { some: {} };
  }

  // 8. 发布日期范围
  const pub: Prisma.DateTimeFilter = {};
  if (sp.from) {
    const d = new Date(sp.from);
    if (!isNaN(d.getTime())) pub.gte = d;
  }
  if (sp.to) {
    const d = new Date(`${sp.to}T23:59:59`);
    if (!isNaN(d.getTime())) pub.lte = d;
  }
  if (pub.gte || pub.lte) where.publishDate = pub;

  return where;
}

export const PAGE_SIZE = 20;

export function buildQueryString(sp: ListSearchParams, overrides: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = { ...sp, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null && v !== "") {
      params.set(k, v);
    }
  }
  return params.toString();
}

export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * 结构化切分文本，将用户搜索词标记为高亮分片
 */
export function tokenizeHighlight(text: string, query?: string): HighlightSegment[] {
  if (!text) return [];
  if (!query || !query.trim()) return [{ text, highlight: false }];

  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.trim());

  if (tokens.length === 0) return [{ text, highlight: false }];

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(regex);
  return parts.map((part) => {
    const isMatch = tokens.some((token) => token.toLowerCase() === part.toLowerCase());
    return {
      text: part,
      highlight: isMatch,
    };
  });
}
