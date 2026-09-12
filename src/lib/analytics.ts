import { prisma } from "@/lib/prisma";
import { tenderTypeLabel } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

export interface DailyTrendPoint {
  date: string;
  count: number;
  budgetWan: number;
}

export interface TypeDistributionItem {
  type: string;
  label: string;
  count: number;
  percentage: number;
}

export interface TopPurchaserItem {
  purchaser: string;
  count: number;
  totalBudgetWan: number;
  latestDate: string;
}

export interface TopSupplierItem {
  supplier: string;
  count: number;
  totalAwardWan: number;
  latestDate: string;
}

export interface TopProjectItem {
  id: number;
  title: string;
  budgetAmountWan: number;
  publishDate: string;
  purchaser: string | null;
  provinceCode: string | null;
  provinceName?: string;
}

export interface ProvinceStatItem {
  code: string;
  name: string;
  count: number;
  totalBudgetWan: number;
}

export interface MarketOverviewData {
  timeframeDays: number;
  totalTenders: number;
  totalBudgetWan: number;
  activePurchasersCount: number;
  winningSuppliersCount: number;
  dailyTrend: DailyTrendPoint[];
  typeDistribution: TypeDistributionItem[];
  provinceDistribution: ProvinceStatItem[];
  topPurchasers: TopPurchaserItem[];
  topSuppliers: TopSupplierItem[];
  topBudgetTenders: TopProjectItem[];
}

export async function getMarketOverview(
  days: number = 30,
  provinceCode?: string
): Promise<MarketOverviewData> {
  const where: Prisma.TenderWhereInput = {};
  
  if (days > 0) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where.publishDate = { gte: startDate };
  }
  if (provinceCode) {
    where.provinceCode = provinceCode;
  }

  // 1. 获取核心统计量与全量匹配记录
  const [totalTenders, tenders, regions] = await Promise.all([
    prisma.tender.count({ where }),
    prisma.tender.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        provinceCode: true,
        publishDate: true,
        purchaser: true,
        winningSupplier: true,
        budgetAmount: true,
        awardAmount: true,
      },
      orderBy: { publishDate: "desc" },
    }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
    }),
  ]);

  const regionNameMap = new Map<string, string>();
  for (const r of regions) {
    regionNameMap.set(r.code, r.name);
  }

  let totalBudgetWan = 0;
  const purchaserSet = new Set<string>();
  const supplierSet = new Set<string>();
  const typeCountMap: Record<string, number> = {};
  const dateMap: Record<string, { count: number; budgetWan: number }> = {};
  const purchaserAgg: Record<string, { count: number; budgetWan: number; latestDate: Date }> = {};
  const supplierAgg: Record<string, { count: number; awardWan: number; latestDate: Date }> = {};
  const provinceAgg: Record<string, { count: number; budgetWan: number }> = {};

  const budgetProjects: TopProjectItem[] = [];

  for (const item of tenders) {
    const bAmt = item.budgetAmount ? Number(item.budgetAmount) : 0;
    const aAmt = item.awardAmount ? Number(item.awardAmount) : 0;
    totalBudgetWan += bAmt;

    // Purchaser
    if (item.purchaser && item.purchaser.trim().length > 1) {
      const pName = item.purchaser.trim();
      purchaserSet.add(pName);
      if (!purchaserAgg[pName]) {
        purchaserAgg[pName] = { count: 0, budgetWan: 0, latestDate: item.publishDate };
      }
      purchaserAgg[pName].count += 1;
      purchaserAgg[pName].budgetWan += bAmt;
      if (item.publishDate > purchaserAgg[pName].latestDate) {
        purchaserAgg[pName].latestDate = item.publishDate;
      }
    }

    // Supplier
    if (item.winningSupplier && item.winningSupplier.trim().length > 1) {
      const sName = item.winningSupplier.trim();
      supplierSet.add(sName);
      if (!supplierAgg[sName]) {
        supplierAgg[sName] = { count: 0, awardWan: 0, latestDate: item.publishDate };
      }
      supplierAgg[sName].count += 1;
      supplierAgg[sName].awardWan += aAmt;
      if (item.publishDate > supplierAgg[sName].latestDate) {
        supplierAgg[sName].latestDate = item.publishDate;
      }
    }

    // Type
    typeCountMap[item.type] = (typeCountMap[item.type] || 0) + 1;

    // Daily Trend
    const dateStr = item.publishDate.toISOString().slice(0, 10);
    if (!dateMap[dateStr]) {
      dateMap[dateStr] = { count: 0, budgetWan: 0 };
    }
    dateMap[dateStr].count += 1;
    dateMap[dateStr].budgetWan += bAmt;

    // Province
    if (item.provinceCode) {
      if (!provinceAgg[item.provinceCode]) {
        provinceAgg[item.provinceCode] = { count: 0, budgetWan: 0 };
      }
      provinceAgg[item.provinceCode].count += 1;
      provinceAgg[item.provinceCode].budgetWan += bAmt;
    }

    // Budget Projects for top project ranking
    if (bAmt > 0) {
      budgetProjects.push({
        id: item.id,
        title: item.title,
        budgetAmountWan: Math.round(bAmt * 100) / 100,
        publishDate: item.publishDate.toISOString().slice(0, 10),
        purchaser: item.purchaser,
        provinceCode: item.provinceCode,
        provinceName: item.provinceCode ? regionNameMap.get(item.provinceCode) || item.provinceCode : undefined,
      });
    }
  }

  // Type Distribution
  const typeDistribution: TypeDistributionItem[] = Object.entries(typeCountMap)
    .map(([type, count]) => ({
      type,
      label: tenderTypeLabel(type),
      count,
      percentage: totalTenders > 0 ? Math.round((count / totalTenders) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Daily Trend (sorted chronologically)
  const dailyTrend: DailyTrendPoint[] = Object.entries(dateMap)
    .map(([date, val]) => ({
      date,
      count: val.count,
      budgetWan: Math.round(val.budgetWan * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top Purchasers (Sort by count desc, then budget desc)
  const topPurchasers: TopPurchaserItem[] = Object.entries(purchaserAgg)
    .map(([purchaser, val]) => ({
      purchaser,
      count: val.count,
      totalBudgetWan: Math.round(val.budgetWan * 100) / 100,
      latestDate: val.latestDate.toISOString().slice(0, 10),
    }))
    .sort((a, b) => b.count - a.count || b.totalBudgetWan - a.totalBudgetWan)
    .slice(0, 10);

  // Top Suppliers (Sort by count desc, then award desc)
  const topSuppliers: TopSupplierItem[] = Object.entries(supplierAgg)
    .map(([supplier, val]) => ({
      supplier,
      count: val.count,
      totalAwardWan: Math.round(val.awardWan * 100) / 100,
      latestDate: val.latestDate.toISOString().slice(0, 10),
    }))
    .sort((a, b) => b.count - a.count || b.totalAwardWan - a.totalAwardWan)
    .slice(0, 10);

  // Top Budget Projects (Top 5)
  const topBudgetTenders = budgetProjects
    .sort((a, b) => b.budgetAmountWan - a.budgetAmountWan)
    .slice(0, 5);

  // Province Distribution (Top 8)
  const provinceDistribution: ProvinceStatItem[] = Object.entries(provinceAgg)
    .map(([code, val]) => ({
      code,
      name: regionNameMap.get(code) || code,
      count: val.count,
      totalBudgetWan: Math.round(val.budgetWan * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    timeframeDays: days,
    totalTenders,
    totalBudgetWan: Math.round(totalBudgetWan * 100) / 100,
    activePurchasersCount: purchaserSet.size,
    winningSuppliersCount: supplierSet.size,
    dailyTrend,
    typeDistribution,
    provinceDistribution,
    topPurchasers,
    topSuppliers,
    topBudgetTenders,
  };
}

export interface WeeklyBriefData {
  generatedAt: string;
  startDate: string;
  endDate: string;
  newTendersCount: number;
  newBudgetWan: number;
  topOpportunities: TopProjectItem[];
  expiringTenders: {
    id: number;
    title: string;
    expireDate: string;
    purchaser: string | null;
    provinceName?: string;
  }[];
  recentAwards: {
    id: number;
    title: string;
    winningSupplier: string;
    awardAmountWan: number | null;
    publishDate: string;
  }[];
  trackerSummary?: {
    totalFollows: number;
    wonCount: number;
    draftingCount: number;
  };
}

export async function getWeeklyBriefData(userId?: number): Promise<WeeklyBriefData> {
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [recentTenders, regions, userFollows] = await Promise.all([
    prisma.tender.findMany({
      where: { publishDate: { gte: sevenDaysAgo } },
      select: {
        id: true,
        title: true,
        type: true,
        publishDate: true,
        expireDate: true,
        purchaser: true,
        winningSupplier: true,
        budgetAmount: true,
        awardAmount: true,
        provinceCode: true,
      },
      orderBy: { publishDate: "desc" },
    }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
    }),
    userId
      ? prisma.tenderFollow.findMany({
          where: { userId },
          select: { status: true },
        })
      : Promise.resolve([]),
  ]);

  const regionNameMap = new Map<string, string>();
  for (const r of regions) {
    regionNameMap.set(r.code, r.name);
  }

  let newBudgetWan = 0;
  const topOpportunities: TopProjectItem[] = [];
  const expiringTenders: WeeklyBriefData["expiringTenders"] = [];
  const recentAwards: WeeklyBriefData["recentAwards"] = [];

  for (const t of recentTenders) {
    const bAmt = t.budgetAmount ? Number(t.budgetAmount) : 0;
    const aAmt = t.awardAmount ? Number(t.awardAmount) : 0;
    newBudgetWan += bAmt;

    if (bAmt > 0) {
      topOpportunities.push({
        id: t.id,
        title: t.title,
        budgetAmountWan: Math.round(bAmt * 100) / 100,
        publishDate: t.publishDate.toISOString().slice(0, 10),
        purchaser: t.purchaser,
        provinceCode: t.provinceCode,
        provinceName: t.provinceCode ? regionNameMap.get(t.provinceCode) : undefined,
      });
    }

    if (t.expireDate && t.expireDate > now) {
      expiringTenders.push({
        id: t.id,
        title: t.title,
        expireDate: t.expireDate.toISOString().slice(0, 10),
        purchaser: t.purchaser,
        provinceName: t.provinceCode ? regionNameMap.get(t.provinceCode) : undefined,
      });
    }

    if (t.type === "RESULT" && t.winningSupplier) {
      recentAwards.push({
        id: t.id,
        title: t.title,
        winningSupplier: t.winningSupplier,
        awardAmountWan: aAmt > 0 ? Math.round(aAmt * 100) / 100 : null,
        publishDate: t.publishDate.toISOString().slice(0, 10),
      });
    }
  }

  topOpportunities.sort((a, b) => b.budgetAmountWan - a.budgetAmountWan);

  let trackerSummary: WeeklyBriefData["trackerSummary"] | undefined;
  if (userId) {
    trackerSummary = {
      totalFollows: userFollows.length,
      wonCount: userFollows.filter((f) => f.status === "WON").length,
      draftingCount: userFollows.filter((f) => f.status === "DRAFTING").length,
    };
  }

  return {
    generatedAt: now.toISOString().slice(0, 10),
    startDate: sevenDaysAgo.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    newTendersCount: recentTenders.length,
    newBudgetWan: Math.round(newBudgetWan * 100) / 100,
    topOpportunities: topOpportunities.slice(0, 8),
    expiringTenders: expiringTenders.slice(0, 6),
    recentAwards: recentAwards.slice(0, 6),
    trackerSummary,
  };
}
