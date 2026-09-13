"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import {
  getIndustryList,
  getIndustryDossier,
  INDUSTRY_META,
  type IndustrySummary,
  type IndustryDossierData,
} from "@/lib/industry";

export async function getIndustryListAction(): Promise<{
  success: boolean;
  data?: IndustrySummary[];
  error?: string;
}> {
  try {
    const list = await getIndustryList();
    return { success: true, data: list };
  } catch (err) {
    console.error("Failed to fetch industry list:", err);
    return { success: false, error: "获取行业赛道列表失败" };
  }
}

export async function getIndustryDossierAction(
  code: string
): Promise<{ success: boolean; data?: IndustryDossierData; error?: string }> {
  try {
    const user = await getSession();
    let userContext: { id: number; role: string; planCode: string; teamId?: number | null } | null = null;

    if (user) {
      const entitlement = await getEntitlement(user.uid);
      const dbUser = await prisma.user.findUnique({
        where: { id: user.uid },
        select: { teamMembership: { select: { teamId: true } } },
      });

      userContext = {
        id: user.uid,
        role: user.role,
        planCode: entitlement.planCode,
        teamId: dbUser?.teamMembership?.teamId ?? null,
      };
    }

    const dossier = await getIndustryDossier(code, userContext);
    if (!dossier) {
      return { success: false, error: "未找到该垂直行业赛道情报" };
    }

    return { success: true, data: dossier };
  } catch (err) {
    console.error("Failed to fetch industry dossier:", err);
    return { success: false, error: "获取赛道深度情报大盘失败" };
  }
}

export async function trackIndustryAction(
  code: string
): Promise<{ success: boolean; error?: string; watchId?: number }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后再订阅行业赛道周报" };
    }

    const meta = INDUSTRY_META[code];
    if (!meta) {
      return { success: false, error: "未知赛道分类" };
    }

    const entitlement = await getEntitlement(user.uid);
    if (entitlement.features.pushGroups <= 0) {
      return { success: false, error: "当前套餐不支持订阅行业周报，请升级白金版或企业版" };
    }

    const keyword = meta.name.slice(0, 10);

    const existing = await prisma.pushWatch.findFirst({
      where: {
        userId: user.uid,
        keyword,
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
        name: `行业赛道周报: ${meta.name}`,
        keyword,
        channels: ["wework", "dingtalk", "email"],
        provinceCode: null,
        type: null,
      },
    });

    revalidatePath(`/industries/${code}`);
    return { success: true, watchId: newWatch.id };
  } catch (err) {
    console.error("Failed to track industry:", err);
    return { success: false, error: "订阅失败，请稍后重试" };
  }
}

export async function untrackIndustryAction(
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const meta = INDUSTRY_META[code];
    if (!meta) return { success: false, error: "未知赛道" };

    const keyword = meta.name.slice(0, 10);

    await prisma.pushWatch.deleteMany({
      where: {
        userId: user.uid,
        keyword,
      },
    });

    revalidatePath(`/industries/${code}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to untrack industry:", err);
    return { success: false, error: "取消订阅失败" };
  }
}
