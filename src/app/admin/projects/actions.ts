"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  reaggregateOrphanTenders,
  arbitrateProject,
  mergeProjects,
  detachTenderFromProject,
  type ReaggregateResult,
} from "@/lib/project-arbitration";

export async function reaggregateOrphansAction(): Promise<{
  success: boolean;
  data?: ReaggregateResult;
  error?: string;
}> {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "无权限执行此操作" };
  }

  try {
    const result = await reaggregateOrphanTenders();
    revalidatePath("/admin/projects");
    revalidatePath("/projects");
    return { success: true, data: result };
  } catch (error) {
    console.error("reaggregateOrphansAction error:", error);
    return { success: false, error: (error as Error).message || "批量重扫归集失败" };
  }
}

export async function mergeProjectsAction(
  sourceProjectId: number,
  targetProjectId: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "无权限执行此操作" };
  }

  try {
    const res = await mergeProjects(sourceProjectId, targetProjectId, user.name);
    revalidatePath("/admin/projects");
    revalidatePath("/projects");
    return { success: true, message: res.message };
  } catch (error) {
    console.error("mergeProjectsAction error:", error);
    return { success: false, error: (error as Error).message || "合并项目失败" };
  }
}

export async function detachTenderAction(
  tenderId: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "无权限执行此操作" };
  }

  try {
    const res = await detachTenderFromProject(tenderId, user.name);
    revalidatePath("/admin/projects");
    revalidatePath("/projects");
    return { success: true, message: res.message };
  } catch (error) {
    console.error("detachTenderAction error:", error);
    return { success: false, error: (error as Error).message || "拆分标讯失败" };
  }
}

export async function refreshProjectArbitrationAction(
  projectId: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "无权限执行此操作" };
  }

  try {
    const res = await arbitrateProject(projectId);
    revalidatePath("/admin/projects");
    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      message: `项目仲裁刷新成功！关联公告 ${res.noticesCount} 篇，当前阶段：${res.stage}`,
    };
  } catch (error) {
    console.error("refreshProjectArbitrationAction error:", error);
    return { success: false, error: (error as Error).message || "刷新项目仲裁失败" };
  }
}
