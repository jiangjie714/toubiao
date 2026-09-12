import type { Prisma } from "@prisma/client";

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
};

const VALID_TYPES = new Set(["NOTICE", "RESULT", "CHANGE", "INQUIRY"]);

export function buildWhere(sp: ListSearchParams): Prisma.TenderWhereInput {
  const where: Prisma.TenderWhereInput = {};
  const q = sp.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { content: { contains: q } },
      { purchaser: { contains: q } },
      { winningSupplier: { contains: q } },
    ];
  }
  if (sp.type && VALID_TYPES.has(sp.type)) where.type = sp.type;
  if (sp.province) where.provinceCode = sp.province;
  if (sp.city) where.cityCode = sp.city;
  if (sp.purchaser?.trim()) where.purchaser = { contains: sp.purchaser.trim() };
  if (sp.winningSupplier?.trim()) where.winningSupplier = { contains: sp.winningSupplier.trim() };

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
    if (v) params.set(k, v);
  }
  return params.toString();
}
