import { prisma } from "./prisma";

export interface HistoricalDiscountBenchmark {
  sampleCount: number;
  avgDiscountRate: number; // 下浮率均值 (%)
  minDiscountRate: number; // 最低下浮率 (%)
  maxDiscountRate: number; // 最高下浮率 (%)
  preferredBand: [number, number]; // 25%~75% 核心成交下浮区间 [下限, 上限]
  benchmarkSource: "PURCHASER" | "INDUSTRY" | "NATIONAL";
  sourceLabel: string;
}

export interface PricingStrategyTier {
  name: "进攻型保中标价" | "稳健型平衡价" | "防御型高利润价";
  type: "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";
  quoteWan: number;
  discountRate: number; // (%)
  estimatedScore: number; // 满分 priceWeight
  winProbability: string;
  rationale: string;
}

export interface BiddingPricingAnalysis {
  tenderId: number;
  budgetAmountWan: number;
  priceWeight: number; // 价格分权重，如 30 分
  scoringMethodType: "LOWEST_PREFER" | "AVERAGE_BENCHMARK";
  benchmark: HistoricalDiscountBenchmark;
  currentSimulation: {
    quoteWan: number;
    discountRate: number;
    estimatedScore: number;
    competitivePosition: "ANOMALOUS_LOW" | "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE" | "OVERPRICED";
    positionLabel: string;
    riskWarning?: string | null;
    advice: string;
  };
  recommendedStrategies: {
    aggressive: PricingStrategyTier;
    balanced: PricingStrategyTier;
    conservative: PricingStrategyTier;
  };
  abnormalLowThresholdRate: number; // 异常低价触发线，如 25%
}

/**
 * 挖掘采购人或行业历史中标下浮率大数据基准
 */
export async function getPurchaserDiscountBenchmark(
  purchaserName?: string | null,
  industryCode?: string | null
): Promise<HistoricalDiscountBenchmark> {
  // 1. 优先穿透同一采购人历史已中标项目
  if (purchaserName && purchaserName.trim()) {
    const historicalTenders = await prisma.tender.findMany({
      where: {
        purchaser: purchaserName.trim(),
        type: "RESULT",
        budgetAmount: { gt: 0 },
        awardAmount: { gt: 0 },
      },
      select: {
        budgetAmount: true,
        awardAmount: true,
      },
      take: 50,
    });

    if (historicalTenders.length >= 2) {
      const rates: number[] = [];
      for (const t of historicalTenders) {
        const b = Number(t.budgetAmount);
        const a = Number(t.awardAmount);
        if (b > 0 && a > 0 && a <= b) {
          const r = Math.round(((b - a) / b) * 1000) / 10;
          if (r >= 0 && r <= 60) {
            rates.push(r);
          }
        }
      }

      if (rates.length >= 2) {
        rates.sort((a, b) => a - b);
        const sum = rates.reduce((acc, v) => acc + v, 0);
        const avg = Math.round((sum / rates.length) * 10) / 10;
        const p25 = rates[Math.floor(rates.length * 0.25)];
        const p75 = rates[Math.min(rates.length - 1, Math.floor(rates.length * 0.75))];

        return {
          sampleCount: rates.length,
          avgDiscountRate: avg,
          minDiscountRate: rates[0],
          maxDiscountRate: rates[rates.length - 1],
          preferredBand: [p25, Math.max(p25 + 2, p75)],
          benchmarkSource: "PURCHASER",
          sourceLabel: `该采购人历史已开标项目大数据（${rates.length}笔）`,
        };
      }
    }
  }

  // 2. 采购人样本不足时，回落至同垂直赛道行业大盘基准
  if (industryCode && industryCode.trim()) {
    const industryTenders = await prisma.tender.findMany({
      where: {
        industryCode: industryCode.trim(),
        type: "RESULT",
        budgetAmount: { gt: 0 },
        awardAmount: { gt: 0 },
      },
      select: {
        budgetAmount: true,
        awardAmount: true,
      },
      take: 60,
    });

    const rates: number[] = [];
    for (const t of industryTenders) {
      const b = Number(t.budgetAmount);
      const a = Number(t.awardAmount);
      if (b > 0 && a > 0 && a <= b) {
        const r = Math.round(((b - a) / b) * 1000) / 10;
        if (r >= 0 && r <= 60) {
          rates.push(r);
        }
      }
    }

    if (rates.length >= 3) {
      rates.sort((a, b) => a - b);
      const sum = rates.reduce((acc, v) => acc + v, 0);
      const avg = Math.round((sum / rates.length) * 10) / 10;
      const p25 = rates[Math.floor(rates.length * 0.25)];
      const p75 = rates[Math.min(rates.length - 1, Math.floor(rates.length * 0.75))];

      return {
        sampleCount: rates.length,
        avgDiscountRate: avg,
        minDiscountRate: rates[0],
        maxDiscountRate: rates[rates.length - 1],
        preferredBand: [p25, Math.max(p25 + 2, p75)],
        benchmarkSource: "INDUSTRY",
        sourceLabel: `该垂直行业同类标段历史成交基准（${rates.length}笔样本）`,
      };
    }
  }

  // 3. 全国通用政采与国央企平均下浮率基准
  return {
    sampleCount: 100,
    avgDiscountRate: 8.8,
    minDiscountRate: 1.5,
    maxDiscountRate: 23.5,
    preferredBand: [5.5, 12.0],
    benchmarkSource: "NATIONAL",
    sourceLabel: "全国招投标大盘综合成交下浮率基准",
  };
}

/**
 * 精算投标出价策略罗盘与价格分模拟
 */
export function calculateBiddingPricingStrategy(options: {
  tenderId: number;
  budgetAmountWan: number;
  benchmark: HistoricalDiscountBenchmark;
  proposedQuoteWan?: number | null;
  priceWeight?: number;
  scoringMethodType?: "LOWEST_PREFER" | "AVERAGE_BENCHMARK";
}): BiddingPricingAnalysis {
  const { tenderId, benchmark } = options;
  const budget = Math.max(1, options.budgetAmountWan || 100);
  const priceWeight = options.priceWeight || 30; // 默认价格分 30 分
  const scoringMethodType = options.scoringMethodType || "LOWEST_PREFER";
  const abnormalLowThresholdRate = 25.0;

  // 1. 推算三档推荐策略
  // 稳健型：采用基准均值下浮率
  const balancedRate = Math.min(22, Math.max(4, benchmark.avgDiscountRate));
  const balancedQuote = Math.round(budget * (1 - balancedRate / 100) * 100) / 100;

  // 进攻型：比核心区间上限更优惠 2%~3%，但不超过 22% 防触红线
  const aggressiveRate = Math.min(22.5, Math.max(balancedRate + 2.5, benchmark.preferredBand[1] + 1.5));
  const aggressiveQuote = Math.round(budget * (1 - aggressiveRate / 100) * 100) / 100;

  // 防御型：追求高毛利，下浮率控制在 3%~5%
  const conservativeRate = Math.max(2.0, Math.min(5.0, benchmark.preferredBand[0] - 1.5));
  const conservativeQuote = Math.round(budget * (1 - conservativeRate / 100) * 100) / 100;

  // 辅助计算价格分（采用政采标准：满足招标文件要求的最低报价为基准价得满分）
  const baseBenchmarkQuote = aggressiveQuote; // 假设最低合理报价拿满分
  const computePriceScore = (q: number) => {
    if (q <= baseBenchmarkQuote) return priceWeight;
    const score = (baseBenchmarkQuote / q) * priceWeight;
    return Math.round(score * 10) / 10;
  };

  const aggressiveTier: PricingStrategyTier = {
    name: "进攻型保中标价",
    type: "AGGRESSIVE",
    quoteWan: aggressiveQuote,
    discountRate: aggressiveRate,
    estimatedScore: priceWeight,
    winProbability: "胜率高 (商务价格分满分)",
    rationale: `下浮 ${aggressiveRate}% 紧贴采购人成交中枢低位，商务价格项拿满 ${priceWeight} 分，适合以抢占市场、冲业绩为首要目标的投标。`,
  };

  const balancedTier: PricingStrategyTier = {
    name: "稳健型平衡价",
    type: "BALANCED",
    quoteWan: balancedQuote,
    discountRate: balancedRate,
    estimatedScore: computePriceScore(balancedQuote),
    winProbability: "极力推荐 (综合性价比最优)",
    rationale: `下浮 ${balancedRate}% 处于该买方历史成交的核心黄金带，预估价格分得 ${computePriceScore(balancedQuote)} 分，既保住合理项目毛利，又具强劲竞争力。`,
  };

  const conservativeTier: PricingStrategyTier = {
    name: "防御型高利润价",
    type: "CONSERVATIVE",
    quoteWan: conservativeQuote,
    discountRate: conservativeRate,
    estimatedScore: computePriceScore(conservativeQuote),
    winProbability: "技术/资质需极强支撑",
    rationale: `仅下浮 ${conservativeRate}%，可保障极高项目利润率；但价格分预计落后约 ${(priceWeight - computePriceScore(conservativeQuote)).toFixed(1)} 分，需依靠技术方案与独家资质拉回总分。`,
  };

  // 2. 模拟当前出价
  const currentQuote = options.proposedQuoteWan && options.proposedQuoteWan > 0
    ? options.proposedQuoteWan
    : balancedQuote;
  const currentDiscountRate = Math.round(((budget - currentQuote) / budget) * 1000) / 10;
  const currentEstimatedScore = computePriceScore(currentQuote);

  let competitivePosition: BiddingPricingAnalysis["currentSimulation"]["competitivePosition"] = "BALANCED";
  let positionLabel = "稳健平衡区间";
  let riskWarning: string | null = null;
  let advice = "当前报价处于稳健区间，价格分与利润平衡度良好。";

  if (currentDiscountRate >= abnormalLowThresholdRate) {
    competitivePosition = "ANOMALOUS_LOW";
    positionLabel = "🚨 异常低价红线区";
    riskWarning = `当前报价下浮 ${currentDiscountRate}%，已超过 25% 警戒线！极易触发财政部第87号令第六十条之低价澄清与成本调查，若无法提供令人信服的降本证明可能被直接认定为无效标。`;
    advice = "强烈建议将报价上调至 20% 下浮率以内，规避废标与亏损风险。";
  } else if (currentDiscountRate >= benchmark.preferredBand[1]) {
    competitivePosition = "AGGRESSIVE";
    positionLabel = "⚡️ 激进冲锋区间";
    advice = "当前报价具有明显价格优势，商务价格分接近满分，胜率较高。";
  } else if (currentDiscountRate <= 3.0) {
    competitivePosition = "OVERPRICED";
    positionLabel = "⚠️ 高价偏离区间";
    riskWarning = `报价仅下浮 ${currentDiscountRate}%，明显高于采购人历史成交均价。价格分可能被竞争对手拉开 ${(priceWeight - currentEstimatedScore).toFixed(1)} 分以上。`;
    advice = "建议适当下浮让利，或确保技术方案与专家打分环节具备绝对碾压优势。";
  } else if (currentDiscountRate < benchmark.preferredBand[0]) {
    competitivePosition = "CONSERVATIVE";
    positionLabel = "💎 保守高利润区间";
    advice = "利润留存较多，需依靠过硬的技术指标和类似业绩弥补价格小幅失分。";
  }

  return {
    tenderId,
    budgetAmountWan: budget,
    priceWeight,
    scoringMethodType,
    benchmark,
    currentSimulation: {
      quoteWan: currentQuote,
      discountRate: currentDiscountRate,
      estimatedScore: currentEstimatedScore,
      competitivePosition,
      positionLabel,
      riskWarning,
      advice,
    },
    recommendedStrategies: {
      aggressive: aggressiveTier,
      balanced: balancedTier,
      conservative: conservativeTier,
    },
    abnormalLowThresholdRate,
  };
}
