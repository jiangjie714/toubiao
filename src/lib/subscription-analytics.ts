import { prisma } from "@/lib/prisma";

export interface PlanDistribution {
  planCode: string;
  planName: string;
  count: number;
  percentage: number;
  monthlyMrr: number;
}

export interface SubscriptionItem {
  id: number;
  userId: number;
  userName: string;
  userUsername: string;
  userEmail: string | null;
  planCode: string;
  planName: string;
  status: string;
  billingCycle: string;
  startsAt: string;
  endsAt: string | null;
  daysRemaining: number | null;
  urgencyLevel: "expired" | "urgent" | "warning" | "healthy" | "infinite";
  autoRenew: boolean;
  priceMonthly: number;
  priceYearly: number;
}

export interface SubscriptionAnalyticsOverview {
  totalCount: number;
  activeCount: number;
  expiredCount: number;
  urgent7DaysCount: number;
  warning30DaysCount: number;
  totalMrr: number;
  totalArr: number;
  averageArpu: number;
  retentionRate: number;
  planDistribution: PlanDistribution[];
  subscriptions: SubscriptionItem[];
}

export async function getSubscriptionAnalytics(params?: {
  statusFilter?: "all" | "active" | "urgent" | "warning" | "expired";
  planFilter?: string;
  searchQuery?: string;
}): Promise<SubscriptionAnalyticsOverview> {
  const { statusFilter = "all", planFilter = "all", searchQuery = "" } = params || {};

  const allSubscriptions = await prisma.subscription.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
        },
      },
      plan: {
        select: {
          code: true,
          name: true,
          priceMonthly: true,
          priceYearly: true,
        },
      },
    },
    orderBy: { startsAt: "desc" },
  });

  const now = new Date();

  let activeCount = 0;
  let expiredCount = 0;
  let urgent7DaysCount = 0;
  let warning30DaysCount = 0;
  let totalMrr = 0;

  const planMap: Record<string, { planName: string; count: number; monthlyMrr: number }> = {};

  const mappedItems: SubscriptionItem[] = allSubscriptions.map((sub) => {
    const isExplicitActive = sub.status === "ACTIVE";
    const isDateExpired = sub.endsAt ? new Date(sub.endsAt) < now : false;
    const isEffectiveActive = isExplicitActive && !isDateExpired;

    const endsAtDate = sub.endsAt ? new Date(sub.endsAt) : null;
    let daysRemaining: number | null = null;
    let urgencyLevel: SubscriptionItem["urgencyLevel"] = "infinite";

    if (endsAtDate) {
      const diffMs = endsAtDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) {
        urgencyLevel = "expired";
      } else if (daysRemaining <= 7) {
        urgencyLevel = "urgent";
      } else if (daysRemaining <= 30) {
        urgencyLevel = "warning";
      } else {
        urgencyLevel = "healthy";
      }
    } else {
      urgencyLevel = "infinite";
    }

    const priceM = Number(sub.plan.priceMonthly ?? 0);
    const priceY = Number(sub.plan.priceYearly ?? 0);
    const subMrr = sub.billingCycle === "yearly" ? Math.round(priceY / 12) : priceM;

    if (isEffectiveActive) {
      activeCount += 1;
      totalMrr += subMrr;
      if (urgencyLevel === "urgent") urgent7DaysCount += 1;
      if (urgencyLevel === "warning") warning30DaysCount += 1;

      // 统计套餐分布
      if (!planMap[sub.plan.code]) {
        planMap[sub.plan.code] = {
          planName: sub.plan.name,
          count: 0,
          monthlyMrr: 0,
        };
      }
      planMap[sub.plan.code].count += 1;
      planMap[sub.plan.code].monthlyMrr += subMrr;
    } else {
      expiredCount += 1;
    }

    return {
      id: sub.id,
      userId: sub.userId,
      userName: sub.user.name || sub.user.username,
      userUsername: sub.user.username,
      userEmail: sub.user.email,
      planCode: sub.plan.code,
      planName: sub.plan.name,
      status: isEffectiveActive ? "ACTIVE" : isExplicitActive ? "EXPIRED" : sub.status,
      billingCycle: sub.billingCycle,
      startsAt: sub.startsAt.toISOString(),
      endsAt: sub.endsAt ? sub.endsAt.toISOString() : null,
      daysRemaining,
      urgencyLevel,
      autoRenew: sub.autoRenew,
      priceMonthly: priceM,
      priceYearly: priceY,
    };
  });

  const totalArr = totalMrr * 12;
  const averageArpu = activeCount > 0 ? Math.round(totalMrr / activeCount) : 0;
  const totalTracked = activeCount + expiredCount;
  const retentionRate = totalTracked > 0 ? Math.round((activeCount / totalTracked) * 100) : 100;

  // 格式化套餐分布
  const planDistribution: PlanDistribution[] = Object.entries(planMap).map(([code, data]) => ({
    planCode: code,
    planName: data.planName,
    count: data.count,
    percentage: activeCount > 0 ? Math.round((data.count / activeCount) * 100) : 0,
    monthlyMrr: data.monthlyMrr,
  }));

  // 根据筛选条件过滤列表
  let filteredSubscriptions = mappedItems;

  if (statusFilter === "active") {
    filteredSubscriptions = filteredSubscriptions.filter((s) => s.status === "ACTIVE");
  } else if (statusFilter === "urgent") {
    filteredSubscriptions = filteredSubscriptions.filter((s) => s.urgencyLevel === "urgent" && s.status === "ACTIVE");
  } else if (statusFilter === "warning") {
    filteredSubscriptions = filteredSubscriptions.filter((s) => s.urgencyLevel === "warning" && s.status === "ACTIVE");
  } else if (statusFilter === "expired") {
    filteredSubscriptions = filteredSubscriptions.filter((s) => s.status !== "ACTIVE" || s.urgencyLevel === "expired");
  }

  if (planFilter && planFilter !== "all") {
    filteredSubscriptions = filteredSubscriptions.filter((s) => s.planCode === planFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredSubscriptions = filteredSubscriptions.filter(
      (s) =>
        s.userName.toLowerCase().includes(q) ||
        s.userUsername.toLowerCase().includes(q) ||
        (s.userEmail && s.userEmail.toLowerCase().includes(q)) ||
        s.planName.toLowerCase().includes(q)
    );
  }

  return {
    totalCount: allSubscriptions.length,
    activeCount,
    expiredCount,
    urgent7DaysCount,
    warning30DaysCount,
    totalMrr,
    totalArr,
    averageArpu,
    retentionRate,
    planDistribution,
    subscriptions: filteredSubscriptions,
  };
}

/**
 * 管理员客户成功操作：为指定用户手动顺延会员天数
 */
export async function extendSubscriptionDays(
  userId: number,
  days: number,
  _reason?: string
): Promise<{ success: boolean; error?: string }> {
  void _reason;
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    return { success: false, error: "未找到该用户的有效订阅记录" };
  }

  const now = new Date();
  const currentEnd = sub.endsAt && new Date(sub.endsAt) > now ? new Date(sub.endsAt) : now;
  const newEndsAt = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.subscription.update({
    where: { userId },
    data: {
      endsAt: newEndsAt,
      status: "ACTIVE",
    },
  });

  return { success: true };
}

/**
 * 管理员客户成功操作：手动调整用户套餐级别与周期
 */
export async function changeSubscriptionPlan(
  userId: number,
  planCode: string,
  billingCycle: "monthly" | "yearly"
): Promise<{ success: boolean; error?: string }> {
  const plan = await prisma.plan.findUnique({
    where: { code: planCode },
  });

  if (!plan) {
    return { success: false, error: "目标套餐不存在" };
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    return { success: false, error: "未找到该用户的订阅记录" };
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      planId: plan.id,
      billingCycle,
      status: "ACTIVE",
    },
  });

  return { success: true };
}
