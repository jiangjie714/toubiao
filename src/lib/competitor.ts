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

export interface SupplierCompareMetric {
  name: string;
  winCount: number;
  totalAwardWan: number;
  avgAwardWan: number;
  maxAwardWan: number;
  minAwardWan: number;
  latestDate: string;
  firstDate: string;
  provincesCount: number;
  purchasersCount: number;
  tierDistribution: {
    under100: { count: number; amountWan: number };
    between100And500: { count: number; amountWan: number };
    above500: { count: number; amountWan: number };
  };
  topPurchasers: Array<{ name: string; count: number; totalWan: number }>;
  topProvinces: Array<{ name: string; count: number; awardWan: number }>;
}

export interface SharedPurchaserItem {
  purchaser: string;
  totalSharedBids: number;
  details: Record<
    string,
    {
      winCount: number;
      totalAwardWan: number;
      latestDate: string;
    }
  >;
  isLocked: boolean;
}

export interface SupplierComparisonData {
  suppliers: SupplierCompareMetric[];
  sharedPurchasers: SharedPurchaserItem[];
  exclusivePurchasers: Record<
    string,
    Array<{ purchaser: string; winCount: number; totalAwardWan: number }>
  >;
  sharedProvinces: string[];
  exclusiveProvinces: Record<string, string[]>;
  insights: {
    overlapDegree: "HIGH" | "MEDIUM" | "LOW";
    overlapDegreeLabel: string;
    summary: string;
    pricingDivergence: string;
    recommendations: string[];
  };
  isPremium: boolean;
  planCode: string;
  lockedSharedPurchasersCount: number;
}

/**
 * 多供应商/同业竞对多维对标与博弈分析
 */
export async function compareSuppliers(
  supplierNames: string[],
  isPremium: boolean = false,
  planCode: string = "FREE",
): Promise<SupplierComparisonData | null> {
  const cleanNames = Array.from(
    new Set(supplierNames.map((s) => s.trim()).filter(Boolean))
  ).slice(0, 3);

  if (cleanNames.length === 0) return null;

  const [regions, tendersList] = await Promise.all([
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
    }),
    Promise.all(
      cleanNames.map((name) =>
        prisma.tender.findMany({
          where: { winningSupplier: name },
          select: {
            id: true,
            title: true,
            publishDate: true,
            awardAmount: true,
            purchaser: true,
            provinceCode: true,
          },
          orderBy: { publishDate: "desc" },
        })
      )
    ),
  ]);

  const regionMap = new Map(regions.map((r) => [r.code, r.name]));

  // 1. 各企业单体指标计算
  const suppliers: SupplierCompareMetric[] = [];
  const purchaserAgg = new Map<
    string,
    Record<string, { winCount: number; totalAwardWan: number; latestDate: string }>
  >();
  const provinceSupplierMap = new Map<string, Set<string>>();

  cleanNames.forEach((name, idx) => {
    const tenders = tendersList[idx];
    let totalAward = 0;
    let maxAward = 0;
    let minAward = Number.MAX_SAFE_INTEGER;
    const purchaserCountMap = new Map<string, { count: number; totalWan: number }>();
    const provinceCountMap = new Map<string, { count: number; totalWan: number }>();

    const tierDist = {
      under100: { count: 0, amountWan: 0 },
      between100And500: { count: 0, amountWan: 0 },
      above500: { count: 0, amountWan: 0 },
    };

    let firstDate = tenders[0]?.publishDate ?? new Date();
    let latestDate = tenders[0]?.publishDate ?? new Date();

    for (const t of tenders) {
      const award = t.awardAmount ? Number(t.awardAmount) : 0;
      totalAward += award;
      if (award > maxAward) maxAward = award;
      if (award > 0 && award < minAward) minAward = award;

      if (t.publishDate < firstDate) firstDate = t.publishDate;
      if (t.publishDate > latestDate) latestDate = t.publishDate;

      // 金额档位
      if (award < 100) {
        tierDist.under100.count += 1;
        tierDist.under100.amountWan += award;
      } else if (award <= 500) {
        tierDist.between100And500.count += 1;
        tierDist.between100And500.amountWan += award;
      } else {
        tierDist.above500.count += 1;
        tierDist.above500.amountWan += award;
      }

      // 买方统计
      if (t.purchaser) {
        const pName = t.purchaser.trim();
        const pPrev = purchaserCountMap.get(pName) || { count: 0, totalWan: 0 };
        purchaserCountMap.set(pName, {
          count: pPrev.count + 1,
          totalWan: Math.round((pPrev.totalWan + award) * 100) / 100,
        });

        // 跨企业共有买方池
        if (!purchaserAgg.has(pName)) {
          purchaserAgg.set(pName, {});
        }
        const pDetail = purchaserAgg.get(pName)!;
        if (!pDetail[name]) {
          pDetail[name] = {
            winCount: 0,
            totalAwardWan: 0,
            latestDate: t.publishDate.toISOString().slice(0, 10),
          };
        }
        pDetail[name].winCount += 1;
        pDetail[name].totalAwardWan =
          Math.round((pDetail[name].totalAwardWan + award) * 100) / 100;
        if (t.publishDate.toISOString().slice(0, 10) > pDetail[name].latestDate) {
          pDetail[name].latestDate = t.publishDate.toISOString().slice(0, 10);
        }
      }

      // 区域统计
      if (t.provinceCode) {
        const pName = regionMap.get(t.provinceCode) || t.provinceCode;
        const provPrev = provinceCountMap.get(pName) || { count: 0, totalWan: 0 };
        provinceCountMap.set(pName, {
          count: provPrev.count + 1,
          totalWan: Math.round((provPrev.totalWan + award) * 100) / 100,
        });

        if (!provinceSupplierMap.has(pName)) {
          provinceSupplierMap.set(pName, new Set());
        }
        provinceSupplierMap.get(pName)!.add(name);
      }
    }

    const totalAwardWan = Math.round(totalAward * 100) / 100;
    const avgAwardWan =
      tenders.length > 0 ? Math.round((totalAward / tenders.length) * 100) / 100 : 0;

    tierDist.under100.amountWan = Math.round(tierDist.under100.amountWan * 100) / 100;
    tierDist.between100And500.amountWan =
      Math.round(tierDist.between100And500.amountWan * 100) / 100;
    tierDist.above500.amountWan = Math.round(tierDist.above500.amountWan * 100) / 100;

    const topPurchasers = Array.from(purchaserCountMap.entries())
      .sort((a, b) => b[1].count - a[1].count || b[1].totalWan - a[1].totalWan)
      .slice(0, 5)
      .map(([pName, st]) => ({ name: pName, count: st.count, totalWan: st.totalWan }));

    const topProvinces = Array.from(provinceCountMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([pName, st]) => ({ name: pName, count: st.count, awardWan: st.totalWan }));

    suppliers.push({
      name,
      winCount: tenders.length,
      totalAwardWan,
      avgAwardWan,
      maxAwardWan: maxAward > 0 ? Math.round(maxAward * 100) / 100 : 0,
      minAwardWan: minAward < Number.MAX_SAFE_INTEGER ? Math.round(minAward * 100) / 100 : 0,
      latestDate: tenders[0] ? latestDate.toISOString().slice(0, 10) : "-",
      firstDate: tenders[0] ? firstDate.toISOString().slice(0, 10) : "-",
      provincesCount: provinceCountMap.size,
      purchasersCount: purchaserCountMap.size,
      tierDistribution: tierDist,
      topPurchasers,
      topProvinces,
    });
  });

  // 2. 共有买方与独占买方分析
  const allSharedList: SharedPurchaserItem[] = [];
  const exclusivePurchasers: Record<
    string,
    Array<{ purchaser: string; winCount: number; totalAwardWan: number }>
  > = {};

  cleanNames.forEach((n) => {
    exclusivePurchasers[n] = [];
  });

  for (const [pName, details] of purchaserAgg.entries()) {
    const suppliersInPurchaser = Object.keys(details);
    if (suppliersInPurchaser.length >= 2) {
      const totalSharedBids = suppliersInPurchaser.reduce(
        (acc, s) => acc + details[s].winCount,
        0
      );
      allSharedList.push({
        purchaser: pName,
        totalSharedBids,
        details,
        isLocked: false,
      });
    } else if (suppliersInPurchaser.length === 1) {
      const sName = suppliersInPurchaser[0];
      if (exclusivePurchasers[sName]) {
        exclusivePurchasers[sName].push({
          purchaser: pName,
          winCount: details[sName].winCount,
          totalAwardWan: details[sName].totalAwardWan,
        });
      }
    }
  }

  allSharedList.sort((a, b) => b.totalSharedBids - a.totalSharedBids);

  // 对独占客户排序截取 Top 5
  cleanNames.forEach((n) => {
    exclusivePurchasers[n].sort((a, b) => b.totalAwardWan - a.totalAwardWan);
    exclusivePurchasers[n] = exclusivePurchasers[n].slice(0, 5);
  });

  // 权限控制：若非白金/企业版，仅开放 1 家共有买方明细，其余脱敏
  let lockedSharedPurchasersCount = 0;
  const sharedPurchasers = allSharedList.map((item, idx) => {
    if (isPremium || idx === 0) {
      return item;
    }
    lockedSharedPurchasersCount += 1;
    const name = item.purchaser;
    const masked =
      name.length > 4 ? `${name.slice(0, 2)}****${name.slice(-2)}` : `${name.slice(0, 1)}***`;
    return {
      ...item,
      purchaser: masked,
      isLocked: true,
    };
  });

  // 3. 共有与独占省份
  const sharedProvinces: string[] = [];
  const exclusiveProvinces: Record<string, string[]> = {};
  cleanNames.forEach((n) => {
    exclusiveProvinces[n] = [];
  });

  for (const [provName, set] of provinceSupplierMap.entries()) {
    if (set.size >= 2) {
      sharedProvinces.push(provName);
    } else if (set.size === 1) {
      const sName = Array.from(set)[0];
      if (exclusiveProvinces[sName]) {
        exclusiveProvinces[sName].push(provName);
      }
    }
  }

  // 4. 竞争博弈深度洞察推导
  let overlapDegree: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  let overlapDegreeLabel = "错位发展布局";
  if (allSharedList.length >= 3 || (allSharedList.length >= 1 && sharedProvinces.length >= 3)) {
    overlapDegree = "HIGH";
    overlapDegreeLabel = "核心红海激战";
  } else if (allSharedList.length >= 1 || sharedProvinces.length >= 1) {
    overlapDegree = "MEDIUM";
    overlapDegreeLabel = "局部重叠遭遇";
  }

  // 客单价分化分析
  let pricingDivergence = "";
  if (suppliers.length >= 2) {
    const s1 = suppliers[0];
    const s2 = suppliers[1];
    const maxS = s1.avgAwardWan >= s2.avgAwardWan ? s1 : s2;
    const minS = s1.avgAwardWan < s2.avgAwardWan ? s1 : s2;
    const ratio = minS.avgAwardWan > 0 ? (maxS.avgAwardWan / minS.avgAwardWan).toFixed(1) : "多";

    if (minS.avgAwardWan > 0 && maxS.avgAwardWan >= minS.avgAwardWan * 1.8) {
      pricingDivergence = `客单价分化显著：${maxS.name} 平均单笔达 ${maxS.avgAwardWan} 万元（为后者的 ${ratio} 倍），显著倾向承接大型集成与总包标段；而 ${minS.name} 平均客单价为 ${minS.avgAwardWan} 万元，以灵活的中小型标段分散渗透为主。`;
    } else {
      pricingDivergence = `双方项目体量重叠：${s1.name}（${s1.avgAwardWan}万元/标）与 ${s2.name}（${s2.avgAwardWan}万元/标）在单笔标的规模上旗鼓相当，处于同等预算梯队的直接竞争白热化阶段。`;
    }
  }

  const recommendations: string[] = [];
  if (allSharedList.length > 0) {
    const topShared = allSharedList[0];
    recommendations.push(
      `共有客户防守反击：针对共有发包方「${topShared.purchaser}」（双方累计共获 ${topShared.totalSharedBids} 次标讯），竞对在此处渗透深厚，建议在招标前窗口期（采购意向阶段）提前布局技术方案交流，以个性化评分项建立优势。`
    );
  } else {
    recommendations.push(
      `客户群错位突破：双方目前暂无重叠成交买方，显示出明显的各自专属发包朋友圈，可优先将对方主力买方作为增量攻坚标的。`
    );
  }

  if (sharedProvinces.length > 0) {
    recommendations.push(
      `主战场阵地争夺：双方共同覆盖「${sharedProvinces.slice(0, 3).join("、")}」等 ${sharedProvinces.length} 个重点省市，此区域招投标价格竞争烈度高，建议加强属地化联合体运作与快速响应服务。`
    );
  }

  suppliers.forEach((s) => {
    if (s.tierDistribution.above500.count > 0) {
      recommendations.push(
        `${s.name} 具备大型重特大标段投标交付壁垒（500万以上大标占比 ${s.tierDistribution.above500.count} 个），与该企业正面竞争需重点强化联合体履约案例与资金实力背书。`
      );
    }
  });

  const summary = `对比显示双方整体处于【${overlapDegreeLabel}】状态。共有买方 ${allSharedList.length} 家，共覆盖重合省份 ${sharedProvinces.length} 个。${pricingDivergence}`;

  return {
    suppliers,
    sharedPurchasers,
    exclusivePurchasers,
    sharedProvinces,
    exclusiveProvinces,
    insights: {
      overlapDegree,
      overlapDegreeLabel,
      summary,
      pricingDivergence,
      recommendations: recommendations.slice(0, 4),
    },
    isPremium,
    planCode,
    lockedSharedPurchasersCount,
  };
}

