"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import {
  getTopPurchasers,
  getPurchaserProfile,
  type PurchaserSummary,
  type PurchaserProfileData,
} from "@/lib/purchaser";

export async function getTopPurchasersAction(options: {
  query?: string;
  provinceCode?: string;
  sortBy?: "budget" | "count";
  limit?: number;
}): Promise<{ success: boolean; data?: PurchaserSummary[]; error?: string }> {
  try {
    const list = await getTopPurchasers(options);
    return { success: true, data: list };
  } catch (err) {
    console.error("Failed to fetch top purchasers:", err);
    return { success: false, error: "获取采购业主排行榜失败" };
  }
}

export async function getPurchaserProfileAction(
  name: string
): Promise<{ success: boolean; data?: PurchaserProfileData; error?: string }> {
  try {
    const user = await getSession();
    const entitlement = user ? await getEntitlement(user.uid) : null;
    const isPremium =
      user?.role === "ADMIN" ||
      entitlement?.planCode === "GOLD" ||
      entitlement?.planCode === "PLATINUM" ||
      entitlement?.planCode === "ENTERPRISE";

    const profile = await getPurchaserProfile(
      name,
      isPremium,
      entitlement?.planCode ?? "FREE",
      user?.uid
    );

    if (!profile) {
      return { success: false, error: "未找到该采购单位的发包记录" };
    }

    return { success: true, data: profile };
  } catch (err) {
    console.error("Failed to fetch purchaser profile:", err);
    return { success: false, error: "获取采购业主画像失败" };
  }
}

export async function trackPurchaserAction(
  purchaserName: string
): Promise<{ success: boolean; error?: string; watchId?: number }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后再关注采购单位" };
    }

    const trimmed = purchaserName.trim();
    if (!trimmed) {
      return { success: false, error: "采购单位名称不能为空" };
    }

    const entitlement = await getEntitlement(user.uid);
    if (entitlement.features.pushGroups <= 0) {
      return { success: false, error: "当前套餐不支持关注业主，请先升级白金版或企业版" };
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

    // 检查配额
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
        name: `业主监控: ${trimmed}`,
        keyword: trimmed,
        frequency: "daily",
        channels: ["email"],
        enabled: true,
      },
    });

    revalidatePath("/watches");
    revalidatePath(`/purchasers/${encodeURIComponent(trimmed)}`);

    return { success: true, watchId: watch.id };
  } catch (err) {
    console.error("Failed to track purchaser:", err);
    return { success: false, error: "关注采购业主失败，请稍后重试" };
  }
}

export async function untrackPurchaserAction(
  purchaserName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const trimmed = purchaserName.trim();
    await prisma.pushWatch.deleteMany({
      where: {
        userId: user.uid,
        keyword: trimmed,
      },
    });

    revalidatePath("/watches");
    revalidatePath(`/purchasers/${encodeURIComponent(trimmed)}`);

    return { success: true };
  } catch (err) {
    console.error("Failed to untrack purchaser:", err);
    return { success: false, error: "取消关注失败" };
  }
}
