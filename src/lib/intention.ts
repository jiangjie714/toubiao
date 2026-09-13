import { prisma } from "./prisma";

export type IntentionWindowPhase = "URGENT" | "GOLDEN" | "EARLY" | "CONVERTED" | "OVERDUE";

export interface IntentionWindowInfo {
  phase: IntentionWindowPhase;
  phaseLabel: string;
  badgeClass: string;
  daysRemaining: number | null;
  estimatedDate: Date | null;
  estimatedText: string;
  isConverted: boolean;
  convertedNoticeId?: number | null;
  convertedNoticeTitle?: string | null;
}

export interface IntentionStats {
  totalCount: number;
  totalBudgetWan: number;
  goldenCount: number;
  urgentCount: number;
  convertedCount: number;
  recent30DaysCount: number;
}

/**
 * 从意向正文或标题中提取预计采购时间
 */
export function parseEstimatedProcurementDate(
  content: string | null | undefined,
  title: string,
  publishDate: Date
): { estimatedDate: Date | null; rawText: string } {
  const text = `${title} ${content || ""}`;

  // 1. 正则匹配常见表述：
  // 预计采购时间/日期/月份：2026年10月 或 2026-10 或 2026年10月15日
  const patterns = [
    /预计采购(?:时间|日期|月份)[：:\s]*([0-9]{4})\s*[年\-\/.]\s*([0-9]{1,2})\s*(?:[月\-\/.]\s*([0-9]{1,2})[日号]?)?/i,
    /预计开展采购活动时间[为：:\s]*([0-9]{4})\s*[年\-\/.]\s*([0-9]{1,2})\s*(?:[月\-\/.]\s*([0-9]{1,2})[日号]?)?/i,
    /采购时间[：:\s]*([0-9]{4})\s*[年\-\/.]\s*([0-9]{1,2})\s*(?:[月\-\/.]\s*([0-9]{1,2})[日号]?)?/i,
    /([0-9]{4})\s*年\s*([0-9]{1,2})\s*月采购意向/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day = m[3] ? parseInt(m[3], 10) : 1;
      if (year >= 2020 && year <= 2035 && month >= 1 && month <= 12) {
        const est = new Date(year, month - 1, day, 9, 0, 0);
        const rawText = `${year}年${month}月${m[3] ? day + "日" : ""}`;
        return { estimatedDate: est, rawText };
      }
    }
  }

  // 2. 兜底策略：意向通常提前约 45 天发布
  const fallback = new Date(publishDate.getTime() + 45 * 24 * 3600 * 1000);
  const fYear = fallback.getFullYear();
  const fMonth = fallback.getMonth() + 1;
  return {
    estimatedDate: fallback,
    rawText: `约${fYear}年${fMonth}月 (估算)`,
  };
}

/**
 * 计算意向商机的提前介入窗口期状态
 */
export function calculateIntentionWindow(
  publishDate: Date,
  estimatedDate: Date | null,
  estimatedText: string,
  convertedNotice?: { id: number; title: string } | null
): IntentionWindowInfo {
  if (convertedNotice) {
    return {
      phase: "CONVERTED",
      phaseLabel: "已启动招标",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      daysRemaining: 0,
      estimatedDate,
      estimatedText,
      isConverted: true,
      convertedNoticeId: convertedNotice.id,
      convertedNoticeTitle: convertedNotice.title,
    };
  }

  if (!estimatedDate) {
    return {
      phase: "GOLDEN",
      phaseLabel: "黄金介入期",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      daysRemaining: null,
      estimatedDate: null,
      estimatedText,
      isConverted: false,
    };
  }

  const now = new Date();
  const diffMs = estimatedDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (24 * 3600 * 1000));

  if (daysRemaining < -30) {
    return {
      phase: "OVERDUE",
      phaseLabel: "已超预计期",
      badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
      daysRemaining,
      estimatedDate,
      estimatedText,
      isConverted: false,
    };
  }

  if (daysRemaining <= 15) {
    return {
      phase: "URGENT",
      phaseLabel: daysRemaining > 0 ? `即将启动 · 剩 ${daysRemaining} 天` : "本月即将招标",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      daysRemaining,
      estimatedDate,
      estimatedText,
      isConverted: false,
    };
  }

  if (daysRemaining <= 60) {
    return {
      phase: "GOLDEN",
      phaseLabel: `黄金介入期 · 剩 ${daysRemaining} 天`,
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      daysRemaining,
      estimatedDate,
      estimatedText,
      isConverted: false,
    };
  }

  return {
    phase: "EARLY",
    phaseLabel: `远期规划 · 剩 ${daysRemaining} 天`,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    daysRemaining,
    estimatedDate,
    estimatedText,
    isConverted: false,
  };
}

/**
 * 聚合全站采购意向大盘指标
 */
export async function getIntentionStats(): Promise<IntentionStats> {
  const intentions = await prisma.tender.findMany({
    where: { type: "INTENTION" },
    select: {
      id: true,
      title: true,
      content: true,
      publishDate: true,
      budgetAmount: true,
      projectRefId: true,
      project: {
        select: {
          notices: {
            where: { type: { in: ["NOTICE", "RESULT"] } },
            select: { id: true, title: true },
            take: 1,
          },
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  let totalBudget = 0;
  let goldenCount = 0;
  let urgentCount = 0;
  let convertedCount = 0;
  let recent30DaysCount = 0;

  for (const t of intentions) {
    if (t.budgetAmount) {
      totalBudget += Number(t.budgetAmount);
    }
    if (t.publishDate >= thirtyDaysAgo) {
      recent30DaysCount++;
    }

    const hasBidding = (t.project?.notices?.length || 0) > 0;
    const { estimatedDate, rawText } = parseEstimatedProcurementDate(t.content, t.title, t.publishDate);
    const windowInfo = calculateIntentionWindow(
      t.publishDate,
      estimatedDate,
      rawText,
      hasBidding ? t.project!.notices[0] : null
    );

    if (windowInfo.phase === "CONVERTED") {
      convertedCount++;
    } else if (windowInfo.phase === "GOLDEN") {
      goldenCount++;
    } else if (windowInfo.phase === "URGENT") {
      urgentCount++;
    }
  }

  return {
    totalCount: intentions.length,
    totalBudgetWan: Number((totalBudget / 10000).toFixed(2)),
    goldenCount,
    urgentCount,
    convertedCount,
    recent30DaysCount,
  };
}

export interface QueryIntentionsParams {
  q?: string;
  provinceCode?: string;
  windowPhase?: string;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  pageSize?: number;
}

export interface IntentionItem {
  id: number;
  title: string;
  purchaser: string | null;
  provinceCode: string | null;
  budgetAmount: number | null;
  budgetAmountWan: number | null;
  publishDate: string;
  sourceUrl: string | null;
  projectId: number | null;
  window: IntentionWindowInfo;
}

/**
 * 结构化多维检索采购意向列表
 */
export async function queryIntentions(params: QueryIntentionsParams) {
  const {
    q = "",
    provinceCode = "",
    windowPhase = "all",
    minBudget,
    maxBudget,
    page = 1,
    pageSize = 15,
  } = params;

  const where: Record<string, unknown> = {
    type: "INTENTION",
  };

  if (provinceCode) {
    where.provinceCode = provinceCode;
  }

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { purchaser: { contains: q } },
      { content: { contains: q } },
    ];
  }

  if (minBudget !== undefined || maxBudget !== undefined) {
    const budgetCond: Record<string, number> = {};
    if (minBudget !== undefined) budgetCond.gte = minBudget * 10000;
    if (maxBudget !== undefined) budgetCond.lte = maxBudget * 10000;
    where.budgetAmount = budgetCond;
  }

  // 先查询候选意向标讯
  const candidateTenders = await prisma.tender.findMany({
    where,
    orderBy: { publishDate: "desc" },
    take: 200, // 候选池，用于窗口期阶段计算与二次过滤
    select: {
        id: true,
        title: true,
        content: true,
        purchaser: true,
        provinceCode: true,
        budgetAmount: true,
        publishDate: true,
        sourceUrl: true,
        projectRefId: true,
        project: {
          select: {
            id: true,
            notices: {
              where: { type: { in: ["NOTICE", "RESULT"] } },
              select: { id: true, title: true, publishDate: true },
              orderBy: { publishDate: "asc" },
              take: 1,
            },
          },
        },
      },
    });

  // 逐条计算窗口期与转正信息
  const allItems: IntentionItem[] = candidateTenders.map((t) => {
    const { estimatedDate, rawText } = parseEstimatedProcurementDate(t.content, t.title, t.publishDate);
    const convertedNotice = t.project?.notices?.[0] || null;
    const window = calculateIntentionWindow(t.publishDate, estimatedDate, rawText, convertedNotice);
    const bAmt = t.budgetAmount ? Number(t.budgetAmount) : null;

    return {
      id: t.id,
      title: t.title,
      purchaser: t.purchaser,
      provinceCode: t.provinceCode,
      budgetAmount: bAmt,
      budgetAmountWan: bAmt ? Number((bAmt / 10000).toFixed(2)) : null,
      publishDate: t.publishDate.toISOString(),
      sourceUrl: t.sourceUrl,
      projectId: t.projectRefId,
      window,
    };
  });

  // 按窗口期状态过滤
  const filteredItems = allItems.filter((item) => {
    if (windowPhase && windowPhase !== "all") {
      return item.window.phase === windowPhase;
    }
    return true;
  });

  const total = filteredItems.length;
  const start = (page - 1) * pageSize;
  const items = filteredItems.slice(start, start + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
