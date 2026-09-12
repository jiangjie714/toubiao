import { prisma } from "@/lib/prisma";

export interface SupplierSummary {
  name: string;
  winCount: number;
  totalAwardWan: number;
  avgAwardWan: number;
  latestDate: string;
  firstDate: string;
  mainPurchasers: string[];
  provinces: string[];
}

export interface SupplierProfileData {
  name: string;
  winCount: number;
  totalAwardWan: number;
  avgAwardWan: number;
  maxAwardWan: number;
  minAwardWan: number;
  firstWinDate: string;
  latestWinDate: string;
  activeDaysSpan: number;
  provinces: Array<{ code: string; name: string; count: number; awardWan: number }>;
  topPurchasers: Array<{ purchaser: string; count: number; totalAwardWan: number; isLocked: boolean }>;
  recentTenders: Array<{
    id: number;
    title: string;
    publishDate: string;
    awardAmountWan: number | null;
    purchaser: string | null;
    provinceName: string;
    isLocked: boolean;
  }>;
  tags: string[];
  isPremium: boolean;
  planCode: string;
  lockedPurchasersCount: number;
  lockedTendersCount: number;
  isWatched?: boolean;
}

/**
 * 获取供应商排行榜与检索列表
 */
export async function getTopSuppliers(options: {
  query?: string;
  provinceCode?: string;
  sortBy?: "amount" | "count";
  limit?: number;
}): Promise<SupplierSummary[]> {
  const { query, provinceCode, sortBy = "count", limit = 50 } = options;

  const whereClause: Record<string, unknown> = {
    winningSupplier: { not: null },
  };

  if (query && query.trim()) {
    whereClause.winningSupplier = { contains: query.trim() };
  }

  if (provinceCode && provinceCode.trim()) {
    whereClause.provinceCode = provinceCode.trim();
  }

  const [tenders, regions] = await Promise.all([
    prisma.tender.findMany({
      where: whereClause,
      select: {
        winningSupplier: true,
        awardAmount: true,
        purchaser: true,
        provinceCode: true,
        publishDate: true,
      },
      orderBy: { publishDate: "desc" },
    }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
    }),
  ]);

  const regionMap = new Map(regions.map((r) => [r.code, r.name]));

  // 按供应商聚合
  const aggMap = new Map<
    string,
    {
      winCount: number;
      totalAwardWan: number;
      latestDate: Date;
      firstDate: Date;
      purchasers: Map<string, number>;
      provinces: Set<string>;
    }
  >();

  for (const t of tenders) {
    if (!t.winningSupplier) continue;
    const name = t.winningSupplier.trim();
    if (!name || name.length < 3) continue;

    if (!aggMap.has(name)) {
      aggMap.set(name, {
        winCount: 0,
        totalAwardWan: 0,
        latestDate: t.publishDate,
        firstDate: t.publishDate,
        purchasers: new Map(),
        provinces: new Set(),
      });
    }

    const item = aggMap.get(name)!;
    item.winCount += 1;
    if (t.awardAmount) {
      item.totalAwardWan += Number(t.awardAmount);
    }
    if (t.publishDate > item.latestDate) item.latestDate = t.publishDate;
    if (t.publishDate < item.firstDate) item.firstDate = t.publishDate;

    if (t.purchaser) {
      const p = t.purchaser.trim();
      item.purchasers.set(p, (item.purchasers.get(p) || 0) + 1);
    }
    if (t.provinceCode && regionMap.has(t.provinceCode)) {
      item.provinces.add(regionMap.get(t.provinceCode)!);
    }
  }

  const list: SupplierSummary[] = Array.from(aggMap.entries()).map(([name, stat]) => {
    const totalAward = Math.round(stat.totalAwardWan * 100) / 100;
    const avgAward = stat.winCount > 0 ? Math.round((totalAward / stat.winCount) * 100) / 100 : 0;
    const sortedPurchasers = Array.from(stat.purchasers.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pName]) => pName)
      .slice(0, 3);

    return {
      name,
      winCount: stat.winCount,
      totalAwardWan: totalAward,
      avgAwardWan: avgAward,
      latestDate: stat.latestDate.toISOString().slice(0, 10),
      firstDate: stat.firstDate.toISOString().slice(0, 10),
      mainPurchasers: sortedPurchasers,
      provinces: Array.from(stat.provinces).slice(0, 4),
    };
  });

  if (sortBy === "amount") {
    list.sort((a, b) => b.totalAwardWan - a.totalAwardWan || b.winCount - a.winCount);
  } else {
    list.sort((a, b) => b.winCount - a.winCount || b.totalAwardWan - a.totalAwardWan);
  }

  return list.slice(0, limit);
}

/**
 * 获取特定供应商的 360° 穿透画像
 */
export async function getSupplierProfile(
  supplierName: string,
  isPremium: boolean = false,
  planCode: string = "FREE",
  userId?: number
): Promise<SupplierProfileData | null> {
  const trimmed = supplierName.trim();
  if (!trimmed) return null;

  const [tenders, regions, watches] = await Promise.all([
    prisma.tender.findMany({
      where: { winningSupplier: trimmed },
      select: {
        id: true,
        title: true,
        publishDate: true,
        awardAmount: true,
        budgetAmount: true,
        purchaser: true,
        provinceCode: true,
        type: true,
      },
      orderBy: { publishDate: "desc" },
    }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
    }),
    userId
      ? prisma.pushWatch.findMany({
          where: { userId, keyword: trimmed, enabled: true },
          select: { id: true },
        })
      : [],
  ]);

  if (tenders.length === 0) {
    return null;
  }

  const regionMap = new Map(regions.map((r) => [r.code, r.name]));

  let totalAwardWan = 0;
  let maxAwardWan = 0;
  let minAwardWan = Number.MAX_SAFE_INTEGER;
  let awardEntriesCount = 0;

  const purchaserAgg = new Map<string, { count: number; totalAwardWan: number }>();
  const provinceAgg = new Map<string, { name: string; count: number; totalAwardWan: number }>();

  let earliest = tenders[0].publishDate;
  let latest = tenders[0].publishDate;

  for (const t of tenders) {
    const amt = t.awardAmount ? Number(t.awardAmount) : 0;
    if (amt > 0) {
      totalAwardWan += amt;
      awardEntriesCount++;
      if (amt > maxAwardWan) maxAwardWan = amt;
      if (amt < minAwardWan) minAwardWan = amt;
    }

    if (t.publishDate < earliest) earliest = t.publishDate;
    if (t.publishDate > latest) latest = t.publishDate;

    // 采购买方统计
    const pName = t.purchaser ? t.purchaser.trim() : "未知采购人";
    if (!purchaserAgg.has(pName)) {
      purchaserAgg.set(pName, { count: 0, totalAwardWan: 0 });
    }
    const pItem = purchaserAgg.get(pName)!;
    pItem.count += 1;
    pItem.totalAwardWan += amt;

    // 区域战区统计
    const pCode = t.provinceCode || "OTHER";
    const rName = regionMap.get(pCode) || "全国/其他";
    if (!provinceAgg.has(pCode)) {
      provinceAgg.set(pCode, { name: rName, count: 0, totalAwardWan: 0 });
    }
    const rItem = provinceAgg.get(pCode)!;
    rItem.count += 1;
    rItem.totalAwardWan += amt;
  }

  if (minAwardWan === Number.MAX_SAFE_INTEGER) minAwardWan = 0;
  totalAwardWan = Math.round(totalAwardWan * 100) / 100;
  maxAwardWan = Math.round(maxAwardWan * 100) / 100;
  minAwardWan = Math.round(minAwardWan * 100) / 100;
  const avgAwardWan =
    awardEntriesCount > 0
      ? Math.round((totalAwardWan / awardEntriesCount) * 100) / 100
      : tenders.length > 0
      ? Math.round((totalAwardWan / tenders.length) * 100) / 100
      : 0;

  const activeDaysSpan = Math.max(
    1,
    Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24))
  );

  // 排序省份
  const sortedProvinces = Array.from(provinceAgg.entries())
    .map(([code, item]) => ({
      code,
      name: item.name,
      count: item.count,
      awardWan: Math.round(item.totalAwardWan * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count || b.awardWan - a.awardWan)
    .slice(0, 5);

  // 排序采购买方
  const sortedPurchasers = Array.from(purchaserAgg.entries())
    .map(([purchaser, item]) => ({
      purchaser,
      count: item.count,
      totalAwardWan: Math.round(item.totalAwardWan * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count || b.totalAwardWan - a.totalAwardWan);

  // 智能企业标签构建
  const tags: string[] = [];
  if (totalAwardWan >= 10000) tags.push("亿元级超级标王");
  else if (totalAwardWan >= 1000) tags.push("千万级常驻玩家");
  else if (totalAwardWan >= 100) tags.push("百万级稳健供应商");

  if (sortedProvinces.length >= 3) tags.push("跨省作战能力强");
  else if (sortedProvinces.length === 1) tags.push("区域深耕型企业");

  if (tenders.length >= 3) tags.push("高频中标机构");
  if (tenders.some((t) => t.title.includes("设备") || t.title.includes("仪器") || t.title.includes("硬件"))) {
    tags.push("设备物资专精");
  }
  if (tenders.some((t) => t.title.includes("系统") || t.title.includes("软件") || t.title.includes("平台") || t.title.includes("数字"))) {
    tags.push("数字化/IT服务商");
  }
  if (tenders.some((t) => t.title.includes("大学") || t.title.includes("学院") || t.title.includes("科研") || t.title.includes("研究所"))) {
    tags.push("高校科研圈核心合作方");
  }

  // 脱敏与付费墙处理
  let finalPurchasers = sortedPurchasers.map((p) => ({ ...p, isLocked: false }));
  let finalTenders = tenders.map((t) => ({
    id: t.id,
    title: t.title,
    publishDate: t.publishDate.toISOString().slice(0, 10),
    awardAmountWan: t.awardAmount ? Number(t.awardAmount) : null,
    purchaser: t.purchaser,
    provinceName: t.provinceCode ? regionMap.get(t.provinceCode) || "全国" : "全国",
    isLocked: false,
  }));

  let lockedPurchasersCount = 0;
  let lockedTendersCount = 0;

  if (!isPremium) {
    // 免费版限制：仅展示第 1 位采购买方，其余买方脱敏
    finalPurchasers = sortedPurchasers.map((p, idx) => {
      if (idx === 0) return { ...p, isLocked: false };
      const name = p.purchaser;
      const masked =
        name.length > 4 ? `${name.slice(0, 2)}****${name.slice(-2)}` : `${name.slice(0, 1)}***`;
      return {
        ...p,
        purchaser: masked,
        isLocked: true,
      };
    });
    lockedPurchasersCount = Math.max(0, sortedPurchasers.length - 1);

    // 免费版限制：仅展示前 2 篇中标战绩，其余标讯打码锁定
    finalTenders = tenders.map((t, idx) => {
      if (idx < 2) {
        return {
          id: t.id,
          title: t.title,
          publishDate: t.publishDate.toISOString().slice(0, 10),
          awardAmountWan: t.awardAmount ? Number(t.awardAmount) : null,
          purchaser: t.purchaser,
          provinceName: t.provinceCode ? regionMap.get(t.provinceCode) || "全国" : "全国",
          isLocked: false,
        };
      }
      return {
        id: t.id,
        title: `${t.title.slice(0, 8)}...（升级白金版解锁全量中标战报）`,
        publishDate: t.publishDate.toISOString().slice(0, 7) + "-**",
        awardAmountWan: null,
        purchaser: "******",
        provinceName: "保密",
        isLocked: true,
      };
    });
    lockedTendersCount = Math.max(0, tenders.length - 2);
  }

  return {
    name: trimmed,
    winCount: tenders.length,
    totalAwardWan,
    avgAwardWan,
    maxAwardWan,
    minAwardWan,
    firstWinDate: earliest.toISOString().slice(0, 10),
    latestWinDate: latest.toISOString().slice(0, 10),
    activeDaysSpan,
    provinces: sortedProvinces,
    topPurchasers: finalPurchasers.slice(0, 10),
    recentTenders: finalTenders.slice(0, 20),
    tags,
    isPremium,
    planCode,
    lockedPurchasersCount,
    lockedTendersCount,
    isWatched: watches.length > 0,
  };
}
