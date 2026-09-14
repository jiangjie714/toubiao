"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  runDeepBidAudit,
  generateAuditReportMarkdown,
  type AuditResultData,
  type AuditIssueItem,
} from "@/lib/audit-manager";

export interface RunAuditInput {
  content: string;
  documentTitle?: string;
  followId?: number;
  tenderId?: number;
  targetPurchaser?: string;
  budgetAmount?: number;
  inspector?: string;
}

export interface AuditRecordItem {
  id: number;
  followId: number | null;
  tenderId: number | null;
  documentTitle: string;
  auditScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  fatalIssuesCount: number;
  warningIssuesCount: number;
  issuesDetails: AuditIssueItem[];
  auditedContent: string | null;
  inspector: string | null;
  createdAt: string;
  tender?: {
    id: number;
    title: string;
    purchaser: string | null;
    budgetAmount: number | null;
  } | null;
}

/**
 * 执行送检文本的深度智能清标排查并持久化归档
 */
export async function runDocumentAuditAction(input: RunAuditInput): Promise<{
  success: boolean;
  data?: AuditResultData;
  recordId?: number;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    if (!input.content || input.content.trim().length < 10) {
      return { success: false, error: "送检文本内容过短，请至少提供10个字符的标书章节内容" };
    }

    // 调取企业资质名称列表辅助核查
    const quals = await prisma.companyQualification.findMany({
      where: { userId: user.uid },
      select: { name: true },
    });
    const qualificationNames = quals.map((q) => q.name);

    let purchaser = input.targetPurchaser;
    let budget = input.budgetAmount;
    let title = input.documentTitle || "投标文件自查文档";

    // 如果指定了 followId 或 tenderId，联动补齐信息
    let teamId: number | null = null;
    if (input.followId) {
      const follow = await prisma.tenderFollow.findUnique({
        where: { id: input.followId },
        include: {
          tender: { select: { id: true, title: true, purchaser: true, budgetAmount: true } },
        },
      });
      if (follow) {
        teamId = follow.teamId;
        purchaser = purchaser || follow.tender.purchaser || undefined;
        budget = budget || (follow.tender.budgetAmount ? Number(follow.tender.budgetAmount) : undefined);
        title = title === "投标文件自查文档" ? `${follow.tender.title} - 投标文件` : title;
      }
    } else if (input.tenderId) {
      const tender = await prisma.tender.findUnique({
        where: { id: input.tenderId },
        select: { id: true, title: true, purchaser: true, budgetAmount: true },
      });
      if (tender) {
        purchaser = purchaser || tender.purchaser || undefined;
        budget = budget || (tender.budgetAmount ? Number(tender.budgetAmount) : undefined);
      }
    }

    // 执行六维扫描
    const auditResult = runDeepBidAudit(input.content, {
      documentTitle: title,
      targetPurchaser: purchaser,
      budgetAmount: budget,
      qualificationNames,
    });

    // 持久化记录
    const saved = await prisma.bidAuditRecord.create({
      data: {
        userId: user.uid,
        teamId,
        followId: input.followId || null,
        tenderId: input.tenderId || null,
        documentTitle: title,
        auditScore: auditResult.auditScore,
        riskLevel: auditResult.riskLevel,
        fatalIssuesCount: auditResult.fatalCount,
        warningIssuesCount: auditResult.warningCount,
        issuesDetails: auditResult.issues as unknown as object,
        auditedContent: input.content.slice(0, 3000), // 存储前3000字符要点
        inspector: input.inspector?.trim() || user.name || user.username,
      },
    });

    revalidatePath("/audit");
    return {
      success: true,
      data: auditResult,
      recordId: saved.id,
    };
  } catch (error) {
    console.error("runDocumentAuditAction error:", error);
    return { success: false, error: "清标质检分析失败" };
  }
}

/**
 * 获取清标质检历史记录台账与汇总指标
 */
export async function getAuditHistoryAction(options?: {
  mode?: "personal" | "team";
  riskFilter?: string;
}): Promise<{
  success: boolean;
  records?: AuditRecordItem[];
  summary?: {
    totalAudits: number;
    highRiskCount: number;
    avgScore: number;
    fatalIssuesTotal: number;
  };
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.uid },
      select: { teamId: true },
    });
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: user.uid },
      select: { id: true },
    });
    const effectiveTeamId = teamMember?.teamId || ownedTeam?.id || null;

    const requestedMode = options?.mode || (effectiveTeamId ? "team" : "personal");

    const whereClause: Record<string, unknown> = {};
    if (effectiveTeamId && requestedMode === "team") {
      whereClause.teamId = effectiveTeamId;
    } else {
      whereClause.userId = user.uid;
    }

    if (options?.riskFilter && options.riskFilter !== "ALL") {
      whereClause.riskLevel = options.riskFilter;
    }

    const list = await prisma.bidAuditRecord.findMany({
      where: whereClause,
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            purchaser: true,
            budgetAmount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const records: AuditRecordItem[] = list.map((r) => {
      let issues: AuditIssueItem[] = [];
      if (Array.isArray(r.issuesDetails)) {
        issues = r.issuesDetails as unknown as AuditIssueItem[];
      }

      return {
        id: r.id,
        followId: r.followId,
        tenderId: r.tenderId,
        documentTitle: r.documentTitle,
        auditScore: r.auditScore,
        riskLevel: r.riskLevel as "LOW" | "MEDIUM" | "HIGH",
        fatalIssuesCount: r.fatalIssuesCount,
        warningIssuesCount: r.warningIssuesCount,
        issuesDetails: issues,
        auditedContent: r.auditedContent,
        inspector: r.inspector,
        createdAt: r.createdAt.toISOString(),
        tender: r.tender
          ? {
              id: r.tender.id,
              title: r.tender.title,
              purchaser: r.tender.purchaser,
              budgetAmount: r.tender.budgetAmount ? Number(r.tender.budgetAmount) : null,
            }
          : null,
      };
    });

    const totalAudits = records.length;
    const highRiskCount = records.filter((r) => r.riskLevel === "HIGH").length;
    const sumScore = records.reduce((acc, cur) => acc + cur.auditScore, 0);
    const avgScore = totalAudits > 0 ? Math.round(sumScore / totalAudits) : 100;
    const fatalIssuesTotal = records.reduce((acc, cur) => acc + cur.fatalIssuesCount, 0);

    return {
      success: true,
      records,
      summary: {
        totalAudits,
        highRiskCount,
        avgScore,
        fatalIssuesTotal,
      },
    };
  } catch (error) {
    console.error("getAuditHistoryAction error:", error);
    return { success: false, error: "获取质检历史记录失败" };
  }
}

/**
 * 删除指定的清标记录
 */
export async function deleteAuditRecordAction(auditId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    await prisma.bidAuditRecord.delete({
      where: { id: auditId },
    });

    revalidatePath("/audit");
    return { success: true };
  } catch (error) {
    console.error("deleteAuditRecordAction error:", error);
    return { success: false, error: "删除质检记录失败" };
  }
}

/**
 * 导出公文级质检合格单报告
 */
export async function exportAuditReportAction(auditId: number): Promise<{
  success: boolean;
  markdown?: string;
  error?: string;
}> {
  try {
    const record = await prisma.bidAuditRecord.findUnique({
      where: { id: auditId },
      include: {
        tender: { select: { purchaser: true } },
      },
    });

    if (!record) {
      return { success: false, error: "未找到该质检记录" };
    }

    let issues: AuditIssueItem[] = [];
    if (Array.isArray(record.issuesDetails)) {
      issues = record.issuesDetails as unknown as AuditIssueItem[];
    }

    const markdown = generateAuditReportMarkdown({
      documentTitle: record.documentTitle,
      auditScore: record.auditScore,
      riskLevel: record.riskLevel,
      fatalCount: record.fatalIssuesCount,
      warningCount: record.warningIssuesCount,
      issues,
      inspector: record.inspector || undefined,
      targetPurchaser: record.tender?.purchaser || undefined,
      inspectedAt: record.createdAt.toISOString(),
    });

    return { success: true, markdown };
  } catch (error) {
    console.error("exportAuditReportAction error:", error);
    return { success: false, error: "生成质检报告公文失败" };
  }
}
