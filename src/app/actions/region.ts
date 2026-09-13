"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { getRegionList, getRegionDossier, type RegionSummary, type RegionDossierData } from "@/lib/region";

export async function getRegionListAction(): Promise<{
  success: boolean;
  data?: RegionSummary[];
  error?: string;
}> {
  try {
    const list = await getRegionList();
    return { success: true, data: list };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取区域列表失败",
    };
  }
}

export async function getRegionDossierAction(
  code: string
): Promise<{ success: boolean; data?: RegionDossierData | null; error?: string }> {
  try {
    const user = await getSession();
    const data = await getRegionDossier(
      code,
      user ? { id: user.uid, role: user.role } : null
    );
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取区域画像失败",
    };
  }
}

export async function trackRegionAction(
  code: string
): Promise<{ success: boolean; error?: string; watchId?: number }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后再订阅区域招投标商机" };
    }

    const province = await prisma.region.findFirst({
      where: { code, level: 1 },
      select: { name: true },
    });
    if (!province) {
      return { success: false, error: "未知行政区划" };
    }

    const entitlement = await getEntitlement(user.uid);
    if (entitlement.features.pushGroups <= 0) {
      return { success: false, error: "当前套餐不支持订阅区域推送，请升级白金版或企业版" };
    }

    const keyword = `[战区] ${province.name}`;

    const existing = await prisma.pushWatch.findFirst({
      where: {
        userId: user.uid,
        provinceCode: code,
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

    const newWatch = await prisma.pushWatch.create({
      data: {
        userId: user.uid,
        name: `区域商机周报: ${province.name}`,
        keyword,
        provinceCode: code,
        channels: ["wework", "dingtalk", "email"],
        type: null,
      },
    });

    revalidatePath(`/regions/${code}`);
    return { success: true, watchId: newWatch.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "订阅区域失败",
    };
  }
}

export async function untrackRegionAction(
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    await prisma.pushWatch.updateMany({
      where: {
        userId: user.uid,
        provinceCode: code,
      },
      data: {
        enabled: false,
      },
    });

    revalidatePath(`/regions/${code}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "取消订阅失败",
    };
  }
}
