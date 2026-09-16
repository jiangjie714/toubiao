/**
 * 历史标讯大数据穿透分析与价格下浮率罗盘引擎
 * 对标千里马历史数据库，提供多维跨期下浮率、采购人集中度 (CR3/CR5) 与竞标博弈透视
 */

import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export interface DiscountRangeBucket {
  rangeLabel: string;
  minRate: number;
  maxRate: number;
  count: number;
  percentage: number;
  description: string;
}

export interface PurchaserConcentrationItem {
  purchaser: string;
  totalProjects: number;
  totalAwardWan: number;
  cr3Rate: number; // Top 3 供应商金额集中度 (0 - 100%)
  cr5Rate: number; // Top 5 供应商金额集中度 (0 - 100%)
  monopolyType: "OPEN" | "BALANCED" | "HIGHLY_CONCENTRATED";
  monopolyLabel: string;
  topSuppliers: Array<{
    supplier: string;
    awardWan: number;
    shareRate: number;
  }>;
}

export interface HistoricalTransactionRecord {
  id: number;
  title: string;
  purchaser: string | null;
  winningSupplier: string | null;
  budgetAmountWan: number | null;
  awardAmountWan: number | null;
  discountRate: number | null; // 让利下浮率 (%)
  industryCode: string | null;
  publishDate: string;
  provinceCode: string | null;
}

export interface HistoricalBenchmarkResult {
  stats: {
    totalAnalyzedTenders: number;
    validPricingSamplesCount: number;
    avgDiscountRate: number; // 平均下浮率 (%)
    medianDiscountRate: number; // 下浮率中位数 (%)
    totalAwardWan: number;
    avgCr3Rate: number; // 全行业平均 CR3 集中度 (%)
  };
  discountDistribution: DiscountRangeBucket[];
  pricingAdvice: {
    recommendedMinRate: number;
    recommendedMaxRate: number;
    rationalStrategyAdvice: string;
  };
  topPurchasersConcentration: PurchaserConcentrationItem[];
  recentClassicTransactions: HistoricalTransactionRecord[];
}

export interface HistoricalQueryFilters {
  industryCode?: string;
  provinceCode?: string;
  year?: string;
  q?: string;
}

/**
 * 核心穿透分析主函数
 */
export async function getHistoricalBenchmarkData(
  filters: HistoricalQueryFilters = {}
): Promise<HistoricalBenchmarkResult> {
  const where: Prisma.TenderWhereInput = {};

  if (filters.industryCode) {
    where.industryCode = filters.industryCode;
  }
  if (filters.provinceCode) {
    where.provinceCode = filters.provinceCode;
  }
  if (filters.q) {
    where.title = { contains: filters.q, mode: "insensitive" };
  }
  if (filters.year && filters.year !== "ALL") {
    const y = parseInt(filters.year, 10);
    if (!isNaN(y)) {
      where.publishDate = {
        gte: new Date(`${y}-01-01T00:00:00.000Z`),
        lte: new Date(`${y}-12-31T23:59:59.999Z`),
      };
    }
  }

  // 1. 获取符合条件的所有样本，显式投影排除大文本字段
  const tenders = await prisma.tender.findMany({
    where,
    select: {
      id: true,
      title: true,
      purchaser: true,
      winningSupplier: true,
      budgetAmount: true,
      awardAmount: true,
      industryCode: true,
      publishDate: true,
      provinceCode: true,
    },
    orderBy: { publishDate: "desc" },
    take: 5000, // 限制单次大数据分析样本池上限
  });

  const totalAnalyzed = tenders.length;

  // 2. 筛选有效价格样本并计算下浮率: (budget - award) / budget * 100%
  const validPriceItems: Array<{
    tender: (typeof tenders)[0];
    budgetWan: number;
    awardWan: number;
    discountRate: number;
  }> = [];

  let totalAwardWan = 0;

  for (const t of tenders) {
    const budget = t.budgetAmount ? Number(t.budgetAmount) : null;
    const award = t.awardAmount ? Number(t.awardAmount) : null;

    if (award !== null && award > 0) {
      totalAwardWan += award;
    }

    if (budget !== null && budget > 0 && award !== null && award > 0) {
      // 避免除以 0 或离谱异常值
      const rate = ((budget - award) / budget) * 100;
      // 过滤掉极其不合理的负数或超大下浮（保留 -10% 到 85% 区间）
      if (rate >= -10 && rate <= 85) {
        validPriceItems.push({
          tender: t,
          budgetWan: budget,
          awardWan: award,
          discountRate: Math.round(rate * 10) / 10,
        });
      }
    }
  }

  // 3. 计算下浮率分布桶 (5个梯度)
  const bucketsDef: Array<{
    label: string;
    min: number;
    max: number;
    desc: string;
  }> = [
    { label: "0% 以下 (溢价/追加)", min: -100, max: 0, desc: "多见于特殊应急追加或单项工期压缩" },
    { label: "0% ~ 5% (高位坚挺)", min: 0, max: 5, desc: "标准合规让利，竞争温和或技术壁垒高" },
    { label: "5% ~ 10% (理性博弈)", min: 5, max: 10, desc: "主流成交区间，兼顾利润与价格得分" },
    { label: "10% ~ 20% (充分竞争)", min: 10, max: 20, desc: "多家厂商血拼，需依靠规模化成本控制" },
    { label: "20% 以上 (深度下浮)", min: 20, max: 100, desc: "可能存在战略抢标或低价恶性竞争" },
  ];

  const bucketCounts = bucketsDef.map(() => 0);
  const sampleCount = validPriceItems.length;

  validPriceItems.forEach((item) => {
    const r = item.discountRate;
    for (let i = 0; i < bucketsDef.length; i++) {
      if (r >= bucketsDef[i].min && (i === bucketsDef.length - 1 ? r <= bucketsDef[i].max : r < bucketsDef[i].max)) {
        bucketCounts[i]++;
        break;
      }
    }
  });

  const discountDistribution: DiscountRangeBucket[] = bucketsDef.map((def, idx) => {
    const count = bucketCounts[idx];
    const pct = sampleCount > 0 ? Math.round((count / sampleCount) * 1000) / 10 : 0;
    return {
      rangeLabel: def.label,
      minRate: def.min,
      maxRate: def.max,
      count,
      percentage: pct,
      description: def.desc,
    };
  });

  // 计算均值与中位数
  let avgDiscountRate = 0;
  let medianDiscountRate = 0;

  if (sampleCount > 0) {
    const sortedRates = validPriceItems.map((i) => i.discountRate).sort((a, b) => a - b);
    const sum = sortedRates.reduce((acc, curr) => acc + curr, 0);
    avgDiscountRate = Math.round((sum / sampleCount) * 10) / 10;
    medianDiscountRate = sortedRates[Math.floor(sampleCount / 2)];
  }

  // 推荐报价区间建议
  const recommendedMinRate = Math.max(0, Math.round((avgDiscountRate - 2.5) * 10) / 10);
  const recommendedMaxRate = Math.round((avgDiscountRate + 3.5) * 10) / 10;
  const rationalStrategyAdvice =
    avgDiscountRate > 0
      ? `基于所选样本的历史成交穿透，该赛道平均下浮率为 ${avgDiscountRate}%（中位数 ${medianDiscountRate}%）。建议投标报价下浮区间定在 [${recommendedMinRate}% ~ ${recommendedMaxRate}%]，既可避免被评标委员会判定为低于成本恶意竞争，又能获取稳健的价格分。`
      : "当前筛选条件下的有效比价样本较少，建议参考行业基准 5%~8% 的常规让利幅度进行审慎报价。";

  // 4. 采购人供应商集中度与垄断穿透 (CR3 / CR5)
  // 聚合采购人与其供应商关系
  const purchaserMap = new Map<
    string,
    {
      totalProjects: number;
      totalAwardWan: number;
      supplierAwards: Map<string, number>;
    }
  >();

  for (const t of tenders) {
    if (!t.purchaser || !t.winningSupplier) continue;
    const pName = t.purchaser.trim();
    const sName = t.winningSupplier.trim();
    const amountVal = t.awardAmount ? Number(t.awardAmount) : (t.budgetAmount ? Number(t.budgetAmount) : 0);
    const amount = Number(amountVal) || 0;

    let pEntry = purchaserMap.get(pName);
    if (!pEntry) {
      pEntry = {
        totalProjects: 0,
        totalAwardWan: 0,
        supplierAwards: new Map<string, number>(),
      };
      purchaserMap.set(pName, pEntry);
    }

    pEntry.totalProjects++;
    pEntry.totalAwardWan += amount;
    const currentSupplierAmount = pEntry.supplierAwards.get(sName) || 0;
    pEntry.supplierAwards.set(sName, currentSupplierAmount + amount);
  }

  // 计算每个采购人的 CR3 与 CR5
  const purchaserItems: PurchaserConcentrationItem[] = [];
  let cr3Sum = 0;
  let cr3Count = 0;

  for (const [purchaser, pData] of purchaserMap.entries()) {
    // 仅分析发包项目 >= 2 个的采购人
    if (pData.totalProjects < 2) continue;

    const sortedSuppliers = Array.from(pData.supplierAwards.entries())
      .map(([supplier, awardWan]) => ({
        supplier,
        awardWan: Math.round(awardWan * 10) / 10,
        shareRate:
          pData.totalAwardWan > 0
            ? Math.round((awardWan / pData.totalAwardWan) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.awardWan - a.awardWan);

    const cr3 = sortedSuppliers.slice(0, 3).reduce((acc, s) => acc + s.shareRate, 0);
    const cr5 = sortedSuppliers.slice(0, 5).reduce((acc, s) => acc + s.shareRate, 0);
    const roundedCr3 = Math.min(100, Math.round(cr3 * 10) / 10);
    const roundedCr5 = Math.min(100, Math.round(cr5 * 10) / 10);

    let monopolyType: "OPEN" | "BALANCED" | "HIGHLY_CONCENTRATED" = "BALANCED";
    let monopolyLabel = "均衡竞标型 (CR3 40%~70%)";
    if (roundedCr3 < 40) {
      monopolyType = "OPEN";
      monopolyLabel = "充分开放型 (CR3 < 40%)";
    } else if (roundedCr3 >= 70) {
      monopolyType = "HIGHLY_CONCENTRATED";
      monopolyLabel = "头部垄断型 (CR3 ≥ 70%)";
    }

    cr3Sum += roundedCr3;
    cr3Count++;

    purchaserItems.push({
      purchaser,
      totalProjects: pData.totalProjects,
      totalAwardWan: Math.round(pData.totalAwardWan * 10) / 10,
      cr3Rate: roundedCr3,
      cr5Rate: roundedCr5,
      monopolyType,
      monopolyLabel,
      topSuppliers: sortedSuppliers.slice(0, 3),
    });
  }

  purchaserItems.sort((a, b) => b.totalAwardWan - a.totalAwardWan);

  const avgCr3Rate = cr3Count > 0 ? Math.round((cr3Sum / cr3Count) * 10) / 10 : 50;

  // 5. 经典成交案例列表
  const recentClassicTransactions: HistoricalTransactionRecord[] = validPriceItems
    .slice(0, 20)
    .map(({ tender, budgetWan, awardWan, discountRate }) => ({
      id: tender.id,
      title: tender.title,
      purchaser: tender.purchaser,
      winningSupplier: tender.winningSupplier,
      budgetAmountWan: budgetWan,
      awardAmountWan: awardWan,
      discountRate,
      industryCode: tender.industryCode,
      publishDate: tender.publishDate.toISOString().slice(0, 10),
      provinceCode: tender.provinceCode,
    }));

  return {
    stats: {
      totalAnalyzedTenders: totalAnalyzed,
      validPricingSamplesCount: sampleCount,
      avgDiscountRate,
      medianDiscountRate,
      totalAwardWan: Math.round(totalAwardWan * 10) / 10,
      avgCr3Rate,
    },
    discountDistribution,
    pricingAdvice: {
      recommendedMinRate,
      recommendedMaxRate,
      rationalStrategyAdvice,
    },
    topPurchasersConcentration: purchaserItems.slice(0, 10),
    recentClassicTransactions,
  };
}
