"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import {
  getTopSuppliers,
  getSupplierProfile,
  compareSuppliers,
  type SupplierSummary,
  type SupplierProfileData,
  type SupplierComparisonData,
} from "@/lib/competitor";

export async function getTopSuppliersAction(options: {
  query?: string;
  provinceCode?: string;
  sortBy?: "amount" | "count";
  limit?: number;
}): Promise<{ success: boolean; data?: SupplierSummary[]; error?: string }> {
  try {
    const list = await getTopSuppliers(options);
    return { success: true, data: list };
  } catch (err) {
    console.error("Failed to fetch top suppliers:", err);
    return { success: false, error: "获取供应商排行榜失败" };
  }
}

export async function getSupplierProfileAction(
  name: string
): Promise<{ success: boolean; data?: SupplierProfileData; error?: string }> {
  try {
    const user = await getSession();
    const entitlement = user ? await getEntitlement(user.uid) : null;
    const isPremium =
      user?.role === "ADMIN" ||
      entitlement?.planCode === "GOLD" ||
      entitlement?.planCode === "PLATINUM" ||
      entitlement?.planCode === "ENTERPRISE";

    const profile = await getSupplierProfile(
      name,
      isPremium,
      entitlement?.planCode ?? "FREE",
      user?.uid
    );

    if (!profile) {
      return { success: false, error: "未找到该供应商的中标记录" };
    }

    return { success: true, data: profile };
  } catch (err) {
    console.error("Failed to fetch supplier profile:", err);
    return { success: false, error: "获取供应商画像失败" };
  }
}

export async function trackCompetitorAction(
  supplierName: string
): Promise<{ success: boolean; error?: string; watchId?: number }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后再关注竞对" };
    }

    const trimmed = supplierName.trim();
    if (!trimmed) {
      return { success: false, error: "供应商名称不能为空" };
    }

    const entitlement = await getEntitlement(user.uid);
    if (entitlement.features.pushGroups <= 0) {
      return { success: false, error: "当前套餐不支持关注竞对，请先升级白金版或企业版" };
    }

    // 检查是否已关注
    const existing = await prisma.pushWatch.findFirst({
      where: {
        userId: user.uid,
        keyword: trimmed,
        enabled: true,
      },
    });

    if (existing) {
      return { success: true, watchId: existing.id };
    }

    // 检查当前配额
    const currentCount = await prisma.pushWatch.count({
      where: { userId: user.uid },
    });

    if (currentCount >= entitlement.features.pushGroups) {
      return {
        success: false,
        error: `您已达到订阅上限（当前配额 ${entitlement.features.pushGroups} 条），请前往管理中心整理或升级套餐`,
      };
    }

    const watch = await prisma.pushWatch.create({
      data: {
        userId: user.uid,
        name: `竞对监控: ${trimmed}`,
        keyword: trimmed,
        type: "RESULT",
        frequency: "daily",
        channels: ["email"],
        enabled: true,
      },
    });

    // 联动同步写入 CompetitorWatch
    await prisma.competitorWatch.upsert({
      where: {
        userId_competitorName: {
          userId: user.uid,
          competitorName: trimmed,
        },
      },
      update: { alertOnWin: true },
      create: {
        userId: user.uid,
        competitorName: trimmed,
        tag: "CORE",
      },
    });

    revalidatePath("/watches");
    revalidatePath("/competitors");
    revalidatePath(`/suppliers/${encodeURIComponent(trimmed)}`);

    return { success: true, watchId: watch.id };
  } catch (err) {
    console.error("Failed to track competitor:", err);
    return { success: false, error: "关注竞对失败，请稍后重试" };
  }
}

export async function untrackCompetitorAction(
  supplierName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const trimmed = supplierName.trim();
    await Promise.all([
      prisma.pushWatch.deleteMany({
        where: {
          userId: user.uid,
          keyword: trimmed,
        },
      }),
      prisma.competitorWatch.deleteMany({
        where: {
          userId: user.uid,
          competitorName: trimmed,
        },
      }),
    ]);

    revalidatePath("/watches");
    revalidatePath("/competitors");
    revalidatePath(`/suppliers/${encodeURIComponent(trimmed)}`);

    return { success: true };
  } catch (err) {
    console.error("Failed to untrack competitor:", err);
    return { success: false, error: "取消关注失败" };
  }
}

export async function compareSuppliersAction(
  names: string[]
): Promise<{ success: boolean; data?: SupplierComparisonData; error?: string }> {
  try {
    const user = await getSession();
    const entitlement = user ? await getEntitlement(user.uid) : null;
    const isPremium =
      user?.role === "ADMIN" ||
      entitlement?.planCode === "PLATINUM" ||
      (entitlement?.planCode && entitlement.planCode.startsWith("ENTERPRISE")) ||
      entitlement?.features.contacts === true;

    const data = await compareSuppliers(
      names,
      Boolean(isPremium),
      entitlement?.planCode ?? "FREE"
    );

    if (!data) {
      return { success: false, error: "未找到对比企业的有效招投标数据" };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Failed to compare suppliers:", err);
    return { success: false, error: "同业对比分析失败，请稍后重试" };
  }
}

