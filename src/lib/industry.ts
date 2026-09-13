import { prisma } from "@/lib/prisma";

export interface IndustrySummary {
  code: string;
  name: string;
  category: string;
  totalBudgetWan: number;
  totalAwardWan: number;
  tenderCount: number;
  purchaserCount: number;
  supplierCount: number;
  latestDate: string;
  tags: string[];
  hotScore: number;
}

export interface IndustryDossierData {
  code: string;
  name: string;
  category: string;
  description: string;
  totalBudgetWan: number;
  totalAwardWan: number;
  avgBudgetWan: number;
  tenderCount: number;
  purchaserCount: number;
  supplierCount: number;
  savingsRate: number | null;
  activeProvinces: Array<{
    code: string;
    name: string;
    count: number;
    budgetWan: number;
  }>;
  topPurchasers: Array<{
    name: string;
    count: number;
    budgetWan: number;
    isLocked: boolean;
  }>;
  topSuppliers: Array<{
    name: string;
    count: number;
    awardWan: number;
    isLocked: boolean;
  }>;
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

export const INDUSTRY_META: Record<
  string,
  { name: string; category: string; description: string; tags: string[] }
> = {
  IT: {
    name: "信息技术与智慧政务",
    category: "数字化与新基建",
    description:
      "聚焦政务云平台、大数据中心、国产信创替代、网络安全网闸、数字政府应用定制与政务信息化系统运维大盘。",
    tags: ["政务云", "大数据", "国产信创", "信息安全", "系统集成"],
  },
  MEDICAL_EQUIPMENT: {
    name: "医疗卫生与健康医药",
    category: "大健康与生物医药",
    description:
      "涵盖公立医院与疾控中心的大型诊疗影像设备(CT/MRI)、紧密型医疗集团耗材试剂集中带量采购、医院数字化HIS与后勤服务。",
    tags: ["医疗设备", "三甲医院", "卫健委", "医用耗材", "智慧医疗"],
  },
  ENGINEERING: {
    name: "工程建设与市政基础设施",
    category: "基建与城市更新",
    description:
      "涵盖市政道路提升、老旧街区美丽改造、给排水管网施工、园林绿化系统修缮及建筑土建装修招标大盘。",
    tags: ["老旧小区改造", "园林维修", "市政道路", "街区提升", "土建装饰"],
  },
  EDUCATION_EQUIPMENT: {
    name: "教育装备与高校科研仪器",
    category: "教育科研",
    description:
      "覆盖高校与科研院所高精尖分析测试实验中心建设、数字化智慧教室多媒体、心理健康辅导站及科研平台招标。",
    tags: ["分析测试中心", "双一流高校", "科研仪器", "智慧校园", "学术平台"],
  },
  OFFICE_SUPPLIES: {
    name: "办公设备与生活物资",
    category: "物资采购",
    description:
      "涵盖党政机关与事业单位的空调机组、办公家具、居家生活用品、通用电子打印耗材批量集中采购。",
    tags: ["空调机组", "办公家具", "集中采购", "通用物资", "生活服务"],
  },
  SECURITY: {
    name: "安防监控与平安应急",
    category: "公共安全",
    description:
      "涵盖平安城市、雪亮工程视频监控网、边界隔离网闸、闸机门禁及消防应急调度系统招标商机。",
    tags: ["视频监控", "边界安全", "雪亮工程", "公安系统", "应急装备"],
  },
  AGRICULTURE: {
    name: "现代农业与乡村振兴",
    category: "农林水利",
    description:
      "汇集高标准现代设施蔬菜大棚建设、新型高素质农民实训培育、高标准农田水利灌溉与乡村振兴专项采购。",
    tags: ["蔬菜大棚", "高素质农民", "乡村振兴", "农田水利", "农业农村局"],
  },
  PROPERTY_SERVICE: {
    name: "后勤保障与综合物业服务",
    category: "现代服务业",
    description:
      "覆盖政府机关后勤保障综合运营、办公大楼安保保洁、机关食堂餐饮与物业托管专项采购。",
    tags: ["后勤保障", "安保保洁", "物业管理", "执法大队", "综合后勤"],
  },
};

/**
 * 获取重点赛道大厅概览列表
 */
export async function getIndustryList(): Promise<IndustrySummary[]> {
  const tenders = await prisma.tender.findMany({
    where: { industryCode: { not: null } },
    select: {
      industryCode: true,
      budgetAmount: true,
      awardAmount: true,
      purchaser: true,
      winningSupplier: true,
      publishDate: true,
    },
    orderBy: { publishDate: "desc" },
  });

  const aggMap = new Map<
    string,
    {
      totalBudgetWan: number;
      totalAwardWan: number;
      tenderCount: number;
      purchasers: Set<string>;
      suppliers: Set<string>;
      latestDate: Date;
    }
  >();

  for (const t of tenders) {
    if (!t.industryCode) continue;
    const code = t.industryCode;

    if (!aggMap.has(code)) {
      aggMap.set(code, {
        totalBudgetWan: 0,
        totalAwardWan: 0,
        tenderCount: 0,
        purchasers: new Set(),
        suppliers: new Set(),
        latestDate: t.publishDate,
      });
    }

    const item = aggMap.get(code)!;
    item.tenderCount += 1;
    if (t.budgetAmount) item.totalBudgetWan += Number(t.budgetAmount);
    if (t.awardAmount) item.totalAwardWan += Number(t.awardAmount);
    if (t.purchaser) item.purchasers.add(t.purchaser.trim());
    if (t.winningSupplier) item.suppliers.add(t.winningSupplier.trim());
    if (t.publishDate > item.latestDate) item.latestDate = t.publishDate;
  }

  const list: IndustrySummary[] = [];

  for (const [code, meta] of Object.entries(INDUSTRY_META)) {
    const data = aggMap.get(code);
    const count = data?.tenderCount ?? 0;
    const budget = data?.totalBudgetWan ?? 0;
    const award = data?.totalAwardWan ?? 0;

    // 热度评分公式：综合公告量与预算规模 (最高 99 分)
    const score = Math.min(99, Math.max(50, Math.round(count * 0.5 + budget * 0.0005 + 40)));

    list.push({
      code,
      name: meta.name,
      category: meta.category,
      totalBudgetWan: Math.round(budget),
      totalAwardWan: Math.round(award),
      tenderCount: count,
      purchaserCount: data?.purchasers.size ?? 0,
      supplierCount: data?.suppliers.size ?? 0,
      latestDate: data?.latestDate ? data.latestDate.toISOString().slice(0, 10) : "-",
      tags: meta.tags,
      hotScore: score,
    });
  }

  // 按预算规模由高到低排序
  list.sort((a, b) => b.totalBudgetWan - a.totalBudgetWan);

  return list;
}

/**
 * 获取 360° 单赛道深度情报大盘
 */
export async function getIndustryDossier(
  code: string,
  user?: { id?: number; role?: string; planCode?: string; teamId?: number | null } | null
): Promise<IndustryDossierData | null> {
  const meta = INDUSTRY_META[code];
  if (!meta) return null;

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

  const [tenders, regions] = await Promise.all([
    prisma.tender.findMany({
      where: { industryCode: code },
      select: {
        id: true,
        title: true,
        type: true,
        provinceCode: true,
        publishDate: true,
        budgetAmount: true,
        awardAmount: true,
        purchaser: true,
        winningSupplier: true,
      },
      orderBy: { publishDate: "desc" },
    }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
    }),
  ]);

  const regionMap = new Map(regions.map((r) => [r.code, r.name]));

  let totalBudget = 0;
  let totalAward = 0;
  const purchaserAgg = new Map<string, { count: number; budgetWan: number }>();
  const supplierAgg = new Map<string, { count: number; awardWan: number }>();
  const provinceAgg = new Map<string, { count: number; budgetWan: number }>();

  for (const t of tenders) {
    const budget = t.budgetAmount ? Number(t.budgetAmount) : 0;
    const award = t.awardAmount ? Number(t.awardAmount) : 0;
    totalBudget += budget;
    totalAward += award;

    // 买方
    if (t.purchaser) {
      const p = t.purchaser.trim();
      const current = purchaserAgg.get(p) ?? { count: 0, budgetWan: 0 };
      current.count += 1;
      current.budgetWan += budget;
      purchaserAgg.set(p, current);
    }

    // 供应商
    if (t.winningSupplier) {
      const s = t.winningSupplier.trim();
      const current = supplierAgg.get(s) ?? { count: 0, awardWan: 0 };
      current.count += 1;
      current.awardWan += award;
      supplierAgg.set(s, current);
    }

    // 区域
    if (t.provinceCode) {
      const pCode = t.provinceCode;
      const current = provinceAgg.get(pCode) ?? { count: 0, budgetWan: 0 };
      current.count += 1;
      current.budgetWan += budget;
      provinceAgg.set(pCode, current);
    }
  }

  // 节资率
  let savingsRate: number | null = null;
  if (totalBudget > 0 && totalAward > 0 && totalBudget > totalAward) {
    savingsRate = Number((((totalBudget - totalAward) / totalBudget) * 100).toFixed(1));
  }

  // 排序活跃省份
  const activeProvinces = Array.from(provinceAgg.entries())
    .map(([pCode, val]) => ({
      code: pCode,
      name: regionMap.get(pCode) ?? pCode,
      count: val.count,
      budgetWan: Math.round(val.budgetWan),
    }))
    .sort((a, b) => b.budgetWan - a.budgetWan)
    .slice(0, 6);

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

  // 重点重大商机（按预算倒序，预算 >= 100 万元）
  const featured = tenders
    .filter((t) => t.budgetAmount && Number(t.budgetAmount) >= 100)
    .sort((a, b) => Number(b.budgetAmount) - Number(a.budgetAmount))
    .slice(0, 8);

  // 脱敏处理
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

    // 重大标讯前 2 条公开
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
        title: `${t.title.slice(0, 8)}...（升级白金版解锁行业重大标讯）`,
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

  // 检查是否已关注该赛道
  let isWatched = false;
  if (user?.id) {
    const watch = await prisma.pushWatch.findFirst({
      where: {
        userId: user.id,
        keyword: meta.name.slice(0, 10),
        enabled: true,
      },
    });
    isWatched = !!watch;
  }

  const recentTenders = tenders.slice(0, 15).map((t) => ({
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
    tenders.length > 0 ? Math.round(totalBudget / tenders.length) : 0;

  return {
    code,
    name: meta.name,
    category: meta.category,
    description: meta.description,
    totalBudgetWan: Math.round(totalBudget),
    totalAwardWan: Math.round(totalAward),
    avgBudgetWan,
    tenderCount: tenders.length,
    purchaserCount: purchaserAgg.size,
    supplierCount: supplierAgg.size,
    savingsRate,
    activeProvinces,
    topPurchasers: finalPurchasers.slice(0, 10),
    topSuppliers: finalSuppliers.slice(0, 10),
    featuredTenders: finalFeatured,
    recentTenders,
    isPremium,
    planCode,
    lockedPurchasersCount,
    lockedSuppliersCount,
    isWatched,
  };
}
