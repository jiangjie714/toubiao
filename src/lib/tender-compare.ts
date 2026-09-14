import { prisma } from "@/lib/prisma";
import { calculateDeadlineCountdown, type DeadlineCountdown } from "@/lib/lifecycle-alert";
import { analyzeWithHeuristics } from "@/lib/ai/bid-reader";
import { INDUSTRY_META } from "@/lib/industry";

export interface TenderComparePurchaserInsight {
  name: string;
  totalNotices: number;
  totalBudgetWan: number;
  avgBudgetWan: number;
  topSupplier?: { name: string; count: number } | null;
  supplierConcentrationRate?: number; // 首选供应商占比 %
}

export interface TenderCompareScoringInfo {
  methodType: string;
  weights: {
    price: number;
    technical: number;
    business: number;
  };
  keyPoints: string[];
}

export interface TenderDecisionScores {
  budgetAttractiveness: number; // 1 - 5 星
  preparationMargin: number; // 1 - 5 星
  purchaserOpenness: number; // 1 - 5 星（首选集中度越低越高）
  overallRecommendScore: number; // 0 - 100 分
  recommendLevel: "MUST_TARGET" | "CONSIDER" | "LOW_PRIORITY"; // 重点主攻 | 择机参与 | 审慎弃标
  recommendReason: string;
}

export interface TenderCompareItem {
  id: number;
  title: string;
  type: string;
  provinceCode: string | null;
  provinceName?: string | null;
  cityCode: string | null;
  cityName?: string | null;
  publishDate: string;
  expireDate: string | null;
  budgetAmount: number | null;
  projectNo: string | null;
  purchaser: string | null;
  agency: string | null;
  industryCode: string | null;
  industryName?: string | null;
  attachmentsCount: number;
  projectId: number | null;
  projectNoticeCount: number;
  deadlineCountdown?: DeadlineCountdown | null;
  purchaserInsight?: TenderComparePurchaserInsight | null;
  scoring?: TenderCompareScoringInfo | null;
  disqualifiedItems: Array<{ clause: string; level: string; explanation: string }>;
  decisionScores: TenderDecisionScores;
}

export interface TenderCompareResult {
  tenders: TenderCompareItem[];
  isLocked: boolean;
  maxAllowed: number;
  planName: string;
  comparativeSummary?: {
    highestBudgetId?: number;
    mostUrgentId?: number;
    bestOpennessId?: number;
    topRecommendedId?: number;
    strategicAdvice: string;
  };
}

/**
 * 提取采购单位发包偏好轻量统计
 */
async function getPurchaserBriefInsight(
  purchaserName: string | null
): Promise<TenderComparePurchaserInsight | null> {
  if (!purchaserName || !purchaserName.trim()) return null;
  const name = purchaserName.trim();

  const tenders = await prisma.tender.findMany({
    where: { purchaser: name },
    select: {
      budgetAmount: true,
      winningSupplier: true,
      type: true,
    },
    take: 50,
  });

  if (tenders.length === 0) return null;

  let totalBudget = 0;
  let budgetCount = 0;
  const supplierCounts: Record<string, number> = {};
  let totalResultsWithWinner = 0;

  for (const t of tenders) {
    if (t.budgetAmount) {
      totalBudget += Number(t.budgetAmount);
      budgetCount++;
    }
    if (t.winningSupplier && t.winningSupplier.trim()) {
      const w = t.winningSupplier.trim();
      supplierCounts[w] = (supplierCounts[w] || 0) + 1;
      totalResultsWithWinner++;
    }
  }

  let topSupplier: { name: string; count: number } | null = null;
  let maxCount = 0;
  for (const [sName, cnt] of Object.entries(supplierCounts)) {
    if (cnt > maxCount) {
      maxCount = cnt;
      topSupplier = { name: sName, count: cnt };
    }
  }

  const supplierConcentrationRate =
    totalResultsWithWinner > 0 && topSupplier
      ? Math.round((topSupplier.count / totalResultsWithWinner) * 100)
      : undefined;

  return {
    name,
    totalNotices: tenders.length,
    totalBudgetWan: Math.round(totalBudget * 100) / 100,
    avgBudgetWan: budgetCount > 0 ? Math.round((totalBudget / budgetCount) * 100) / 100 : 0,
    topSupplier,
    supplierConcentrationRate,
  };
}

/**
 * 计算标段立项与决策矩阵评分
 */
function calculateTenderDecisionScores(
  tender: {
    budgetAmount: number | null;
    expireDate: Date | null;
    publishDate: Date;
  },
  countdown: DeadlineCountdown | null,
  purchaserInsight: TenderComparePurchaserInsight | null,
  disqualifiedCount: number
): TenderDecisionScores {
  // 1. 预算吸引力 (1-5 星)
  const budget = tender.budgetAmount ? Number(tender.budgetAmount) : 0;
  let budgetAttractiveness = 2;
  if (budget >= 1000) budgetAttractiveness = 5;
  else if (budget >= 500) budgetAttractiveness = 4;
  else if (budget >= 100) budgetAttractiveness = 3;
  else if (budget > 0) budgetAttractiveness = 2;
  else budgetAttractiveness = 1;

  // 2. 准备周期宽裕度 (1-5 星)
  let preparationMargin = 3;
  if (!countdown || countdown.isDeadlinePassed) {
    preparationMargin = 1;
  } else if (countdown.diffHours <= 48) {
    preparationMargin = 1;
  } else if (countdown.diffDays <= 5) {
    preparationMargin = 2;
  } else if (countdown.diffDays <= 12) {
    preparationMargin = 4;
  } else {
    preparationMargin = 5;
  }

  // 3. 买方公平开放度 (1-5 星，集中度越低越开放)
  let purchaserOpenness = 4;
  if (purchaserInsight && purchaserInsight.supplierConcentrationRate !== undefined) {
    if (purchaserInsight.supplierConcentrationRate > 60) purchaserOpenness = 1;
    else if (purchaserInsight.supplierConcentrationRate > 40) purchaserOpenness = 2;
    else if (purchaserInsight.supplierConcentrationRate > 20) purchaserOpenness = 3;
    else purchaserOpenness = 5;
  }

  // 4. 综合胜算与立项推荐得分 (0 - 100)
  // 权重：预算 30% + 周期 35% + 开放度 35% - 一票否决惩罚
  const rawScore =
    budgetAttractiveness * 6 + preparationMargin * 7 + purchaserOpenness * 7;
  const penalty = disqualifiedCount > 2 ? 15 : disqualifiedCount > 0 ? 5 : 0;
  const overallRecommendScore = Math.max(20, Math.min(98, rawScore - penalty));

  let recommendLevel: "MUST_TARGET" | "CONSIDER" | "LOW_PRIORITY" = "CONSIDER";
  let recommendReason = "";

  if (countdown?.isDeadlinePassed) {
    recommendLevel = "LOW_PRIORITY";
    recommendReason = "该项目投标已截止递交，建议移至复盘监控其开标结果。";
  } else if (overallRecommendScore >= 80) {
    recommendLevel = "MUST_TARGET";
    recommendReason = "标段体量优质且准备周期充裕，发包方竞争环境开放，建议作为第一梯队全力主攻！";
  } else if (overallRecommendScore >= 60) {
    recommendLevel = "CONSIDER";
    recommendReason = "项目符合基本准入条件，但需重点复核资质及工期要求，建议作为备选项目积极跟进。";
  } else {
    recommendLevel = "LOW_PRIORITY";
    recommendReason =
      countdown && countdown.diffHours <= 48
        ? "项目截标时间极其紧迫（≤48h），若前期无充分筹备极易封标不及，建议审慎评估投入成本。"
        : "发包方供应商集中度较高或资格门槛较为严苛，建议寻找本地联合体或聚焦其他更优标段。";
  }

  return {
    budgetAttractiveness,
    preparationMargin,
    purchaserOpenness,
    overallRecommendScore,
    recommendLevel,
    recommendReason,
  };
}

/**
 * 批量聚合与深度比对多标段数据
 */
export async function getTenderCompareData(
  ids: number[],
  options: {
    maxLimit?: number;
    planName?: string;
    now?: Date;
  } = {}
): Promise<TenderCompareResult> {
  const maxAllowed = options.maxLimit ?? 4;
  const planName = options.planName ?? "VIP专享";
  const now = options.now || new Date();

  // 去重且切取
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0))).slice(
    0,
    maxAllowed
  );

  if (uniqueIds.length === 0) {
    return {
      tenders: [],
      isLocked: false,
      maxAllowed,
      planName,
    };
  }

  const rawTenders = await prisma.tender.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      project: {
        include: {
          notices: {
            select: { id: true },
          },
        },
      },
      _count: {
        select: { attachments: true },
      },
    },
  });

  // 按输入顺序排序
  const tenderMap = new Map(rawTenders.map((t) => [t.id, t]));
  const orderedTenders = uniqueIds
    .map((id) => tenderMap.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  // 获取区划字典
  const provinceCodes = Array.from(
    new Set(orderedTenders.map((t) => t.provinceCode).filter(Boolean) as string[])
  );
  const cityCodes = Array.from(
    new Set(orderedTenders.map((t) => t.cityCode).filter(Boolean) as string[])
  );

  const [provinces, cities] = await Promise.all([
    prisma.region.findMany({
      where: { code: { in: provinceCodes }, level: 1 },
      select: { code: true, name: true },
    }),
    prisma.region.findMany({
      where: { code: { in: cityCodes }, level: 2 },
      select: { code: true, name: true },
    }),
  ]);

  const provMap = new Map(provinces.map((p) => [p.code, p.name]));
  const cityMap = new Map(cities.map((c) => [c.code, c.name]));

  // 深度提取每个标段的比对要素
  const items: TenderCompareItem[] = [];

  for (const t of orderedTenders) {
    const countdown = calculateDeadlineCountdown(t.expireDate, null, now);
    const purchaserInsight = await getPurchaserBriefInsight(t.purchaser);

    // 启发式抽取评分办法与一票否决
    const heuristic = analyzeWithHeuristics(t);
    const disqualifiedItems = heuristic.riskRadar?.disqualifiedItems || [];

    const scoring: TenderCompareScoringInfo = {
      methodType: heuristic.scoringMethod?.methodType || "综合评分法",
      weights: heuristic.scoringMethod?.weights || { price: 30, technical: 50, business: 20 },
      keyPoints: (heuristic.scoringMethod?.keyScoringPoints || []).map(
        (p) => `[${p.category}] ${p.focus}`
      ),
    };

    const decisionScores = calculateTenderDecisionScores(
      {
        budgetAmount: t.budgetAmount ? Number(t.budgetAmount) : null,
        expireDate: t.expireDate,
        publishDate: t.publishDate,
      },
      countdown,
      purchaserInsight,
      disqualifiedItems.length
    );

    const industryName = t.industryCode && INDUSTRY_META[t.industryCode]
      ? INDUSTRY_META[t.industryCode].name
      : null;

    items.push({
      id: t.id,
      title: t.title,
      type: t.type,
      provinceCode: t.provinceCode,
      provinceName: t.provinceCode ? provMap.get(t.provinceCode) || null : null,
      cityCode: t.cityCode,
      cityName: t.cityCode ? cityMap.get(t.cityCode) || null : null,
      publishDate: t.publishDate.toISOString().slice(0, 10),
      expireDate: t.expireDate ? t.expireDate.toISOString().slice(0, 10) : null,
      budgetAmount: t.budgetAmount ? Number(t.budgetAmount) : null,
      projectNo: t.projectNo,
      purchaser: t.purchaser,
      agency: t.agency,
      industryCode: t.industryCode,
      industryName,
      attachmentsCount: t._count.attachments,
      projectId: t.project?.id || null,
      projectNoticeCount: t.project?.notices.length || 0,
      deadlineCountdown: countdown,
      purchaserInsight,
      scoring,
      disqualifiedItems,
      decisionScores,
    });
  }

  // 生成 AI 横向比对汇总与决策导向建议
  let comparativeSummary: TenderCompareResult["comparativeSummary"] = undefined;
  if (items.length >= 2) {
    let highestBudgetId = items[0].id;
    let maxBudget = items[0].budgetAmount || 0;

    let topRecommendedId = items[0].id;
    let maxRecScore = items[0].decisionScores.overallRecommendScore;

    let bestOpennessId = items[0].id;
    let maxOpenness = items[0].decisionScores.purchaserOpenness;

    let mostUrgentId = items[0].id;
    let minDays = items[0].deadlineCountdown?.diffDays ?? 999;

    for (const it of items) {
      if ((it.budgetAmount || 0) > maxBudget) {
        maxBudget = it.budgetAmount || 0;
        highestBudgetId = it.id;
      }
      if (it.decisionScores.overallRecommendScore > maxRecScore) {
        maxRecScore = it.decisionScores.overallRecommendScore;
        topRecommendedId = it.id;
      }
      if (it.decisionScores.purchaserOpenness > maxOpenness) {
        maxOpenness = it.decisionScores.purchaserOpenness;
        bestOpennessId = it.id;
      }
      const days = it.deadlineCountdown?.isDeadlinePassed ? -1 : it.deadlineCountdown?.diffDays ?? 999;
      if (days >= 0 && days < minDays) {
        minDays = days;
        mostUrgentId = it.id;
      }
    }

    const topItem = items.find((it) => it.id === topRecommendedId);
    const strategicAdvice = `对比当前 ${items.length} 个标段：从体量、胜算与编制周期综合考量，首选推荐标段「${topItem?.title.slice(0, 18)}...」（综合评分 ${maxRecScore}分），该项目在准备时间与竞争开放度上兼备优势。若团队技术方案充实，可同步跟进备选标段。`;

    comparativeSummary = {
      highestBudgetId,
      mostUrgentId,
      bestOpennessId,
      topRecommendedId,
      strategicAdvice,
    };
  }

  return {
    tenders: items,
    isLocked: ids.length > maxAllowed,
    maxAllowed,
    planName,
    comparativeSummary,
  };
}
