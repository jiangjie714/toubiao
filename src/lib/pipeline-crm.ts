import type { FollowStatus, FollowPriority } from "@/app/actions/tender-follow";

export interface PipelineStageConfig {
  status: FollowStatus;
  label: string;
  shortLabel: string;
  defaultWinRate: number; // 0 - 100
  color: string;
  badgeBg: string;
  description: string;
}

export const PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    status: "EVALUATING",
    label: "线索初筛与评估",
    shortLabel: "初筛评估",
    defaultWinRate: 15,
    color: "text-blue-600",
    badgeBg: "bg-blue-50 border-blue-200 text-blue-700",
    description: "商机抓取、立项可行性论证与客情摸底",
  },
  {
    status: "DECIDED",
    label: "投前立项与决策",
    shortLabel: "立项决策",
    defaultWinRate: 35,
    color: "text-indigo-600",
    badgeBg: "bg-indigo-50 border-indigo-200 text-indigo-700",
    description: "通过投前Go/No-Go评审，确定全力投标",
  },
  {
    status: "DRAFTING",
    label: "标书编制与封标",
    shortLabel: "标书编制",
    defaultWinRate: 55,
    color: "text-amber-600",
    badgeBg: "bg-amber-50 border-amber-200 text-amber-700",
    description: "编制商务技术卷、资质业绩装配与自检",
  },
  {
    status: "SUBMITTED",
    label: "已递交待唱标",
    shortLabel: "递交开标",
    defaultWinRate: 75,
    color: "text-purple-600",
    badgeBg: "bg-purple-50 border-purple-200 text-purple-700",
    description: "电子标书投递成功，待开标公示",
  },
  {
    status: "WON",
    label: "中标落地签约",
    shortLabel: "中标签约",
    defaultWinRate: 100,
    color: "text-emerald-600",
    badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
    description: "公示中标候选人第一名，准备签署合同",
  },
  {
    status: "LOST",
    label: "失标复盘归档",
    shortLabel: "失标归档",
    defaultWinRate: 0,
    color: "text-rose-600",
    badgeBg: "bg-rose-50 border-rose-200 text-rose-700",
    description: "未能中标，记录复盘归因教训",
  },
];

export interface RawDealItem {
  id: number;
  tenderId: number;
  userId: number;
  creatorName: string;
  teamId: number | null;
  status: FollowStatus;
  priority: FollowPriority;
  assignee: string | null;
  targetAmount: number | null;
  notes: string | null;
  winRateScore: number | null;
  remindDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tender: {
    id: number;
    title: string;
    type: string;
    purchaser: string | null;
    budgetAmount: number | null;
    expireDate: Date | null;
    publishDate: Date | null;
    provinceCode: string | null;
    cityCode: string | null;
  };
}

export interface StageMetric {
  status: FollowStatus;
  label: string;
  count: number;
  totalAmountWan: number;
  weightedAmountWan: number;
  conversionRateFromPrev: number;
  avgDurationDays: number;
}

export interface SalesRepMetric {
  assignee: string;
  isUnassigned: boolean;
  activeDealsCount: number;
  wonDealsCount: number;
  lostDealsCount: number;
  totalWonAmountWan: number;
  inPipelineAmountWan: number;
  weightedAmountWan: number;
  winRatePercent: number;
  estimatedCommissionWan: number;
}

export interface PipelineCrmOverview {
  summary: {
    totalDeals: number;
    activeDeals: number;
    totalPipelineAmountWan: number;
    weightedExpectedRevenueWan: number;
    wonAmountWan: number;
    overallWinRate: number;
    avgDealAmountWan: number;
    openPoolCount: number;
  };
  funnelStages: StageMetric[];
  leaderboard: SalesRepMetric[];
  openPoolDeals: RawDealItem[];
  allDeals: RawDealItem[];
}

export function calculateDaysBetween(start: Date, end: Date): number {
  const diffMs = Math.abs(end.getTime() - start.getTime());
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

export function extractDealAmountWan(deal: { targetAmount: number | null; tender: { budgetAmount: number | null } }): number {
  if (deal.targetAmount && deal.targetAmount > 0) {
    return deal.targetAmount > 10000 ? deal.targetAmount / 10000 : deal.targetAmount;
  }
  if (deal.tender.budgetAmount && deal.tender.budgetAmount > 0) {
    return Number(deal.tender.budgetAmount);
  }
  return 0;
}

export function extractDealWinRate(deal: { status: FollowStatus; winRateScore: number | null }): number {
  if (typeof deal.winRateScore === "number" && deal.winRateScore >= 0 && deal.winRateScore <= 100) {
    return deal.winRateScore;
  }
  const stage = PIPELINE_STAGES.find((s) => s.status === deal.status);
  return stage ? stage.defaultWinRate : 20;
}

export function analyzePipelineCrm(deals: RawDealItem[], now: Date = new Date()): PipelineCrmOverview {
  const stageOrder: FollowStatus[] = ["EVALUATING", "DECIDED", "DRAFTING", "SUBMITTED", "WON", "LOST"];

  let totalPipelineAmountWan = 0;
  let weightedExpectedRevenueWan = 0;
  let wonAmountWan = 0;
  let wonCount = 0;
  let lostCount = 0;
  let activeCount = 0;

  const stageMap = new Map<FollowStatus, {
    count: number;
    amountWan: number;
    weightedWan: number;
    totalDays: number;
  }>();

  for (const s of stageOrder) {
    stageMap.set(s, { count: 0, amountWan: 0, weightedWan: 0, totalDays: 0 });
  }

  const repMap = new Map<string, {
    assignee: string;
    activeCount: number;
    wonCount: number;
    lostCount: number;
    wonAmountWan: number;
    inPipelineAmountWan: number;
    weightedAmountWan: number;
  }>();

  const openPoolDeals: RawDealItem[] = [];

  for (const deal of deals) {
    const amt = extractDealAmountWan(deal);
    const winRate = extractDealWinRate(deal);
    const weighted = (amt * winRate) / 100;
    const durationDays = calculateDaysBetween(new Date(deal.createdAt), now);

    const stageStat = stageMap.get(deal.status);
    if (stageStat) {
      stageStat.count += 1;
      stageStat.amountWan += amt;
      stageStat.weightedWan += weighted;
      stageStat.totalDays += durationDays;
    }

    const isActive = deal.status !== "WON" && deal.status !== "LOST";
    if (isActive) {
      activeCount += 1;
      totalPipelineAmountWan += amt;
      weightedExpectedRevenueWan += weighted;
    }

    if (deal.status === "WON") {
      wonCount += 1;
      wonAmountWan += amt;
    } else if (deal.status === "LOST") {
      lostCount += 1;
    }

    const isUnassigned = !deal.assignee || deal.assignee.trim() === "" || deal.assignee === "公海池";
    if (isUnassigned && isActive) {
      openPoolDeals.push(deal);
    }

    const repKey = isUnassigned ? "未分配(公海池)" : deal.assignee!.trim();
    if (!repMap.has(repKey)) {
      repMap.set(repKey, {
        assignee: repKey,
        activeCount: 0,
        wonCount: 0,
        lostCount: 0,
        wonAmountWan: 0,
        inPipelineAmountWan: 0,
        weightedAmountWan: 0,
      });
    }

    const repStat = repMap.get(repKey)!;
    if (isActive) {
      repStat.activeCount += 1;
      repStat.inPipelineAmountWan += amt;
      repStat.weightedAmountWan += weighted;
    } else if (deal.status === "WON") {
      repStat.wonCount += 1;
      repStat.wonAmountWan += amt;
    } else if (deal.status === "LOST") {
      repStat.lostCount += 1;
    }
  }

  const funnelStages: StageMetric[] = [];
  const funnelKeys: FollowStatus[] = ["EVALUATING", "DECIDED", "DRAFTING", "SUBMITTED", "WON"];
  let prevCount = 0;

  for (let i = 0; i < funnelKeys.length; i++) {
    const key = funnelKeys[i];
    const stat = stageMap.get(key)!;
    const stageConf = PIPELINE_STAGES.find((s) => s.status === key)!;

    let convRate = 100;
    if (i > 0) {
      convRate = prevCount > 0 ? Math.min(100, Math.round((stat.count / prevCount) * 100)) : 0;
    }
    prevCount = stat.count > 0 ? stat.count : prevCount;

    funnelStages.push({
      status: key,
      label: stageConf.shortLabel,
      count: stat.count,
      totalAmountWan: Math.round(stat.amountWan * 100) / 100,
      weightedAmountWan: Math.round(stat.weightedWan * 100) / 100,
      conversionRateFromPrev: convRate,
      avgDurationDays: stat.count > 0 ? Math.round(stat.totalDays / stat.count) : 0,
    });
  }

  const leaderboard: SalesRepMetric[] = Array.from(repMap.values())
    .map((r) => {
      const closedCount = r.wonCount + r.lostCount;
      const winRate = closedCount > 0 ? Math.round((r.wonCount / closedCount) * 100) : 0;
      const commission = r.wonAmountWan * 0.018 + r.weightedAmountWan * 0.003;

      return {
        assignee: r.assignee,
        isUnassigned: r.assignee.includes("公海池"),
        activeDealsCount: r.activeCount,
        wonDealsCount: r.wonCount,
        lostDealsCount: r.lostCount,
        totalWonAmountWan: Math.round(r.wonAmountWan * 100) / 100,
        inPipelineAmountWan: Math.round(r.inPipelineAmountWan * 100) / 100,
        weightedAmountWan: Math.round(r.weightedAmountWan * 100) / 100,
        winRatePercent: winRate,
        estimatedCommissionWan: Math.round(commission * 100) / 100,
      };
    })
    .sort((a, b) => b.totalWonAmountWan - a.totalWonAmountWan || b.weightedAmountWan - a.weightedAmountWan);

  const totalClosed = wonCount + lostCount;
  const overallWinRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;
  const avgDealAmt = deals.length > 0 ? Math.round(((totalPipelineAmountWan + wonAmountWan) / deals.length) * 100) / 100 : 0;

  return {
    summary: {
      totalDeals: deals.length,
      activeDeals: activeCount,
      totalPipelineAmountWan: Math.round(totalPipelineAmountWan * 100) / 100,
      weightedExpectedRevenueWan: Math.round(weightedExpectedRevenueWan * 100) / 100,
      wonAmountWan: Math.round(wonAmountWan * 100) / 100,
      overallWinRate,
      avgDealAmountWan: avgDealAmt,
      openPoolCount: openPoolDeals.length,
    },
    funnelStages,
    leaderboard,
    openPoolDeals,
    allDeals: deals,
  };
}
