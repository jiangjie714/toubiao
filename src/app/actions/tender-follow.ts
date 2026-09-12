"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type FollowStatus =
  | "EVALUATING"
  | "DECIDED"
  | "DRAFTING"
  | "SUBMITTED"
  | "WON"
  | "LOST";

export type FollowPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type CommentCategory = "GENERAL" | "RISK" | "COMPLIANCE" | "ASSIGNMENT";

export type TenderFollowCommentItem = {
  id: number;
  followId: number;
  userId: number;
  username: string;
  content: string;
  category: CommentCategory;
  createdAt: string;
};

export type TenderFollowItem = {
  id: number;
  tenderId: number;
  userId: number;
  creatorName: string;
  teamId: number | null;
  status: FollowStatus;
  priority: FollowPriority;
  assignee: string | null;
  targetAmount: number | null;
  notes: string | null;
  winRateScore: number | null;
  remindDate: Date | null;
  commentsCount: number;
  comments?: TenderFollowCommentItem[];
  createdAt: Date;
  updatedAt: Date;
  tender: {
    id: number;
    title: string;
    type: string;
    purchaser: string | null;
    budgetAmount: number | null;
    expireDate: Date | null;
    provinceCode: string | null;
    cityCode: string | null;
  };
};

export type TeamMemberOption = {
  userId: number;
  username: string;
  role: string;
  title: string | null;
};

export type TrackerBoardData = {
  items: TenderFollowItem[];
  hasTeam: boolean;
  teamName?: string;
  teamMembers?: TeamMemberOption[];
  currentMode: "team" | "personal";
  stats: {
    totalCount: number;
    totalBudget: number;
    evaluatingCount: number;
    decidedCount: number;
    draftingCount: number;
    submittedCount: number;
    wonCount: number;
    lostCount: number;
  };
};

export async function getTrackerBoardAction(options?: {
  mode?: "team" | "personal";
  assigneeFilter?: string;
}): Promise<{
  success: boolean;
  authenticated: boolean;
  data?: TrackerBoardData;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, authenticated: false, error: "请先登录" };
  }

  try {
    // 1. 查询用户所属团队
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.uid },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { id: true, username: true } },
              },
              orderBy: { joinedAt: "asc" },
            },
          },
        },
      },
    });

    const team = membership?.team;
    const hasTeam = Boolean(team);
    const requestedMode = options?.mode || (hasTeam ? "team" : "personal");

    const teamMembers: TeamMemberOption[] = (team?.members ?? []).map((m) => ({
      userId: m.userId,
      username: m.user.username,
      role: m.role,
      title: m.title,
    }));

    // 2. 构造查询条件
    const whereClause: Record<string, unknown> = {};

    if (hasTeam && requestedMode === "team") {
      whereClause.teamId = team!.id;
      if (options?.assigneeFilter && options.assigneeFilter !== "ALL") {
        whereClause.assignee = options.assigneeFilter;
      }
    } else {
      whereClause.userId = session.uid;
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
            provinceCode: true,
            cityCode: true,
          },
        },
        comments: {
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const items: TenderFollowItem[] = records.map((r) => ({
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
      commentsCount: r._count.comments,
      comments: r.comments.map((c) => ({
        id: c.id,
        followId: c.followId,
        userId: c.userId,
        username: c.user.username,
        content: c.content,
        category: c.category as CommentCategory,
        createdAt: c.createdAt.toISOString(),
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      tender: {
        id: r.tender.id,
        title: r.tender.title,
        type: r.tender.type,
        purchaser: r.tender.purchaser,
        budgetAmount: r.tender.budgetAmount ? Number(r.tender.budgetAmount) : null,
        expireDate: r.tender.expireDate,
        provinceCode: r.tender.provinceCode,
        cityCode: r.tender.cityCode,
      },
    }));

    let totalBudget = 0;
    let evaluatingCount = 0;
    let decidedCount = 0;
    let draftingCount = 0;
    let submittedCount = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const item of items) {
      if (item.tender.budgetAmount) {
        totalBudget += item.tender.budgetAmount;
      }
      if (item.status === "EVALUATING") evaluatingCount++;
      else if (item.status === "DECIDED") decidedCount++;
      else if (item.status === "DRAFTING") draftingCount++;
      else if (item.status === "SUBMITTED") submittedCount++;
      else if (item.status === "WON") wonCount++;
      else if (item.status === "LOST") lostCount++;
    }

    return {
      success: true,
      authenticated: true,
      data: {
        items,
        hasTeam,
        teamName: team?.name,
        teamMembers,
        currentMode: requestedMode,
        stats: {
          totalCount: items.length,
          totalBudget: Math.round(totalBudget * 100) / 100,
          evaluatingCount,
          decidedCount,
          draftingCount,
          submittedCount,
          wonCount,
          lostCount,
        },
      },
    };
  } catch (err) {
    console.error("Failed to get tracker board:", err);
    return { success: false, authenticated: true, error: "获取跟进看板失败" };
  }
}

export async function getTenderFollowStatusAction(tenderId: number) {
  const session = await getSession();
  if (!session) return { following: false, record: null };

  const record = await prisma.tenderFollow.findUnique({
    where: {
      userId_tenderId: {
        userId: session.uid,
        tenderId,
      },
    },
  });

  return {
    following: Boolean(record),
    record: record
      ? {
          id: record.id,
          status: record.status as FollowStatus,
          priority: record.priority as FollowPriority,
          assignee: record.assignee,
          targetAmount: record.targetAmount ? Number(record.targetAmount) : null,
          notes: record.notes,
        }
      : null,
  };
}

export async function saveTenderFollowAction(data: {
  tenderId: number;
  status: FollowStatus;
  priority?: FollowPriority;
  assignee?: string;
  targetAmount?: number;
  notes?: string;
  winRateScore?: number;
}) {
  const session = await getSession();
  if (!session) return { success: false, error: "请先登录" };

  try {
    // 获取所属团队
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.uid },
    });
    const teamId = membership?.teamId ?? null;

    await prisma.tenderFollow.upsert({
      where: {
        userId_tenderId: {
          userId: session.uid,
          tenderId: data.tenderId,
        },
      },
      update: {
        status: data.status,
        priority: data.priority || "NORMAL",
        assignee: data.assignee || null,
        targetAmount: data.targetAmount || null,
        notes: data.notes || null,
        winRateScore: data.winRateScore || null,
        teamId,
      },
      create: {
        userId: session.uid,
        tenderId: data.tenderId,
        status: data.status,
        priority: data.priority || "NORMAL",
        assignee: data.assignee || null,
        targetAmount: data.targetAmount || null,
        notes: data.notes || null,
        winRateScore: data.winRateScore || null,
        teamId,
      },
    });

    revalidatePath(`/tender/${data.tenderId}`);
    revalidatePath("/tracker");
    return { success: true };
  } catch (err) {
    console.error("Failed to save tender follow:", err);
    return { success: false, error: "保存跟进失败" };
  }
}

export async function updateFollowStatusAction(
  followId: number,
  status: FollowStatus,
) {
  const session = await getSession();
  if (!session) return { success: false, error: "请先登录" };

  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.uid },
    });
    const userTeamId = membership?.teamId;

    // 允许创建者或同一团队成员更新状态
    const follow = await prisma.tenderFollow.findUnique({
      where: { id: followId },
    });

    if (!follow) {
      return { success: false, error: "跟进记录不存在" };
    }

    const canUpdate =
      follow.userId === session.uid ||
      (userTeamId && follow.teamId === userTeamId);

    if (!canUpdate) {
      return { success: false, error: "无权修改该标段跟进状态" };
    }

    await prisma.tenderFollow.update({
      where: { id: followId },
      data: { status },
    });

    revalidatePath("/tracker");
    return { success: true };
  } catch (err) {
    console.error("Failed to update follow status:", err);
    return { success: false, error: "更新状态失败" };
  }
}

export async function assignFollowMemberAction(
  followId: number,
  assigneeUsername: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "请先登录" };

  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.uid },
    });
    const userTeamId = membership?.teamId;

    const follow = await prisma.tenderFollow.findUnique({
      where: { id: followId },
    });

    if (!follow) {
      return { success: false, error: "跟进记录不存在" };
    }

    const canAssign =
      follow.userId === session.uid ||
      (userTeamId && follow.teamId === userTeamId);

    if (!canAssign) {
      return { success: false, error: "无权指派跟进负责人" };
    }

    const cleanAssignee = assigneeUsername.trim();

    await prisma.$transaction(async (tx) => {
      await tx.tenderFollow.update({
        where: { id: followId },
        data: { assignee: cleanAssignee || null },
      });

      if (cleanAssignee) {
        await tx.tenderFollowComment.create({
          data: {
            followId,
            userId: session.uid,
            category: "ASSIGNMENT",
            content: `已将跟进责任人指派给: @${cleanAssignee}`,
          },
        });
      }
    });

    revalidatePath("/tracker");
    return { success: true };
  } catch (err) {
    console.error("Failed to assign member:", err);
    return { success: false, error: "指派失败" };
  }
}

export async function addFollowCommentAction(params: {
  followId: number;
  content: string;
  category: CommentCategory;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "请先登录" };

  try {
    const cleanContent = params.content.trim();
    if (!cleanContent) {
      return { success: false, error: "请输入批注内容" };
    }

    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.uid },
    });
    const userTeamId = membership?.teamId;

    const follow = await prisma.tenderFollow.findUnique({
      where: { id: params.followId },
    });

    if (!follow) {
      return { success: false, error: "跟进记录不存在" };
    }

    const canComment =
      follow.userId === session.uid ||
      (userTeamId && follow.teamId === userTeamId);

    if (!canComment) {
      return { success: false, error: "无权添加协同批注" };
    }

    await prisma.tenderFollowComment.create({
      data: {
        followId: params.followId,
        userId: session.uid,
        category: params.category || "GENERAL",
        content: cleanContent,
      },
    });

    // 触发 updated_at 更新
    await prisma.tenderFollow.update({
      where: { id: params.followId },
      data: { updatedAt: new Date() },
    });

    revalidatePath("/tracker");
    return { success: true };
  } catch (err) {
    console.error("Failed to add comment:", err);
    return { success: false, error: "发表批注失败" };
  }
}

export async function deleteFollowAction(followId: number) {
  const session = await getSession();
  if (!session) return { success: false, error: "请先登录" };

  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.uid },
    });
    const isOwner = membership?.role === "OWNER";

    const follow = await prisma.tenderFollow.findUnique({
      where: { id: followId },
    });

    if (!follow) {
      return { success: false, error: "记录不存在" };
    }

    if (follow.userId !== session.uid && !isOwner) {
      return { success: false, error: "仅标段创建者或团队负责人可移出看板" };
    }

    await prisma.tenderFollow.delete({
      where: { id: followId },
    });

    revalidatePath("/tracker");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete follow:", err);
    return { success: false, error: "移除失败" };
  }
}
