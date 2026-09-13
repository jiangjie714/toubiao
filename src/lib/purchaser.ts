import { prisma } from "@/lib/prisma";

export interface PurchaserSummary {
  name: string;
  noticeCount: number;
  totalBudgetWan: number;
  totalAwardWan: number;
  latestDate: string;
  firstDate: string;
  topSuppliers: string[];
  provinces: string[];
}

export interface PurchaserProfileData {
  name: string;
  noticeCount: number;
  noticeTenderCount: number;
  noticeResultCount: number;
  totalBudgetWan: number;
  totalAwardWan: number;
  avgBudgetWan: number;
  savingsRate: number | null;
  firstDate: string;
  latestDate: string;
  activeDaysSpan: number;
  preferredSuppliers: Array<{
    name: string;
    count: number;
    awardWan: number;
    isLocked: boolean;
  }>;
  preferredAgencies: Array<{
    name: string;
    count: number;
  }>;
  contacts: Array<{
    id: number;
    role: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isLocked: boolean;
  }>;
  recentTenders: Array<{
    id: number;
    title: string;
    type: string;
    publishDate: string;
    budgetAmountWan: number | null;
    awardAmountWan: number | null;
    winningSupplier: string | null;
    isLocked: boolean;
  }>;
  tags: string[];
  isPremium: boolean;
  planCode: string;
  lockedSuppliersCount: number;
  lockedTendersCount: number;
  isWatched?: boolean;
}

/**
 * 获取采购买方机构百强榜与检索列表
 */
export async function getTopPurchasers(options: {
  query?: string;
  provinceCode?: string;
  sortBy?: "budget" | "count";
  limit?: number;
}): Promise<PurchaserSummary[]> {
  const { query, provinceCode, sortBy = "count", limit = 50 } = options;

  const whereClause: Record<string, unknown> = {
    purchaser: { not: null },
  };

  if (query && query.trim()) {
    whereClause.purchaser = { contains: query.trim() };
  }

  if (provinceCode && provinceCode.trim()) {
    whereClause.provinceCode = provinceCode.trim();
  }

  const [tenders, regions] = await Promise.all([
    prisma.tender.findMany({
      where: whereClause,
      select: {
        purchaser: true,
        budgetAmount: true,
        awardAmount: true,
        winningSupplier: true,
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

  // 按采购人聚合
  const aggMap = new Map<
    string,
    {
      count: number;
      totalBudgetWan: number;
      totalAwardWan: number;
      latestDate: Date;
      firstDate: Date;
      suppliers: Map<string, number>;
      provinces: Set<string>;
    }
  >();

  for (const t of tenders) {
    if (!t.purchaser) continue;
    const name = t.purchaser.trim();
    if (!name || name.length < 2) continue;

    if (!aggMap.has(name)) {
      aggMap.set(name, {
        count: 0,
        totalBudgetWan: 0,
        totalAwardWan: 0,
        latestDate: t.publishDate,
        firstDate: t.publishDate,
        suppliers: new Map(),
        provinces: new Set(),
      });
    }

    const item = aggMap.get(name)!;
    item.count += 1;
    if (t.budgetAmount) {
      item.totalBudgetWan += Number(t.budgetAmount);
    }
    if (t.awardAmount) {
      item.totalAwardWan += Number(t.awardAmount);
    }
    if (t.publishDate > item.latestDate) item.latestDate = t.publishDate;
    if (t.publishDate < item.firstDate) item.firstDate = t.publishDate;

    if (t.winningSupplier) {
      const s = t.winningSupplier.trim();
      item.suppliers.set(s, (item.suppliers.get(s) || 0) + 1);
    }
    if (t.provinceCode && regionMap.has(t.provinceCode)) {
      item.provinces.add(regionMap.get(t.provinceCode)!);
    }
  }

  const list: PurchaserSummary[] = Array.from(aggMap.entries()).map(([name, stat]) => {
    const totalBudget = Math.round(stat.totalBudgetWan * 100) / 100;
    const totalAward = Math.round(stat.totalAwardWan * 100) / 100;
    const sortedSuppliers = Array.from(stat.suppliers.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sName]) => sName)
      .slice(0, 3);

    return {
      name,
      noticeCount: stat.count,
      totalBudgetWan: totalBudget,
      totalAwardWan: totalAward,
      latestDate: stat.latestDate.toISOString().slice(0, 10),
      firstDate: stat.firstDate.toISOString().slice(0, 10),
      topSuppliers: sortedSuppliers,
      provinces: Array.from(stat.provinces).slice(0, 3),
    };
  });

  if (sortBy === "budget") {
    list.sort((a, b) => b.totalBudgetWan - a.totalBudgetWan || b.noticeCount - a.noticeCount);
  } else {
    list.sort((a, b) => b.noticeCount - a.noticeCount || b.totalBudgetWan - a.totalBudgetWan);
  }

  return list.slice(0, limit);
}

/**
 * 获取特定采购买方机构的 360° 发包全景穿透档案
 */
export async function getPurchaserProfile(
  purchaserName: string,
  isPremium: boolean = false,
  planCode: string = "FREE",
  userId?: number
): Promise<PurchaserProfileData | null> {
  const trimmed = purchaserName.trim();
  if (!trimmed) return null;

  const [tenders, orgContacts, watches] = await Promise.all([
    prisma.tender.findMany({
      where: { purchaser: trimmed },
      select: {
        id: true,
        title: true,
        type: true,
        publishDate: true,
        budgetAmount: true,
        awardAmount: true,
        agency: true,
        winningSupplier: true,
        provinceCode: true,
      },
      orderBy: { publishDate: "desc" },
    }),
    prisma.orgContact.findMany({
      where: { orgName: trimmed },
      select: {
        id: true,
        role: true,
        phone: true,
        email: true,
        address: true,
      },
      orderBy: { id: "asc" },
      take: 5,
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

  let totalBudgetWan = 0;
  let totalAwardWan = 0;
  let noticeTenderCount = 0;
  let noticeResultCount = 0;
  let budgetEntriesCount = 0;

  const supplierAgg = new Map<string, { count: number; totalAwardWan: number }>();
  const agencyAgg = new Map<string, number>();

  let earliest = tenders[0].publishDate;
  let latest = tenders[0].publishDate;

  for (const t of tenders) {
    if (t.type === "NOTICE") noticeTenderCount++;
    if (t.type === "RESULT") noticeResultCount++;

    const bAmt = t.budgetAmount ? Number(t.budgetAmount) : 0;
    if (bAmt > 0) {
      totalBudgetWan += bAmt;
      budgetEntriesCount++;
    }

    const aAmt = t.awardAmount ? Number(t.awardAmount) : 0;
    if (aAmt > 0) {
      totalAwardWan += aAmt;
    }

    if (t.publishDate < earliest) earliest = t.publishDate;
    if (t.publishDate > latest) latest = t.publishDate;

    // 合作供应商统计
    if (t.winningSupplier && t.winningSupplier.trim().length > 2) {
      const sName = t.winningSupplier.trim();
      if (!supplierAgg.has(sName)) {
        supplierAgg.set(sName, { count: 0, totalAwardWan: 0 });
      }
      const sItem = supplierAgg.get(sName)!;
      sItem.count += 1;
      sItem.totalAwardWan += aAmt;
    }

    // 招标代理机构统计
    if (t.agency && t.agency.trim().length > 2) {
      const aName = t.agency.trim();
      agencyAgg.set(aName, (agencyAgg.get(aName) || 0) + 1);
    }
  }

  totalBudgetWan = Math.round(totalBudgetWan * 100) / 100;
  totalAwardWan = Math.round(totalAwardWan * 100) / 100;
  const avgBudgetWan =
    budgetEntriesCount > 0
      ? Math.round((totalBudgetWan / budgetEntriesCount) * 100) / 100
      : tenders.length > 0
      ? Math.round((totalBudgetWan / tenders.length) * 100) / 100
      : 0;

  // 节资率计算
  let savingsRate: number | null = null;
  if (totalBudgetWan > 0 && totalAwardWan > 0 && totalBudgetWan >= totalAwardWan) {
    savingsRate = Math.round(((totalBudgetWan - totalAwardWan) / totalBudgetWan) * 10000) / 100;
  }

  const activeDaysSpan = Math.max(
    1,
    Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24))
  );

  // 排序首选供应商
  const sortedSuppliers = Array.from(supplierAgg.entries())
    .map(([sName, item]) => ({
      name: sName,
      count: item.count,
      awardWan: Math.round(item.totalAwardWan * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count || b.awardWan - a.awardWan);

  // 排序首选代理机构
  const sortedAgencies = Array.from(agencyAgg.entries())
    .map(([aName, count]) => ({
      name: aName,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 智能企业标签
  const tags: string[] = [];
  if (totalBudgetWan >= 10000 || totalAwardWan >= 10000) tags.push("亿元级发包金主");
  else if (totalBudgetWan >= 1000 || totalAwardWan >= 1000) tags.push("千万级优质业主");
  else if (totalBudgetWan >= 100) tags.push("百万级稳健采购人");

  if (tenders.length >= 5) tags.push("超高频发包机构");
  else if (tenders.length >= 3) tags.push("常规采购业主");

  if (trimmed.includes("大学") || trimmed.includes("学院") || trimmed.includes("学校")) {
    tags.push("高校科研教育直采");
  } else if (trimmed.includes("医院") || trimmed.includes("妇幼") || trimmed.includes("急救")) {
    tags.push("医疗卫生核心甲方");
  } else if (trimmed.includes("局") || trimmed.includes("委员会") || trimmed.includes("中心") || trimmed.includes("总队") || trimmed.includes("支队")) {
    tags.push("政法党政机关单位");
  }

  // 脱敏与付费墙处理
  let finalSuppliers = sortedSuppliers.map((s) => ({ ...s, isLocked: false }));
  let finalContacts = orgContacts.map((c) => ({ ...c, isLocked: false }));
  let finalTenders = tenders.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    publishDate: t.publishDate.toISOString().slice(0, 10),
    budgetAmountWan: t.budgetAmount ? Number(t.budgetAmount) : null,
    awardAmountWan: t.awardAmount ? Number(t.awardAmount) : null,
    winningSupplier: t.winningSupplier,
    isLocked: false,
  }));

  let lockedSuppliersCount = 0;
  let lockedTendersCount = 0;

  if (!isPremium) {
    // 免费版限制：供应商前 1 家公开，其余脱敏
    finalSuppliers = sortedSuppliers.map((s, idx) => {
      if (idx === 0) return { ...s, isLocked: false };
      const name = s.name;
      const masked =
        name.length > 4 ? `${name.slice(0, 2)}****${name.slice(-2)}` : `${name.slice(0, 1)}***`;
      return {
        ...s,
        name: masked,
        isLocked: true,
      };
    });
    lockedSuppliersCount = Math.max(0, sortedSuppliers.length - 1);

    // 免费版限制：联系人电话和邮箱打码
    finalContacts = orgContacts.map((c) => {
      let maskedPhone = c.phone;
      if (c.phone) {
        maskedPhone =
          c.phone.length > 7
            ? `${c.phone.slice(0, 3)}****${c.phone.slice(-3)}`
            : "******";
      }
      return {
        ...c,
        phone: maskedPhone,
        email: c.email ? "******@***.com" : null,
        isLocked: true,
      };
    });

    // 免费版限制：历史标讯前 2 条公开，其余锁定
    finalTenders = tenders.map((t, idx) => {
      if (idx < 2) {
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          publishDate: t.publishDate.toISOString().slice(0, 10),
          budgetAmountWan: t.budgetAmount ? Number(t.budgetAmount) : null,
          awardAmountWan: t.awardAmount ? Number(t.awardAmount) : null,
          winningSupplier: t.winningSupplier,
          isLocked: false,
        };
      }
      return {
        id: t.id,
        title: `${t.title.slice(0, 8)}...（升级白金版查看该买方历史全量发包）`,
        type: t.type,
        publishDate: t.publishDate.toISOString().slice(0, 7) + "-**",
        budgetAmountWan: null,
        awardAmountWan: null,
        winningSupplier: "******",
        isLocked: true,
      };
    });
    lockedTendersCount = Math.max(0, tenders.length - 2);
  }

  return {
    name: trimmed,
    noticeCount: tenders.length,
    noticeTenderCount,
    noticeResultCount,
    totalBudgetWan,
    totalAwardWan,
    avgBudgetWan,
    savingsRate,
    firstDate: earliest.toISOString().slice(0, 10),
    latestDate: latest.toISOString().slice(0, 10),
    activeDaysSpan,
    preferredSuppliers: finalSuppliers.slice(0, 10),
    preferredAgencies: sortedAgencies,
    contacts: finalContacts,
    recentTenders: finalTenders.slice(0, 20),
    tags,
    isPremium,
    planCode,
    lockedSuppliersCount,
    lockedTendersCount,
    isWatched: watches.length > 0,
  };
}
