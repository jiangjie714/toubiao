"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import {
  getCompetitorRadarOverview,
  getCompetitorActivityFeed,
  getHeadToHeadAnalysis,
  generateCompetitorBriefingMarkdown,
  type CompetitorTag,
  type CompetitorRadarOverview,
  type CompetitorFeedItem,
  type HeadToHeadReport,
} from "@/lib/competitor-radar";

export async function addCompetitorWatchAction(data: {
  competitorName: string;
  tag?: CompetitorTag;
  notes?: string;
  alertOnWin?: boolean;
  alertOnEncroachment?: boolean;
}): Promise<{ success: boolean; error?: string; watchId?: number }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后再添加监控对手" };
    }

    const trimmed = data.competitorName?.trim();
    if (!trimmed || trimmed.length < 2) {
      return { success: false, error: "请输入有效的竞争对手企业全称（不少于2个字）" };
    }

    const entitlement = await getEntitlement(user.uid);
    // 配额校验：根据会员套餐获取配额
    const allowedWatches = entitlement.features.pushGroups > 0 ? entitlement.features.pushGroups * 2 : 5;
    const currentCount = await prisma.competitorWatch.count({
      where: { userId: user.uid },
    });

    if (currentCount >= allowedWatches) {
      return {
        success: false,
        error: `您当前关注对手已达上限（${allowedWatches} 家），请升级套餐或清理已有监控`,
      };
    }

    const existing = await prisma.competitorWatch.findFirst({
      where: {
        userId: user.uid,
        competitorName: trimmed,
      },
    });

    if (existing) {
      return { success: false, error: `您已关注过对手「${trimmed}」，请勿重复添加` };
    }

    const watch = await prisma.competitorWatch.create({
      data: {
        userId: user.uid,
        competitorName: trimmed,
        tag: data.tag || "CORE",
        notes: data.notes?.trim() || null,
        alertOnWin: data.alertOnWin !== undefined ? data.alertOnWin : true,
        alertOnEncroachment:
          data.alertOnEncroachment !== undefined ? data.alertOnEncroachment : true,
      },
    });

    revalidatePath("/competitors");
    revalidatePath("/suppliers");
    return { success: true, watchId: watch.id };
  } catch (err) {
    console.error("Failed to add competitor watch:", err);
    return { success: false, error: "添加竞争对手失败，请稍后重试" };
  }
}

export async function removeCompetitorWatchAction(
  watchId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const watch = await prisma.competitorWatch.findUnique({
      where: { id: watchId },
    });

    if (!watch || watch.userId !== user.uid) {
      return { success: false, error: "监控记录不存在或无权操作" };
    }

    await prisma.competitorWatch.delete({
      where: { id: watchId },
    });

    revalidatePath("/competitors");
    revalidatePath("/suppliers");
    return { success: true };
  } catch (err) {
    console.error("Failed to remove competitor watch:", err);
    return { success: false, error: "取消监控失败" };
  }
}

export async function updateCompetitorWatchAction(
  watchId: number,
  data: {
    tag?: CompetitorTag;
    notes?: string;
    alertOnWin?: boolean;
    alertOnEncroachment?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const watch = await prisma.competitorWatch.findUnique({
      where: { id: watchId },
    });

    if (!watch || watch.userId !== user.uid) {
      return { success: false, error: "监控记录不存在或无权操作" };
    }

    await prisma.competitorWatch.update({
      where: { id: watchId },
      data: {
        tag: data.tag,
        notes: data.notes !== undefined ? data.notes.trim() : undefined,
        alertOnWin: data.alertOnWin,
        alertOnEncroachment: data.alertOnEncroachment,
      },
    });

    revalidatePath("/competitors");
    return { success: true };
  } catch (err) {
    console.error("Failed to update competitor watch:", err);
    return { success: false, error: "更新监控设置失败" };
  }
}

export async function getCompetitorRadarOverviewAction(): Promise<{
  success: boolean;
  data?: CompetitorRadarOverview;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后再查看竞对雷达" };
    }

    const data = await getCompetitorRadarOverview(user.uid);
    return { success: true, data };
  } catch (err) {
    console.error("Failed to get competitor radar overview:", err);
    return { success: false, error: "获取竞对雷达大盘数据失败" };
  }
}

export async function getCompetitorFeedAction(options?: {
  competitorName?: string;
  limit?: number;
  offset?: number;
  onlyAlerts?: boolean;
}): Promise<{ success: boolean; data?: CompetitorFeedItem[]; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const data = await getCompetitorActivityFeed(user.uid, options);
    return { success: true, data };
  } catch (err) {
    console.error("Failed to fetch competitor feeds:", err);
    return { success: false, error: "获取竞对异动动态失败" };
  }
}

export async function getHeadToHeadAction(
  competitorName: string
): Promise<{ success: boolean; data?: HeadToHeadReport; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const trimmed = competitorName.trim();
    if (!trimmed) {
      return { success: false, error: "请指定竞对企业名称" };
    }

    const data = await getHeadToHeadAnalysis(user.uid, trimmed);
    return { success: true, data };
  } catch (err) {
    console.error("Failed to calculate head-to-head confrontation:", err);
    return { success: false, error: "同场交锋分析失败" };
  }
}

export async function exportCompetitorBriefingAction(): Promise<{
  success: boolean;
  content?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const overview = await getCompetitorRadarOverview(user.uid);
    const md = generateCompetitorBriefingMarkdown(overview, user.name || user.username);
    const fileName = `竞对态势战略攻防简报_${new Date().toISOString().split("T")[0]}.md`;

    return { success: true, content: md, fileName };
  } catch (err) {
    console.error("Failed to export competitor briefing:", err);
    return { success: false, error: "导出竞对战略简报失败" };
  }
}
