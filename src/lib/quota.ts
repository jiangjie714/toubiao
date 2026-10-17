import { prisma } from "./prisma";

export type PlanFeatures = {
  searchQuota: number;
  fullText: boolean;
  contacts: boolean;
  attachments: boolean;
  pushGroups: number;
  exportDaily: number;
  apiAccess: boolean;
  aiQuota: number;
};

export type Entitlement = {
  planCode: string;
  planName: string;
  features: PlanFeatures;
  subscriptionEndsAt: Date | null;
};

export type QuotaResult = {
  allowed: boolean;
  used: number;
  quota: number;
  remaining: number;
};

function normalizeFeatures(value: unknown): PlanFeatures {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    searchQuota: Number(raw.searchQuota ?? 0),
    fullText: raw.fullText === true,
    contacts: raw.contacts === true,
    attachments: raw.attachments === true,
    pushGroups: Number(raw.pushGroups ?? 0),
    exportDaily: Number(raw.exportDaily ?? 0),
    apiAccess: raw.apiAccess === true,
    aiQuota: Number(raw.aiQuota ?? (raw.fullText ? 30 : 0)),
  };
}

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function getEntitlement(userId: number): Promise<Entitlement> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === "ADMIN") {
    return {
      planCode: "ENTERPRISE_ADMIN",
      planName: "系统管理权限（无限特权）",
      features: {
        searchQuota: 999999,
        fullText: true,
        contacts: true,
        attachments: true,
        pushGroups: 999,
        exportDaily: 99999,
        apiAccess: true,
        aiQuota: 99999,
      },
      subscriptionEndsAt: null,
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (
    subscription &&
    subscription.status === "ACTIVE" &&
    (!subscription.endsAt || subscription.endsAt > new Date())
  ) {
    return {
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      features: normalizeFeatures(subscription.plan.features),
      subscriptionEndsAt: subscription.endsAt,
    };
  }

  // 团队席位权益继承：若自身无独立有效订阅，检查是否属于某个拥有有效订阅的团队
  const membership = await prisma.teamMember.findUnique({
    where: { userId },
    include: {
      team: {
        include: {
          owner: {
            include: {
              subscription: {
                include: { plan: true },
              },
            },
          },
        },
      },
    },
  });

  const ownerSub = membership?.team?.owner?.subscription;
  if (
    ownerSub &&
    ownerSub.status === "ACTIVE" &&
    (!ownerSub.endsAt || ownerSub.endsAt > new Date())
  ) {
    return {
      planCode: ownerSub.plan.code,
      planName: `${ownerSub.plan.name}（${membership?.team?.name ?? "团队"}席位）`,
      features: normalizeFeatures(ownerSub.plan.features),
      subscriptionEndsAt: ownerSub.endsAt,
    };
  }

  const freePlan = await prisma.plan.findUnique({ where: { code: "FREE" } });
  return {
    planCode: "FREE",
    planName: freePlan?.name ?? "免费版",
    features: normalizeFeatures(freePlan?.features ?? { searchQuota: 3 }),
    subscriptionEndsAt: null,
  };
}

/**
 * 判断当前用户是否属于企业版（企业所有者或企业席位成员），或超级管理员
 */
export function isEnterpriseUser(entitlement: Entitlement): boolean {
  return (
    entitlement.planCode.startsWith("ENTERPRISE") ||
    entitlement.planCode.includes("ENTERPRISE")
  );
}

/**
 * 判断是否具备创建企业团队席位的资格
 * 严格限制：仅超级管理员与拥有有效企业版订阅的主账号才可创建团队席位
 */
export function canCreateTeam(entitlement: Entitlement, role?: string): boolean {
  if (role === "ADMIN") return true;
  return entitlement.planCode.startsWith("ENTERPRISE");
}

/**
 * 判断订单套餐是否具备开具 6% 增值税专用发票资格
 * 严格限制：仅限企业版（6,800/16,800元），个人黄金/铂金版仅支持开具增值税普通发票
 */
export function canApplySpecialInvoice(planCode: string): boolean {
  return planCode.startsWith("ENTERPRISE");
}

/**
 * 检查模块访问权限（用于企业级功能页面与服务层门禁）
 */
export function canAccessEnterpriseModule(entitlement: Entitlement): boolean {
  return isEnterpriseUser(entitlement);
}

export interface TenderViewQuotaResult extends QuotaResult {
  alreadyViewedToday: boolean;
}

/**
 * 扣减/验证单篇标讯查看配额（带今日已阅查重）：
 * 若当前用户今日已查阅过该标讯，直接免扣额放行；
 * 若今日尚未查阅过该标讯，则在配额充足时原子扣减 1 次，并记入单日查阅台账；配额耗尽则拦截。
 */
export async function consumeTenderViewQuota(
  userId: number,
  tenderId: number,
  options: { isAdmin?: boolean } = {},
): Promise<TenderViewQuotaResult> {
  const entitlement = await getEntitlement(userId);
  const quota = entitlement.features.searchQuota;
  const isUnlimited = options.isAdmin || quota >= 10000;
  const date = today();

  // 1. 检查今日是否已查阅过该招标信息
  const existingLog = await prisma.tenderViewLog.findUnique({
    where: { userId_tenderId_date: { userId, tenderId, date } },
  });

  if (existingLog) {
    const current = await getSearchQuota(userId, options);
    return {
      allowed: true,
      alreadyViewedToday: true,
      used: current.used,
      quota: current.quota,
      remaining: current.remaining,
    };
  }

  // 2. 管理员或无限配额企业客户：免扣除，直接记录已阅流水
  if (isUnlimited) {
    await prisma.tenderViewLog
      .create({
        data: { userId, tenderId, date },
      })
      .catch(() => {});
    return {
      allowed: true,
      alreadyViewedToday: false,
      used: 0,
      quota: Infinity,
      remaining: Infinity,
    };
  }

  // 3. 检查今日配额台账
  const ledger = await prisma.quotaLedger.upsert({
    where: { userId_kind_date: { userId, kind: "search", date } },
    update: {},
    create: { userId, kind: "search", date, used: 0 },
  });

  if (ledger.used >= quota) {
    return {
      allowed: false,
      alreadyViewedToday: false,
      used: ledger.used,
      quota,
      remaining: 0,
    };
  }

  // 4. 原子事务：记录已阅标讯并扣减 1 次配额
  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenderViewLog.create({
        data: { userId, tenderId, date },
      });
      await tx.quotaLedger.update({
        where: { id: ledger.id },
        data: { used: { increment: 1 } },
      });
    });

    const newUsed = ledger.used + 1;
    return {
      allowed: true,
      alreadyViewedToday: false,
      used: newUsed,
      quota,
      remaining: Math.max(0, quota - newUsed),
    };
  } catch {
    // 发生并发重复请求时重试检测已阅状态
    const checkLog = await prisma.tenderViewLog.findUnique({
      where: { userId_tenderId_date: { userId, tenderId, date } },
    });
    const current = await getSearchQuota(userId, options);
    return {
      allowed: Boolean(checkLog) || current.allowed,
      alreadyViewedToday: Boolean(checkLog),
      used: current.used,
      quota: current.quota,
      remaining: current.remaining,
    };
  }
}

/** 批量获取指定标讯列表在今日已被当前用户查阅过的 ID 集合 */
export async function getTodayViewedTenderIds(
  userId: number,
  tenderIds: number[],
): Promise<Set<number>> {
  if (tenderIds.length === 0 || !prisma.tenderViewLog) return new Set();
  try {
    const logs = await prisma.tenderViewLog.findMany({
      where: {
        userId,
        date: today(),
        tenderId: { in: tenderIds },
      },
      select: { tenderId: true },
    });
    return new Set(logs.map((l) => l.tenderId));
  } catch (error) {
    console.error("Failed to query tenderViewLog:", error);
    return new Set();
  }
}

/** 查询指定标讯在今日是否已被当前用户查阅过 */
export async function isTenderViewedToday(
  userId: number,
  tenderId: number,
): Promise<boolean> {
  if (!prisma.tenderViewLog) return false;
  try {
    const log = await prisma.tenderViewLog.findUnique({
      where: { userId_tenderId_date: { userId, tenderId, date: today() } },
      select: { id: true },
    });
    return Boolean(log);
  } catch {
    return false;
  }
}

export async function consumeSearchQuota(
  userId: number,
  options: { isAdmin?: boolean; tenderId?: number } = {},
): Promise<QuotaResult & { alreadyViewedToday?: boolean }> {
  if (options.tenderId) {
    return consumeTenderViewQuota(userId, options.tenderId, options);
  }

  const entitlement = await getEntitlement(userId);
  if (options.isAdmin || entitlement.features.searchQuota >= 10000) {
    return { allowed: true, used: 0, quota: Infinity, remaining: Infinity, alreadyViewedToday: false };
  }

  const quota = entitlement.features.searchQuota;
  const date = today();
  const ledger = await prisma.quotaLedger.upsert({
    where: { userId_kind_date: { userId, kind: "search", date } },
    update: {},
    create: { userId, kind: "search", date, used: 0 },
  });

  const claimed = await prisma.quotaLedger.updateMany({
    where: { id: ledger.id, used: { lt: quota } },
    data: { used: { increment: 1 } },
  });

  const updated = await prisma.quotaLedger.findUnique({ where: { id: ledger.id } });
  const used = updated?.used ?? ledger.used;
  return {
    allowed: claimed.count === 1,
    used,
    quota,
    remaining: Math.max(0, quota - used),
    alreadyViewedToday: false,
  };
}

async function claimDailyQuota(userId: number, kind: string, quota: number): Promise<QuotaResult> {
  const date = today();
  const ledger = await prisma.quotaLedger.upsert({
    where: { userId_kind_date: { userId, kind, date } },
    update: {},
    create: { userId, kind, date, used: 0 },
  });

  const claimed = await prisma.quotaLedger.updateMany({
    where: { id: ledger.id, used: { lt: quota } },
    data: { used: { increment: 1 } },
  });

  const updated = await prisma.quotaLedger.findUnique({ where: { id: ledger.id } });
  const used = updated?.used ?? ledger.used;
  return {
    allowed: claimed.count === 1,
    used,
    quota,
    remaining: Math.max(0, quota - used),
  };
}

export async function consumeExportQuota(userId: number): Promise<QuotaResult> {
  const entitlement = await getEntitlement(userId);
  const quota = entitlement.features.exportDaily;
  if (quota <= 0) {
    return { allowed: false, used: 0, quota, remaining: 0 };
  }
  return claimDailyQuota(userId, "export", quota);
}

export async function getExportQuota(userId: number): Promise<QuotaResult> {
  const entitlement = await getEntitlement(userId);
  const quota = entitlement.features.exportDaily;
  const date = today();
  const ledger = await prisma.quotaLedger.findUnique({
    where: { userId_kind_date: { userId, kind: "export", date } },
  });
  const used = ledger?.used ?? 0;
  return {
    allowed: used < quota,
    used,
    quota,
    remaining: Math.max(0, quota - used),
  };
}

export async function getSearchQuota(
  userId: number,
  options: { isAdmin?: boolean } = {},
): Promise<QuotaResult> {
  const entitlement = await getEntitlement(userId);
  if (options.isAdmin || entitlement.features.searchQuota >= 10000) {
    return { allowed: true, used: 0, quota: Infinity, remaining: Infinity };
  }
  const date = today();
  const ledger = await prisma.quotaLedger.findUnique({
    where: { userId_kind_date: { userId, kind: "search", date } },
  });
  const used = ledger?.used ?? 0;
  return {
    allowed: used < entitlement.features.searchQuota,
    used,
    quota: entitlement.features.searchQuota,
    remaining: Math.max(0, entitlement.features.searchQuota - used),
  };
}

export async function consumeAiQuota(
  userId: number,
  options: { isAdmin?: boolean } = {},
): Promise<QuotaResult> {
  const entitlement = await getEntitlement(userId);
  if (options.isAdmin || entitlement.features.aiQuota >= 10000) {
    return { allowed: true, used: 0, quota: Infinity, remaining: Infinity };
  }
  const quota = entitlement.features.aiQuota;
  if (quota <= 0) {
    return { allowed: false, used: 0, quota: 0, remaining: 0 };
  }
  return claimDailyQuota(userId, "ai", quota);
}

export async function getAiQuota(userId: number): Promise<QuotaResult> {
  const entitlement = await getEntitlement(userId);
  const quota = entitlement.features.aiQuota;
  const date = today();
  const ledger = await prisma.quotaLedger.findUnique({
    where: { userId_kind_date: { userId, kind: "ai", date } },
  });
  const used = ledger?.used ?? 0;
  return {
    allowed: used < quota,
    used,
    quota,
    remaining: Math.max(0, quota - used),
  };
}

