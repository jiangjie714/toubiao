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

export async function consumeSearchQuota(
  userId: number,
  options: { isAdmin?: boolean } = {},
): Promise<QuotaResult> {
  const entitlement = await getEntitlement(userId);
  if (options.isAdmin || entitlement.features.searchQuota >= 10000) {
    return { allowed: true, used: 0, quota: Infinity, remaining: Infinity };
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

export async function getSearchQuota(userId: number): Promise<QuotaResult> {
  const entitlement = await getEntitlement(userId);
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

