"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import {
  getProjectList,
  getProjectDetail,
  type ProjectListItem,
  type ProjectDetailData,
} from "@/lib/project";

export async function getProjectsAction(options: {
  query?: string;
  provinceCode?: string;
  stage?: "all" | "bidding" | "clarifying" | "awarded" | "terminated";
  sortBy?: "latest" | "budget" | "notices";
  page?: number;
  pageSize?: number;
}): Promise<{
  success: boolean;
  data?: {
    projects: ProjectListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    metrics: {
      totalProjects: number;
      biddingCount: number;
      awardedCount: number;
      multiStageCount: number;
      totalBudgetWan: number;
    };
  };
  error?: string;
}> {
  try {
    const res = await getProjectList(options);
    return { success: true, data: res };
  } catch (err) {
    console.error("Failed to fetch projects list:", err);
    return { success: false, error: "获取项目大盘数据失败" };
  }
}

export async function getProjectDetailAction(
  projectId: number
): Promise<{ success: boolean; data?: ProjectDetailData; error?: string }> {
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

    const detail = await getProjectDetail(projectId, userContext);
    if (!detail) {
      return { success: false, error: "未找到该项目主数据" };
    }

    return { success: true, data: detail };
  } catch (err) {
    console.error("Failed to fetch project detail:", err);
    return { success: false, error: "获取项目生命周期详情失败" };
  }
}

export async function trackProjectAction(
  projectId: number
): Promise<{ success: boolean; error?: string; watchId?: number }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后再关注项目动态" };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectNo: true, canonicalTitle: true },
    });

    if (!project) {
      return { success: false, error: "项目不存在" };
    }

    const entitlement = await getEntitlement(user.uid);
    if (entitlement.features.pushGroups <= 0) {
      return { success: false, error: "当前套餐不支持关注项目动态，请升级白金版或企业版" };
    }

    // 优先使用 projectNo 订阅，若无则使用规范化标题前缀
    const keyword = (project.projectNo && project.projectNo.trim()) || project.canonicalTitle.slice(0, 20);

    // 检查是否已关注
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
        name: `项目跟踪: ${project.canonicalTitle.slice(0, 15)}`,
        keyword,
        channels: ["wework", "dingtalk", "email"],
        provinceCode: null,
        type: null,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, watchId: newWatch.id };
  } catch (err) {
    console.error("Failed to track project:", err);
    return { success: false, error: "关注项目失败，请稍后重试" };
  }
}

export async function untrackProjectAction(
  projectId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectNo: true, canonicalTitle: true },
    });

    if (!project) {
      return { success: false, error: "项目不存在" };
    }

    const keyword = (project.projectNo && project.projectNo.trim()) || project.canonicalTitle.slice(0, 20);

    await prisma.pushWatch.deleteMany({
      where: {
        userId: user.uid,
        keyword,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to untrack project:", err);
    return { success: false, error: "取消关注失败，请稍后重试" };
  }
}
