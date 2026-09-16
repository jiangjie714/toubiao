"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  analyzePipelineCrm,
  type PipelineCrmOverview,
  type RawDealItem,
} from "@/lib/pipeline-crm";
import type { FollowStatus, FollowPriority } from "@/app/actions/tender-follow";

export interface PipelineFilterOptions {
  mode?: "team" | "personal";
  timeSpan?: "ALL" | "MONTH" | "QUARTER" | "YEAR";
  assignee?: string;
}

export async function getPipelineCrmDataAction(
  options: PipelineFilterOptions = {}
): Promise<{
  success: boolean;
  data?: PipelineCrmOverview & {
    currentMode: "team" | "personal";
    hasTeam: boolean;
    teamName?: string;
    teamMembers: Array<{ userId: number; username: string; role: string }>;
  };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "未登录或登录状态已过期" };
    }

    // 检查团队信息
    const team = await prisma.team.findFirst({
      where: {
        OR: [
          { ownerId: session.uid },
          { members: { some: { userId: session.uid } } },
        ],
      },
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    const hasTeam = !!team;
    const requestedMode = options.mode || (hasTeam ? "team" : "personal");

    const teamMembers: Array<{ userId: number; username: string; role: string }> = [];
    if (team) {
      teamMembers.push({
        userId: team.owner.id,
        username: team.owner.username,
        role: "OWNER",
      });
      for (const m of team.members) {
        if (m.user.id !== team.owner.id) {
          teamMembers.push({
            userId: m.user.id,
            username: m.user.username,
            role: m.role,
          });
        }
      }
    }

    const whereClause: Record<string, unknown> = {};

    if (hasTeam && requestedMode === "team") {
      whereClause.teamId = team.id;
    } else {
      whereClause.userId = session.uid;
    }

    // 时间范围筛选
    if (options.timeSpan && options.timeSpan !== "ALL") {
      const now = new Date();
      let filterStartDate: Date;
      if (options.timeSpan === "MONTH") {
        filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (options.timeSpan === "QUARTER") {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        filterStartDate = new Date(now.getFullYear(), quarterStartMonth, 1);
      } else {
        // YEAR
        filterStartDate = new Date(now.getFullYear(), 0, 1);
      }
      whereClause.createdAt = { gte: filterStartDate };
    }

    if (options.assignee && options.assignee !== "ALL") {
      if (options.assignee === "OPEN_POOL") {
        whereClause.OR = [{ assignee: null }, { assignee: "" }, { assignee: "公海池" }];
      } else {
        whereClause.assignee = options.assignee;
      }
    }

    const records = await prisma.tenderFollow.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true } },
        tender: {
          select: {
            id: true,
            title: true,
            type: true,
            purchaser: true,
            budgetAmount: true,
            expireDate: true,
            publishDate: true,
            provinceCode: true,
            cityCode: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const deals: RawDealItem[] = records.map((r) => ({
      id: r.id,
      tenderId: r.tenderId,
      userId: r.userId,
      creatorName: r.user.username,
      teamId: r.teamId,
      status: r.status as FollowStatus,
      priority: r.priority as FollowPriority,
      assignee: r.assignee,
      targetAmount: r.targetAmount ? Number(r.targetAmount) : null,
      notes: r.notes,
      winRateScore: r.winRateScore,
      remindDate: r.remindDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      tender: {
        id: r.tender.id,
        title: r.tender.title,
        type: r.tender.type,
        purchaser: r.tender.purchaser,
        budgetAmount: r.tender.budgetAmount ? Number(r.tender.budgetAmount) : null,
        expireDate: r.tender.expireDate,
        publishDate: r.tender.publishDate,
        provinceCode: r.tender.provinceCode,
        cityCode: r.tender.cityCode,
      },
    }));

    const analysis = analyzePipelineCrm(deals);

    return {
      success: true,
      data: {
        ...analysis,
        currentMode: requestedMode,
        hasTeam,
        teamName: team?.name,
        teamMembers,
      },
    };
  } catch (error) {
    console.error("Failed to load pipeline CRM data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取销售 CRM 数据失败",
    };
  }
}

/**
 * 认领公海池商机
 */
export async function claimPublicDealAction(followId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "未登录" };

    const follow = await prisma.tenderFollow.findUnique({
      where: { id: followId },
    });
    if (!follow) return { success: false, error: "商机不存在" };

    await prisma.tenderFollow.update({
      where: { id: followId },
      data: {
        assignee: session.name || session.username,
      },
    });

    // 记录认领批注
    await prisma.tenderFollowComment.create({
      data: {
        followId,
        userId: session.uid,
        category: "ASSIGNMENT",
        content: `【商机公海认领】用户 ${session.name || session.username} 从公海池认领了该商机并成为第一负责人。`,
      },
    });

    revalidatePath("/pipeline");
    revalidatePath("/tracker");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "认领商机失败",
    };
  }
}

/**
 * 退回公海池
 */
export async function returnToPublicPoolAction(
  followId: number,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "未登录" };

    await prisma.tenderFollow.update({
      where: { id: followId },
      data: {
        assignee: null,
      },
    });

    await prisma.tenderFollowComment.create({
      data: {
        followId,
        userId: session.uid,
        category: "ASSIGNMENT",
        content: `【退回公海】${session.name || session.username} 将该商机退回团队公海池。${reason ? `理由: ${reason}` : ""}`,
      },
    });

    revalidatePath("/pipeline");
    revalidatePath("/tracker");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "退回公海失败",
    };
  }
}

/**
 * 快速更新商机商业目标与赢率
 */
export async function updateDealCommercialAction(
  followId: number,
  params: {
    targetAmount?: number;
    winRateScore?: number;
    status?: FollowStatus;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "未登录" };

    const data: Record<string, unknown> = {};
    if (typeof params.targetAmount === "number") data.targetAmount = params.targetAmount;
    if (typeof params.winRateScore === "number") data.winRateScore = params.winRateScore;
    if (params.status) data.status = params.status;
    if (typeof params.notes === "string") data.notes = params.notes;

    await prisma.tenderFollow.update({
      where: { id: followId },
      data,
    });

    revalidatePath("/pipeline");
    revalidatePath("/tracker");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新商机失败",
    };
  }
}
