"use server";

import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import {
  getMarketOverview,
  getWeeklyBriefData,
  type MarketOverviewData,
  type WeeklyBriefData,
} from "@/lib/analytics";

export interface MarketIntelligenceResult {
  success: boolean;
  error?: string;
  isPremium?: boolean;
  planCode?: string;
  data?: MarketOverviewData & {
    isPremium: boolean;
    planCode: string;
    lockedPurchasersCount: number;
    lockedSuppliersCount: number;
  };
}

export async function getMarketIntelligenceAction(options: {
  days?: number;
  provinceCode?: string;
}): Promise<MarketIntelligenceResult> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后查看行业情报大盘" };
    }

    const entitlement = await getEntitlement(user.uid);
    const isPremium =
      user.role === "ADMIN" ||
      entitlement.planCode === "GOLD" ||
      entitlement.planCode === "PLATINUM" ||
      entitlement.planCode === "ENTERPRISE";

    // 免费用户默认只允许查看近 7 天大盘，更长周期需要黄金版及以上
    const requestedDays = options.days ?? 30;
    const effectiveDays = isPremium ? requestedDays : Math.min(requestedDays, 7);

    const rawOverview = await getMarketOverview(effectiveDays, options.provinceCode);

    if (!isPremium) {
      // 免费版脱敏与锁定逻辑：前 3 项公开，第 4 项起打码脱敏
      const maskedPurchasers = rawOverview.topPurchasers.map((item, idx) => {
        if (idx < 3) return { ...item, isLocked: false };
        const name = item.purchaser;
        const masked =
          name.length > 4
            ? `${name.slice(0, 2)}****${name.slice(-2)}`
            : `${name.slice(0, 1)}***`;
        return {
          ...item,
          purchaser: masked,
          isLocked: true,
        };
      });

      const maskedSuppliers = rawOverview.topSuppliers.map((item, idx) => {
        if (idx < 3) return { ...item, isLocked: false };
        const name = item.supplier;
        const masked =
          name.length > 4
            ? `${name.slice(0, 2)}****${name.slice(-2)}`
            : `${name.slice(0, 1)}***`;
        return {
          ...item,
          supplier: masked,
          isLocked: true,
        };
      });

      const maskedBudgetProjects = rawOverview.topBudgetTenders.map((item, idx) => {
        if (idx < 2) return { ...item, isLocked: false };
        return {
          ...item,
          title: `${item.title.slice(0, 6)}...（升级白金版查看亿元标王详情）`,
          isLocked: true,
        };
      });

      return {
        success: true,
        isPremium: false,
        planCode: entitlement.planCode,
        data: {
          ...rawOverview,
          topPurchasers: maskedPurchasers,
          topSuppliers: maskedSuppliers,
          topBudgetTenders: maskedBudgetProjects,
          isPremium: false,
          planCode: entitlement.planCode,
          lockedPurchasersCount: Math.max(0, rawOverview.topPurchasers.length - 3),
          lockedSuppliersCount: Math.max(0, rawOverview.topSuppliers.length - 3),
        },
      };
    }

    // 付费会员/管理员：完整穿透
    return {
      success: true,
      isPremium: true,
      planCode: entitlement.planCode,
      data: {
        ...rawOverview,
        isPremium: true,
        planCode: entitlement.planCode,
        lockedPurchasersCount: 0,
        lockedSuppliersCount: 0,
      },
    };
  } catch (err) {
    console.error("Failed to get market intelligence:", err);
    return { success: false, error: "加载大盘数据失败，请稍后重试" };
  }
}

export async function getWeeklyBriefAction(): Promise<{
  success: boolean;
  error?: string;
  data?: WeeklyBriefData;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后生成商机周报" };
    }

    const data = await getWeeklyBriefData(user.uid);
    return { success: true, data };
  } catch (err) {
    console.error("Failed to get weekly brief:", err);
    return { success: false, error: "生成周报失败，请稍后重试" };
  }
}
