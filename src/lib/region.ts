import { prisma } from "@/lib/prisma";
import { INDUSTRY_META } from "@/lib/industry";

export interface RegionSummary {
  code: string;
  name: string;
  zone: string;
  totalBudgetWan: number;
  totalAwardWan: number;
  tenderCount: number;
  noticeCount: number;
  resultCount: number;
  purchaserCount: number;
  supplierCount: number;
  latestDate: string;
  hotScore: number;
}

export interface RegionDossierData {
  code: string;
  name: string;
  zone: string;
  totalBudgetWan: number;
  totalAwardWan: number;
  avgBudgetWan: number;
  tenderCount: number;
  noticeCount: number;
  resultCount: number;
  purchaserCount: number;
  supplierCount: number;
  savingsRate: number | null;
  // 地市分布
  cities: Array<{
    code: string;
    name: string;
    count: number;
    budgetWan: number;
  }>;
  // 核心发包金主
  topPurchasers: Array<{
    name: string;
    count: number;
    budgetWan: number;
    isLocked: boolean;
  }>;
  // 领衔中标标王
  topSuppliers: Array<{
    name: string;
    count: number;
    awardWan: number;
    isLocked: boolean;
  }>;
  // 主导行业分布
  industries: Array<{
    code: string;
    name: string;
    count: number;
    budgetWan: number;
  }>;
  // 重磅大额标讯雷达 (>=100万)
  featuredTenders: Array<{
    id: number;
    title: string;
    type: string;
    publishDate: string;
    budgetAmountWan: number | null;
    awardAmountWan: number | null;
    purchaser: string | null;
    winningSupplier: string | null;
    isLocked: boolean;
  }>;
  // 实时标讯流 (最近 10 条)
  recentTenders: Array<{
    id: number;
    title: string;
    type: string;
    publishDate: string;
    budgetAmountWan: number | null;
    awardAmountWan: number | null;
    purchaser: string | null;
    winningSupplier: string | null;
    isLocked: boolean;
  }>;
  isPremium: boolean;
  planCode: string;
  lockedPurchasersCount: number;
  lockedSuppliersCount: number;
  isWatched: boolean;
}

export const CHINA_ZONES: Record<string, { name: string; provinceCodes: string[] }> = {
  EAST: {
    name: "华东战区",
    provinceCodes: ["31", "32", "33", "34", "35", "36", "37"],
  },
  NORTH: {
    name: "华北战区",
    provinceCodes: ["11", "12", "13", "14", "15"],
  },
  SOUTH: {
    name: "华南战区",
    provinceCodes: ["44", "45", "46"],
  },
  CENTRAL: {
    name: "华中战区",
    provinceCodes: ["41", "42", "43"],
  },
  SOUTHWEST: {
    name: "西南战区",
    provinceCodes: ["50", "51", "52", "53", "54"],
  },
  NORTHWEST: {
    name: "西北战区",
    provinceCodes: ["61", "62", "63", "64", "65"],
  },
  NORTHEAST: {
    name: "东北战区",
    provinceCodes: ["21", "22", "23"],
  },
};

export function getZoneByProvinceCode(code: string): string {
  for (const zone of Object.values(CHINA_ZONES)) {
    if (zone.provinceCodes.includes(code)) {
      return zone.name;
    }
  }
  return "其他区域";
}

/**
 * 获取全国各省市招投标宏观大盘列表
 */
export async function getRegionList(): Promise<RegionSummary[]> {
  const [provinces, tenders] = await Promise.all([
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.tender.findMany({
      where: { provinceCode: { not: null } },
      select: {
        provinceCode: true,
        type: true,
        budgetAmount: true,
        awardAmount: true,
        purchaser: true,
        winningSupplier: true,
        publishDate: true,
      },
      orderBy: { publishDate: "desc" },
    }),
  ]);

  const aggMap = new Map<
    string,
    {
      totalBudgetWan: number;
      totalAwardWan: number;
      tenderCount: number;
      noticeCount: number;
      resultCount: number;
      purchasers: Set<string>;
      suppliers: Set<string>;
      latestDate: Date | null;
    }
  >();

  for (const t of tenders) {
    if (!t.provinceCode) continue;
    const code = t.provinceCode;

    if (!aggMap.has(code)) {
      aggMap.set(code, {
        totalBudgetWan: 0,
        totalAwardWan: 0,
        tenderCount: 0,
        noticeCount: 0,
        resultCount: 0,
        purchasers: new Set(),
        suppliers: new Set(),
        latestDate: t.publishDate,
      });
    }

    const current = aggMap.get(code)!;
    current.tenderCount += 1;
    if (t.type === "RESULT") {
      current.resultCount += 1;
    } else {
      current.noticeCount += 1;
    }

    if (t.budgetAmount) {
      current.totalBudgetWan += Number(t.budgetAmount);
    }
    if (t.awardAmount) {
      current.totalAwardWan += Number(t.awardAmount);
    }

    if (t.purchaser) {
      current.purchasers.add(t.purchaser.trim());
    }
    if (t.winningSupplier) {
      current.suppliers.add(t.winningSupplier.trim());
    }

    if (!current.latestDate || t.publishDate > current.latestDate) {
      current.latestDate = t.publishDate;
    }
  }

  const list: RegionSummary[] = provinces.map((p) => {
    const data = aggMap.get(p.code);
    const count = data?.tenderCount ?? 0;
    const budget = data?.totalBudgetWan ?? 0;
    const award = data?.totalAwardWan ?? 0;

    // 热度分估算
    const hotScore = Math.min(99, Math.max(50, Math.round(count * 0.8 + budget * 0.0003 + 50)));

    return {
      code: p.code,
      name: p.name,
      zone: getZoneByProvinceCode(p.code),
      totalBudgetWan: Math.round(budget),
      totalAwardWan: Math.round(award),
      tenderCount: count,
      noticeCount: data?.noticeCount ?? 0,
      resultCount: data?.resultCount ?? 0,
      purchaserCount: data?.purchasers.size ?? 0,
      supplierCount: data?.suppliers.size ?? 0,
      latestDate: data?.latestDate ? data.latestDate.toISOString().slice(0, 10) : "-",
      hotScore,
    };
  });

  // 按标讯总数降序，次按预算降序
  list.sort((a, b) => b.tenderCount - a.tenderCount || b.totalBudgetWan - a.totalBudgetWan);

  return list;
}

/**
 * 获取 360° 单省深度招投标大盘与区域作战地图
 */
export async function getRegionDossier(
  code: string,
  user?: { id?: number; role?: string; planCode?: string; teamId?: number | null } | null
): Promise<RegionDossierData | null> {
  const province = await prisma.region.findFirst({
    where: { code, level: 1 },
    select: { code: true, name: true },
  });

  if (!province) return null;

  // 会员判定
  let isPremium = false;
  let planCode = "free";

  if (user) {
    if (user.role === "ADMIN") {
      isPremium = true;
      planCode = "admin";
    } else if (user.planCode && ["PRO", "PLATINUM", "ENTERPRISE"].includes(user.planCode)) {
      isPremium = true;
      planCode = user.planCode.toLowerCase();
    } else if (user.teamId) {
      isPremium = true;
      planCode = "team";
    }
  }

  const [cities, tenders, isWatched] = await Promise.all([
    prisma.region.findMany({
      where: { parentCode: code, level: 2 },
      select: { code: true, name: true },
    }),
    prisma.tender.findMany({
      where: { provinceCode: code },
      select: {
        id: true,
        title: true,
        type: true,
        cityCode: true,
        industryCode: true,
        publishDate: true,
        budgetAmount: true,
        awardAmount: true,
        purchaser: true,
        winningSupplier: true,
      },
      orderBy: { publishDate: "desc" },
    }),
    user?.id
      ? prisma.pushWatch
          .findFirst({
            where: {
              userId: user.id,
              provinceCode: code,
              enabled: true,
            },
            select: { id: true },
          })
          .then((w) => !!w)
      : Promise.resolve(false),
  ]);

  const cityMap = new Map(cities.map((c) => [c.code, c.name]));

  let totalBudget = 0;
  let totalAward = 0;
  let noticeCount = 0;
  let resultCount = 0;

  const purchaserAgg = new Map<string, { count: number; budgetWan: number }>();
  const supplierAgg = new Map<string, { count: number; awardWan: number }>();
  const cityAgg = new Map<string, { count: number; budgetWan: number }>();
  const industryAgg = new Map<string, { count: number; budgetWan: number }>();

  for (const t of tenders) {
    const budget = t.budgetAmount ? Number(t.budgetAmount) : 0;
    const award = t.awardAmount ? Number(t.awardAmount) : 0;
    totalBudget += budget;
    totalAward += award;

    if (t.type === "RESULT") {
      resultCount += 1;
    } else {
      noticeCount += 1;
    }

    // 买方
    if (t.purchaser) {
      const p = t.purchaser.trim();
      const cur = purchaserAgg.get(p) ?? { count: 0, budgetWan: 0 };
      cur.count += 1;
      cur.budgetWan += budget;
      purchaserAgg.set(p, cur);
    }

    // 供应商
    if (t.winningSupplier) {
      const s = t.winningSupplier.trim();
      const cur = supplierAgg.get(s) ?? { count: 0, awardWan: 0 };
      cur.count += 1;
      cur.awardWan += award;
      supplierAgg.set(s, cur);
    }

    // 城市
    if (t.cityCode) {
      const c = t.cityCode;
      const cur = cityAgg.get(c) ?? { count: 0, budgetWan: 0 };
      cur.count += 1;
      cur.budgetWan += budget;
      cityAgg.set(c, cur);
    }

    // 行业
    if (t.industryCode && INDUSTRY_META[t.industryCode]) {
      const ind = t.industryCode;
      const cur = industryAgg.get(ind) ?? { count: 0, budgetWan: 0 };
      cur.count += 1;
      cur.budgetWan += budget;
      industryAgg.set(ind, cur);
    }
  }

  // 节资率
  let savingsRate: number | null = null;
  if (totalBudget > 0 && totalAward > 0 && totalBudget > totalAward) {
    savingsRate = Number((((totalBudget - totalAward) / totalBudget) * 100).toFixed(1));
  }

  // 城市排行
  const sortedCities = Array.from(cityAgg.entries())
    .map(([cCode, val]) => ({
      code: cCode,
      name: cityMap.get(cCode) ?? "省直/其他区县",
      count: val.count,
      budgetWan: Math.round(val.budgetWan),
    }))
    .sort((a, b) => b.budgetWan - a.budgetWan || b.count - a.count);

  // 买方排行
  const sortedPurchasers = Array.from(purchaserAgg.entries())
    .map(([name, val]) => ({
      name,
      count: val.count,
      budgetWan: Math.round(val.budgetWan),
    }))
    .sort((a, b) => b.budgetWan - a.budgetWan || b.count - a.count);

  // 供应商排行
  const sortedSuppliers = Array.from(supplierAgg.entries())
    .map(([name, val]) => ({
      name,
      count: val.count,
      awardWan: Math.round(val.awardWan),
    }))
    .sort((a, b) => b.awardWan - a.awardWan || b.count - a.count);

  // 行业赛道分布
  const sortedIndustries = Array.from(industryAgg.entries())
    .map(([indCode, val]) => ({
      code: indCode,
      name: INDUSTRY_META[indCode]?.name ?? indCode,
      count: val.count,
      budgetWan: Math.round(val.budgetWan),
    }))
    .sort((a, b) => b.budgetWan - a.budgetWan || b.count - a.count);

  // 重点大额商机 (>=100万)
  const featured = tenders
    .filter((t) => t.budgetAmount && Number(t.budgetAmount) >= 100)
    .sort((a, b) => Number(b.budgetAmount) - Number(a.budgetAmount))
    .slice(0, 8);

  // 实时近期标讯 (前 10 条)
  const recent = tenders.slice(0, 10);

  // 脱敏逻辑
  let finalPurchasers = sortedPurchasers.map((p) => ({ ...p, isLocked: false }));
  let finalSuppliers = sortedSuppliers.map((s) => ({ ...s, isLocked: false }));
  let finalFeatured = featured.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    publishDate: t.publishDate.toISOString().slice(0, 10),
    budgetAmountWan: t.budgetAmount ? Number(t.budgetAmount) : null,
    awardAmountWan: t.awardAmount ? Number(t.awardAmount) : null,
    purchaser: t.purchaser,
    winningSupplier: t.winningSupplier,
    isLocked: false,
  }));

  let lockedPurchasersCount = 0;
  let lockedSuppliersCount = 0;

  if (!isPremium) {
    // 免费用户仅公开前 2 家买方，其余脱敏
    finalPurchasers = sortedPurchasers.map((p, idx) => {
      if (idx < 2) return { ...p, isLocked: false };
      const name = p.name;
      const masked =
        name.length > 4 ? `${name.slice(0, 2)}****${name.slice(-2)}` : `${name.slice(0, 1)}***`;
      return {
        ...p,
        name: masked,
        budgetWan: 0,
        isLocked: true,
      };
    });
    lockedPurchasersCount = Math.max(0, sortedPurchasers.length - 2);

    // 免费用户仅公开前 2 家供应商，其余脱敏
    finalSuppliers = sortedSuppliers.map((s, idx) => {
      if (idx < 2) return { ...s, isLocked: false };
      const name = s.name;
      const masked =
        name.length > 4 ? `${name.slice(0, 2)}****${name.slice(-2)}` : `${name.slice(0, 1)}***`;
      return {
        ...s,
        name: masked,
        awardWan: 0,
        isLocked: true,
      };
    });
    lockedSuppliersCount = Math.max(0, sortedSuppliers.length - 2);

    // 重大标讯前 2 条公开，其余脱敏模糊
    finalFeatured = featured.map((t, idx) => {
      if (idx < 2) {
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          publishDate: t.publishDate.toISOString().slice(0, 10),
          budgetAmountWan: t.budgetAmount ? Number(t.budgetAmount) : null,
          awardAmountWan: t.awardAmount ? Number(t.awardAmount) : null,
          purchaser: t.purchaser,
          winningSupplier: t.winningSupplier,
          isLocked: false,
        };
      }
      return {
        id: t.id,
        title: `${t.title.slice(0, 8)}...（升级白金版解锁省内重大标讯）`,
        type: t.type,
        publishDate: t.publishDate.toISOString().slice(0, 7) + "-**",
        budgetAmountWan: null,
        awardAmountWan: null,
        purchaser: "******",
        winningSupplier: "******",
        isLocked: true,
      };
    });
  }

  const finalRecent = recent.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    publishDate: t.publishDate.toISOString().slice(0, 10),
    budgetAmountWan: t.budgetAmount ? Number(t.budgetAmount) : null,
    awardAmountWan: t.awardAmount ? Number(t.awardAmount) : null,
    purchaser: t.purchaser,
    winningSupplier: t.winningSupplier,
    isLocked: false,
  }));

  const avgBudgetWan =
    tenders.length > 0 && totalBudget > 0 ? Math.round(totalBudget / tenders.length) : 0;

  return {
    code,
    name: province.name,
    zone: getZoneByProvinceCode(code),
    totalBudgetWan: Math.round(totalBudget),
    totalAwardWan: Math.round(totalAward),
    avgBudgetWan,
    tenderCount: tenders.length,
    noticeCount,
    resultCount,
    purchaserCount: purchaserAgg.size,
    supplierCount: supplierAgg.size,
    savingsRate,
    cities: sortedCities,
    topPurchasers: finalPurchasers.slice(0, 10),
    topSuppliers: finalSuppliers.slice(0, 10),
    industries: sortedIndustries.slice(0, 6),
    featuredTenders: finalFeatured,
    recentTenders: finalRecent,
    isPremium,
    planCode,
    lockedPurchasersCount,
    lockedSuppliersCount,
    isWatched,
  };
}
