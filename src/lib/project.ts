import { prisma } from "@/lib/prisma";
import { tenderTypeLabel, tenderTypeColor } from "@/lib/constants";

export type ProjectStage = "INTENTION" | "BIDDING" | "CLARIFYING" | "AWARDED" | "TERMINATED";

export function projectStageLabel(stage: ProjectStage): string {
  switch (stage) {
    case "INTENTION":
      return "采购意向公示";
    case "BIDDING":
      return "正在招标申报";
    case "CLARIFYING":
      return "更正澄清答疑";
    case "AWARDED":
      return "已中标成交";
    case "TERMINATED":
      return "流标/终止";
    default:
      return "推进中";
  }
}

export function projectStageBadgeColor(stage: ProjectStage): string {
  switch (stage) {
    case "INTENTION":
      return "bg-sky-50 text-sky-700 ring-sky-600/20 border-sky-200";
    case "BIDDING":
      return "bg-blue-50 text-blue-700 ring-blue-600/20 border-blue-200";
    case "CLARIFYING":
      return "bg-amber-50 text-amber-700 ring-amber-600/20 border-amber-200";
    case "AWARDED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 border-emerald-200";
    case "TERMINATED":
      return "bg-rose-50 text-rose-700 ring-rose-600/20 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-600/20 border-slate-200";
  }
}

export interface ProjectListItem {
  id: number;
  projectNo: string | null;
  canonicalTitle: string;
  displayTitle: string;
  stage: ProjectStage;
  stageLabel: string;
  noticeCount: number;
  purchaser: string | null;
  agency: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  budgetAmountWan: number | null;
  awardAmountWan: number | null;
  savingsRate: number | null;
  winningSupplier: string | null;
  firstSeenAt: string;
  latestDate: string;
}

export interface ProjectTimelineNode {
  id: number;
  title: string;
  type: string;
  typeLabel: string;
  typeColor: string;
  publishDate: string;
  budgetAmountWan: number | null;
  awardAmountWan: number | null;
  purchaser: string | null;
  winningSupplier: string | null;
  summary: string;
  isLocked: boolean;
}

export interface ProjectDetailData {
  id: number;
  projectNo: string | null;
  canonicalTitle: string;
  displayTitle: string;
  stage: ProjectStage;
  stageLabel: string;
  provinceCode: string | null;
  provinceName: string | null;
  purchaser: string | null;
  agency: string | null;
  winningSupplier: string | null;
  budgetAmountWan: number | null;
  awardAmountWan: number | null;
  savingsWan: number | null;
  savingsRate: number | null;
  timeline: ProjectTimelineNode[];
  contacts: Array<{
    id: number;
    role: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isLocked: boolean;
  }>;
  tags: string[];
  isWatched: boolean;
  isPremium: boolean;
  planCode: string;
  lockedTimelineCount: number;
}

/**
 * 判断项目所处生命周期阶段
 */
export function calculateProjectStage(
  notices: Array<{ type: string; title: string; content?: string | null }>
): ProjectStage {
  if (notices.length === 0) return "BIDDING";

  // 1. 检查是否存在流标/终止/废标信息
  const hasTermination = notices.some(
    (n) =>
      n.title.includes("终止") ||
      n.title.includes("废标") ||
      n.title.includes("流标") ||
      n.title.includes("重新招标") ||
      (n.content && (n.content.includes("终止采购") || n.content.includes("废标公告") || n.content.includes("流标公告")))
  );
  if (hasTermination) return "TERMINATED";

  // 2. 检查是否有中标/结果公告
  const hasResult = notices.some((n) => n.type === "RESULT" || n.title.includes("结果公告") || n.title.includes("中标公告") || n.title.includes("成交公告"));
  if (hasResult) return "AWARDED";

  // 3. 检查最新的是否为变更更正
  const latestNotice = notices[notices.length - 1];
  if (latestNotice && (latestNotice.type === "CHANGE" || latestNotice.title.includes("更正") || latestNotice.title.includes("变更") || latestNotice.title.includes("答疑"))) {
    return "CLARIFYING";
  }

  // 4. 检查是否包含招标或询价
  const hasNotice = notices.some((n) => n.type === "NOTICE" || n.type === "INQUIRY" || n.title.includes("招标") || n.title.includes("磋商"));
  if (hasNotice) return "BIDDING";

  // 5. 意向
  const hasIntention = notices.some((n) => n.type === "INTENTION" || n.title.includes("意向"));
  if (hasIntention) return "INTENTION";

  return "BIDDING";
}

/**
 * 汇总项目列表与筛选
 */
export async function getProjectList(options: {
  query?: string;
  provinceCode?: string;
  stage?: "all" | "bidding" | "clarifying" | "awarded" | "terminated";
  sortBy?: "latest" | "budget" | "notices";
  page?: number;
  pageSize?: number;
}): Promise<{
  projects: ProjectListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  metrics: {
    totalProjects: number;
    biddingCount: number;
    awardedCount: number;
    multiStageCount: number;
    totalBudgetWan: number;
  };
}> {
  const {
    query,
    provinceCode,
    stage = "all",
    sortBy = "latest",
    page = 1,
    pageSize = 15,
  } = options;

  // 基础条件查询
  const whereClause: Record<string, unknown> = {};

  if (query && query.trim()) {
    const q = query.trim();
    whereClause.OR = [
      { canonicalTitle: { contains: q } },
      { projectNo: { contains: q } },
      {
        notices: {
          some: {
            OR: [
              { title: { contains: q } },
              { purchaser: { contains: q } },
              { winningSupplier: { contains: q } },
            ],
          },
        },
      },
    ];
  }

  if (provinceCode && provinceCode.trim()) {
    whereClause.provinceCode = provinceCode.trim();
  }

  // 查询所有的 regions 供中文映射
  const regions = await prisma.region.findMany({
    where: { level: 1 },
    select: { code: true, name: true },
  });
  const regionMap = new Map(regions.map((r) => [r.code, r.name]));

  // 查询符合基础条件的 projects
  const allCandidates = await prisma.project.findMany({
    where: whereClause,
    include: {
      notices: {
        select: {
          id: true,
          title: true,
          type: true,
          publishDate: true,
          budgetAmount: true,
          awardAmount: true,
          purchaser: true,
          agency: true,
          winningSupplier: true,
        },
        orderBy: { publishDate: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // 全局概览数据计算（不受当前 stage 过滤限制，但受 query/province 影响）
  let totalBidding = 0;
  let totalAwarded = 0;
  let totalMultiStage = 0;
  let totalBudgetSum = 0;

  // 解析并映射
  const mappedProjects: ProjectListItem[] = [];

  for (const p of allCandidates) {
    const notices = p.notices;
    const computedStage = calculateProjectStage(notices);

    // 统计全局指标
    if (computedStage === "BIDDING" || computedStage === "CLARIFYING") totalBidding++;
    if (computedStage === "AWARDED") totalAwarded++;
    if (notices.length > 1) totalMultiStage++;

    // 汇总预算和中标
    let maxBudgetWan: number | null = null;
    let maxAwardWan: number | null = null;
    let purchaserName: string | null = null;
    let agencyName: string | null = null;
    let winningSupplier: string | null = null;
    let earliestDate: Date = p.firstSeenAt;
    let latestDate: Date = p.updatedAt;

    for (const n of notices) {
      if (n.budgetAmount) {
        const b = Number(n.budgetAmount);
        if (maxBudgetWan === null || b > maxBudgetWan) maxBudgetWan = b;
      }
      if (n.awardAmount) {
        const a = Number(n.awardAmount);
        if (maxAwardWan === null || a > maxAwardWan) maxAwardWan = a;
      }
      if (!purchaserName && n.purchaser) purchaserName = n.purchaser;
      if (!agencyName && n.agency) agencyName = n.agency;
      if (!winningSupplier && n.winningSupplier) winningSupplier = n.winningSupplier;
      if (n.publishDate < earliestDate) earliestDate = n.publishDate;
      if (n.publishDate > latestDate) latestDate = n.publishDate;
    }

    if (maxBudgetWan) {
      totalBudgetSum += maxBudgetWan;
    }

    // 节资率
    let savingsRate: number | null = null;
    if (maxBudgetWan && maxAwardWan && maxBudgetWan > maxAwardWan) {
      savingsRate = Number((((maxBudgetWan - maxAwardWan) / maxBudgetWan) * 100).toFixed(1));
    }

    // 显示标题美化
    const displayTitle = notices[0]?.title || p.canonicalTitle;

    // 阶段过滤匹配
    if (stage !== "all") {
      if (stage === "bidding" && computedStage !== "BIDDING") continue;
      if (stage === "clarifying" && computedStage !== "CLARIFYING") continue;
      if (stage === "awarded" && computedStage !== "AWARDED") continue;
      if (stage === "terminated" && computedStage !== "TERMINATED") continue;
    }

    mappedProjects.push({
      id: p.id,
      projectNo: p.projectNo,
      canonicalTitle: p.canonicalTitle,
      displayTitle,
      stage: computedStage,
      stageLabel: projectStageLabel(computedStage),
      noticeCount: notices.length,
      purchaser: purchaserName,
      agency: agencyName,
      provinceCode: p.provinceCode,
      provinceName: p.provinceCode ? regionMap.get(p.provinceCode) ?? null : null,
      budgetAmountWan: maxBudgetWan,
      awardAmountWan: maxAwardWan,
      savingsRate,
      winningSupplier,
      firstSeenAt: earliestDate.toISOString().slice(0, 10),
      latestDate: latestDate.toISOString().slice(0, 10),
    });
  }

  // 排序
  if (sortBy === "budget") {
    mappedProjects.sort((a, b) => (b.budgetAmountWan ?? 0) - (a.budgetAmountWan ?? 0));
  } else if (sortBy === "notices") {
    mappedProjects.sort((a, b) => b.noticeCount - a.noticeCount);
  } else {
    // 默认按最新更新日期
    mappedProjects.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }

  // 分页
  const total = mappedProjects.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIdx = (page - 1) * pageSize;
  const paginated = mappedProjects.slice(startIdx, startIdx + pageSize);

  return {
    projects: paginated,
    total,
    page,
    pageSize,
    totalPages,
    metrics: {
      totalProjects: allCandidates.length,
      biddingCount: totalBidding,
      awardedCount: totalAwarded,
      multiStageCount: totalMultiStage,
      totalBudgetWan: Math.round(totalBudgetSum),
    },
  };
}

/**
 * 获取 360° 单项目全生命周期穿透详情
 */
export async function getProjectDetail(
  projectId: number,
  user?: { id?: number; role?: string; planCode?: string; teamId?: number | null } | null
): Promise<ProjectDetailData | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      notices: {
        select: {
          id: true,
          title: true,
          type: true,
          content: true,
          publishDate: true,
          budgetAmount: true,
          awardAmount: true,
          purchaser: true,
          agency: true,
          winningSupplier: true,
        },
        orderBy: { publishDate: "asc" },
      },
    },
  });

  if (!project) return null;

  // 会员等级判定
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

  // 省份
  let provinceName: string | null = null;
  if (project.provinceCode) {
    const region = await prisma.region.findUnique({
      where: { code: project.provinceCode },
      select: { name: true },
    });
    if (region) provinceName = region.name;
  }

  const notices = project.notices;
  const stage = calculateProjectStage(notices);

  // 聚合采购人、代理人、中标人、财务
  let purchaser: string | null = null;
  let agency: string | null = null;
  let winningSupplier: string | null = null;
  let budgetAmountWan: number | null = null;
  let awardAmountWan: number | null = null;

  for (const n of notices) {
    if (!purchaser && n.purchaser) purchaser = n.purchaser;
    if (!agency && n.agency) agency = n.agency;
    if (!winningSupplier && n.winningSupplier) winningSupplier = n.winningSupplier;
    if (n.budgetAmount) {
      const b = Number(n.budgetAmount);
      if (budgetAmountWan === null || b > budgetAmountWan) budgetAmountWan = b;
    }
    if (n.awardAmount) {
      const a = Number(n.awardAmount);
      if (awardAmountWan === null || a > awardAmountWan) awardAmountWan = a;
    }
  }

  // 差价与节资率
  let savingsWan: number | null = null;
  let savingsRate: number | null = null;
  if (budgetAmountWan && awardAmountWan && budgetAmountWan > awardAmountWan) {
    savingsWan = Number((budgetAmountWan - awardAmountWan).toFixed(2));
    savingsRate = Number(((savingsWan / budgetAmountWan) * 100).toFixed(1));
  }

  // 联系人检索（如果有采购人）
  let contacts: Array<{
    id: number;
    role: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isLocked: boolean;
  }> = [];

  if (purchaser) {
    const orgContacts = await prisma.orgContact.findMany({
      where: { orgName: purchaser.trim() },
      take: 4,
    });

    contacts = orgContacts.map((c) => {
      let phone = c.phone;
      let email = c.email;
      let isLocked = false;

      if (!isPremium) {
        isLocked = true;
        if (phone && phone.length > 7) {
          phone = `${phone.slice(0, 3)}****${phone.slice(-3)}`;
        } else if (phone) {
          phone = "******";
        }
        if (email) email = "******@***.com";
      }

      return {
        id: c.id,
        role: c.role,
        phone,
        email,
        address: c.address,
        isLocked,
      };
    });
  }

  // 检查当前用户是否已订阅关注此项目
  let isWatched = false;
  if (user?.id) {
    const targetKeywords = [project.projectNo, project.canonicalTitle.slice(0, 20)].filter(
      Boolean
    ) as string[];
    const watches = await prisma.pushWatch.findMany({
      where: {
        userId: user.id,
        enabled: true,
        keyword: { in: targetKeywords },
      },
    });
    isWatched = watches.length > 0;
  }

  // 组装全流程时间轴节点
  const sortedNotices = [...notices].sort(
    (a, b) => a.publishDate.getTime() - b.publishDate.getTime()
  );

  let lockedTimelineCount = 0;
  const timeline: ProjectTimelineNode[] = sortedNotices.map((n, idx) => {
    // 摘要提取（前 120 字）
    let summary = "";
    if (n.content) {
      summary = n.content.slice(0, 120).replace(/\s+/g, " ") + "...";
    }

    const nodeBudget = n.budgetAmount ? Number(n.budgetAmount) : null;
    const nodeAward = n.awardAmount ? Number(n.awardAmount) : null;

    if (!isPremium && idx >= 2) {
      // 免费用户第 3 节点起脱敏
      return {
        id: n.id,
        title: `${n.title.slice(0, 8)}...（升级白金版解锁全周期推进公告）`,
        type: n.type,
        typeLabel: tenderTypeLabel(n.type),
        typeColor: tenderTypeColor(n.type),
        publishDate: n.publishDate.toISOString().slice(0, 7) + "-**",
        budgetAmountWan: null,
        awardAmountWan: null,
        purchaser: "******",
        winningSupplier: "******",
        summary: "升级白金版会员即可查看该阶段详细澄清答疑/成交结果说明与合同附件...",
        isLocked: true,
      };
    }

    return {
      id: n.id,
      title: n.title,
      type: n.type,
      typeLabel: tenderTypeLabel(n.type),
      typeColor: tenderTypeColor(n.type),
      publishDate: n.publishDate.toISOString().slice(0, 10),
      budgetAmountWan: nodeBudget,
      awardAmountWan: nodeAward,
      purchaser: n.purchaser,
      winningSupplier: n.winningSupplier,
      summary,
      isLocked: false,
    };
  });

  if (!isPremium && sortedNotices.length > 2) {
    lockedTimelineCount = sortedNotices.length - 2;
  }

  // 智能标签提取
  const tags: string[] = [];
  if (stage === "AWARDED") tags.push("已圆满结案");
  if (stage === "BIDDING") tags.push("处于关键窗口期");
  if (stage === "CLARIFYING") tags.push("最新发生澄清更正");
  if (notices.length > 2) tags.push("高频推进跟踪项目");
  if (budgetAmountWan && budgetAmountWan >= 500) tags.push("大额重大项目");
  if (savingsRate && savingsRate > 5) tags.push(`高节资率 (${savingsRate}%)`);

  const displayTitle = notices[0]?.title || project.canonicalTitle;

  return {
    id: project.id,
    projectNo: project.projectNo,
    canonicalTitle: project.canonicalTitle,
    displayTitle,
    stage,
    stageLabel: projectStageLabel(stage),
    provinceCode: project.provinceCode,
    provinceName,
    purchaser,
    agency,
    winningSupplier,
    budgetAmountWan,
    awardAmountWan: isPremium ? awardAmountWan : (awardAmountWan ? null : null),
    savingsWan: isPremium ? savingsWan : null,
    savingsRate: isPremium ? savingsRate : null,
    timeline,
    contacts,
    tags,
    isWatched,
    isPremium,
    planCode,
    lockedTimelineCount,
  };
}
