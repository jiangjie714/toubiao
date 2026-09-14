"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assembleFullProposalPackage,
  exportFullProposalMarkdown,
  type AssembleInput,
  type VolumeId,
  type ProposalProjectData,
  type AssembledVolumeItem,
} from "@/lib/proposal-assembler";
import { runDeepBidAudit } from "@/lib/audit-manager";

export interface ProposalProjectListItem {
  id: number;
  title: string;
  status: string;
  targetPurchaser: string | null;
  bidAmountWan: number | null;
  projectDuration: string | null;
  tenderId: number | null;
  followId: number | null;
  createdAt: string;
  updatedAt: string;
  volumesCount: number;
}

export async function getProposalProjectsAction(): Promise<{
  success: boolean;
  projects?: ProposalProjectListItem[];
  userFollows?: Array<{ id: number; tenderId: number; title: string; purchaser: string | null }>;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const [projects, follows] = await Promise.all([
      prisma.proposalProject.findMany({
        where: { userId: user.uid },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tenderFollow.findMany({
        where: { userId: user.uid },
        include: {
          tender: {
            select: { id: true, title: true, purchaser: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const formattedProjects: ProposalProjectListItem[] = projects.map((p) => {
      let vols: unknown[] = [];
      try {
        vols = Array.isArray(p.assembledVolumes)
          ? p.assembledVolumes
          : JSON.parse(p.assembledVolumes as string);
      } catch {
        vols = [];
      }

      return {
        id: p.id,
        title: p.title,
        status: p.status,
        targetPurchaser: p.targetPurchaser,
        bidAmountWan: p.bidAmountWan,
        projectDuration: p.projectDuration,
        tenderId: p.tenderId,
        followId: p.followId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        volumesCount: vols.length,
      };
    });

    const formattedFollows = follows
      .filter((f) => f.tender !== null)
      .map((f) => ({
        id: f.id,
        tenderId: f.tender!.id,
        title: f.tender!.title,
        purchaser: f.tender!.purchaser,
      }));

    return {
      success: true,
      projects: formattedProjects,
      userFollows: formattedFollows,
    };
  } catch (err) {
    console.error("Failed to load proposal projects:", err);
    return { success: false, error: "加载标书装配工程列表失败" };
  }
}

export async function createProposalProjectAction(
  input: AssembleInput
): Promise<{ success: boolean; projectId?: number; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    // 1. 运行装配引擎
    const assembled = await assembleFullProposalPackage(user.uid, input);

    // 2. 存入数据库
    const record = await prisma.proposalProject.create({
      data: {
        userId: user.uid,
        tenderId: input.tenderId || null,
        followId: input.followId || null,
        title: assembled.title,
        status: "COMPLETED",
        targetPurchaser: assembled.targetPurchaser,
        bidAmountWan: assembled.bidAmountWan,
        projectDuration: assembled.projectDuration,
        assembledVolumes: assembled.volumes as unknown as object,
      },
    });

    revalidatePath("/proposals");
    return { success: true, projectId: record.id };
  } catch (err) {
    console.error("Failed to assemble proposal project:", err);
    return { success: false, error: "装配标书工程失败，请稍后重试" };
  }
}

export async function getProposalProjectDetailAction(
  id: number
): Promise<{ success: boolean; data?: ProposalProjectData; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const p = await prisma.proposalProject.findUnique({
      where: { id },
    });

    if (!p || p.userId !== user.uid) {
      return { success: false, error: "未找到该标书装配工程或无权访问" };
    }

    let volumes: AssembledVolumeItem[] = [];
    try {
      volumes = Array.isArray(p.assembledVolumes)
        ? (p.assembledVolumes as unknown as AssembledVolumeItem[])
        : JSON.parse(p.assembledVolumes as string);
    } catch {
      volumes = [];
    }

    const readyCount = volumes.filter((v) => v.isReady).length;
    const completionRate =
      volumes.length > 0 ? Math.round((readyCount / volumes.length) * 100) : 0;

    return {
      success: true,
      data: {
        id: p.id,
        title: p.title,
        status: p.status as "DRAFT" | "COMPLETED" | "AUDITED",
        targetPurchaser: p.targetPurchaser,
        bidAmountWan: p.bidAmountWan,
        projectDuration: p.projectDuration,
        tenderId: p.tenderId,
        followId: p.followId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        volumes,
        completionRate,
      },
    };
  } catch (err) {
    console.error("Failed to load proposal project detail:", err);
    return { success: false, error: "获取标书装配详情失败" };
  }
}

export async function updateProposalVolumeAction(
  projectId: number,
  volumeId: VolumeId,
  contentMarkdown: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const p = await prisma.proposalProject.findUnique({
      where: { id: projectId },
    });

    if (!p || p.userId !== user.uid) {
      return { success: false, error: "无权修改该标书工程" };
    }

    let volumes: AssembledVolumeItem[] = [];
    try {
      volumes = Array.isArray(p.assembledVolumes)
        ? (p.assembledVolumes as unknown as AssembledVolumeItem[])
        : JSON.parse(p.assembledVolumes as string);
    } catch {
      volumes = [];
    }

    const updatedVolumes = volumes.map((v) =>
      v.volumeId === volumeId
        ? { ...v, contentMarkdown, isReady: contentMarkdown.trim().length > 20 }
        : v
    );

    await prisma.proposalProject.update({
      where: { id: projectId },
      data: {
        assembledVolumes: updatedVolumes as unknown as object,
      },
    });

    revalidatePath("/proposals");
    return { success: true };
  } catch (err) {
    console.error("Failed to update proposal volume:", err);
    return { success: false, error: "更新分卷内容失败" };
  }
}

export async function deleteProposalProjectAction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const p = await prisma.proposalProject.findUnique({ where: { id } });
    if (!p || p.userId !== user.uid) {
      return { success: false, error: "记录不存在或无权操作" };
    }

    await prisma.proposalProject.delete({ where: { id } });
    revalidatePath("/proposals");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete proposal project:", err);
    return { success: false, error: "删除标书工程失败" };
  }
}

export async function exportProposalMarkdownAction(
  id: number
): Promise<{ success: boolean; content?: string; fileName?: string; error?: string }> {
  try {
    const detail = await getProposalProjectDetailAction(id);
    if (!detail.success || !detail.data) {
      return { success: false, error: detail.error || "获取标书失败" };
    }

    const md = exportFullProposalMarkdown(detail.data);
    const fileName = `${detail.data.title.replace(/[\\/:*?"<>|]/g, "_")}.md`;

    return { success: true, content: md, fileName };
  } catch (err) {
    console.error("Failed to export proposal markdown:", err);
    return { success: false, error: "导出标书 Markdown 失败" };
  }
}

/**
 * 一键将装配好的标书送至清标质检沙箱进行深度查重与一票否决项扫描
 */
export async function sendProposalToAuditAction(projectId: number): Promise<{
  success: boolean;
  auditId?: number;
  auditScore?: number;
  riskLevel?: string;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const detail = await getProposalProjectDetailAction(projectId);
    if (!detail.success || !detail.data) {
      return { success: false, error: detail.error || "获取标书工程失败" };
    }

    const project = detail.data;
    // 拼接全卷文本
    const fullContent = project.volumes.map((v) => v.contentMarkdown).join("\n\n");

    // 运行六维深度清标算法
    const auditRes = runDeepBidAudit(fullContent, {
      documentTitle: project.title,
      targetPurchaser: project.targetPurchaser,
      budgetAmount: project.bidAmountWan,
    });

    // 存入 BidAuditRecord
    const auditRecord = await prisma.bidAuditRecord.create({
      data: {
        userId: user.uid,
        tenderId: project.tenderId,
        followId: project.followId,
        documentTitle: `[装配送检] ${project.title}`,
        auditScore: auditRes.auditScore,
        riskLevel: auditRes.riskLevel,
        fatalIssuesCount: auditRes.fatalCount,
        warningIssuesCount: auditRes.warningCount,
        issuesDetails: auditRes.issues as unknown as object,
        auditedContent: fullContent.slice(0, 5000),
        inspector: user.name || user.username,
      },
    });

    // 标记装配工程为已质检
    await prisma.proposalProject.update({
      where: { id: projectId },
      data: { status: "AUDITED" },
    });

    revalidatePath("/proposals");
    revalidatePath("/audit");

    return {
      success: true,
      auditId: auditRecord.id,
      auditScore: auditRes.auditScore,
      riskLevel: auditRes.riskLevel,
    };
  } catch (err) {
    console.error("Failed to send proposal to audit:", err);
    return { success: false, error: "流转质检失败，请稍后重试" };
  }
}
