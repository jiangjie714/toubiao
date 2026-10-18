import { tenderTypeLabel } from "@/lib/constants";

/**
 * 公共 SEO 落地页使用的类型短链（拼音，利于收录、可读与内链结构稳定）。
 * 与数据库 Tender.type 取值一一对应。
 */
export const SEO_TYPE_SLUGS = [
  { slug: "zhaobiao", type: "NOTICE" },
  { slug: "zhongbiao", type: "RESULT" },
  { slug: "biangeng", type: "CHANGE" },
  { slug: "xunjia", type: "INQUIRY" },
] as const;

export function typeFromSlug(slug: string): string | null {
  return SEO_TYPE_SLUGS.find((s) => s.slug === slug)?.type ?? null;
}

export function slugFromType(type: string): string | null {
  return SEO_TYPE_SLUGS.find((s) => s.type === type)?.slug ?? null;
}

export function seoTypeLabel(type: string): string {
  return tenderTypeLabel(type);
}

/** 公共 SEO 落地页公开字段（不含联系方式/附件等付费内容） */
export type SeoLandingItem = {
  id: number;
  title: string;
  type: string;
  provinceCode: string | null;
  cityCode: string | null;
  purchaser: string | null;
  budgetAmount: unknown;
  awardAmount: unknown;
  publishDate: Date | null;
  sourceName: string | null;
};
