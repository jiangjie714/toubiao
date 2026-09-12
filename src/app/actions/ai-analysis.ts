"use server";

import { getSession } from "@/lib/auth";
import { getEntitlement, consumeAiQuota } from "@/lib/quota";
import {
  getOrGenerateTenderAiAnalysis,
  analyzeWithHeuristics,
  type AiAnalysisData,
} from "@/lib/ai/bid-reader";
import { prisma } from "@/lib/prisma";

export type AiAnalysisResponse = {
  success: boolean;
  authenticated: boolean;
  isLocked: boolean;
  lockReason?: string;
  planCode?: string;
  planName?: string;
  remainingQuota?: number;
  data?: Partial<AiAnalysisData>;
  error?: string;
};

export async function getTenderAiAnalysisAction(
  tenderId: number,
  options: { forceRefresh?: boolean } = {},
): Promise<AiAnalysisResponse> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      authenticated: false,
      isLocked: true,
      lockReason: "请先登录账号后查看 AI 标书速读与风控雷达",
    };
  }

  const entitlement = await getEntitlement(session.uid);
  const isAdmin = session.role === "ADMIN";
  const hasAccess = isAdmin || entitlement.features.aiQuota > 0 || entitlement.planCode !== "FREE";

  // 1. 如果用户是免费用户，且没有 AI 配额
  if (!hasAccess) {
    // 检查是否已有管理员或其他付费会员生成的现成分析
    const cached = await prisma.tenderAiAnalysis.findUnique({
      where: { tenderId },
    });

    if (cached && cached.status === "COMPLETED") {
      let execSummary: Record<string, string> = {};
      try {
        execSummary = JSON.parse(cached.executiveSummary);
      } catch {
        // ignore
      }
      const riskRadar = cached.riskRadar as Record<string, unknown>;

      return {
        success: true,
        authenticated: true,
        isLocked: true,
        lockReason: "当前为免费版用户，仅展示部分 AI 试看概览。升级黄金版或白金版会员即可解锁完整一票否决条款排查、评标办法穿透及智能备忘清单。",
        planCode: entitlement.planCode,
        planName: entitlement.planName,
        remainingQuota: 0,
        data: {
          executiveSummary: {
            projectOverview: execSummary.projectOverview || "本项目包含详细招标要求及实质性响应条款，需重点审核。",
            procuringEntity: execSummary.procuringEntity || "详见公告",
            scopeOfWork: "【会员专属解锁】查看招标范围与核心交付要求...",
            duration: "【会员专属解锁】工期要求...",
            paymentTerms: "【会员专属解锁】付款条件与结算比例...",
            budgetOrPrice: execSummary.budgetOrPrice || "详见公告",
          },
          riskRadar: {
            riskScore: Number(riskRadar.riskScore ?? 35),
            riskLevel: (riskRadar.riskLevel as "LOW" | "MEDIUM" | "HIGH") ?? "MEDIUM",
            disqualifiedItems: [
              {
                clause: "【会员专属】一票否决/星号条款排查（已发现潜在实质性废标项）",
                level: "CRITICAL",
                explanation: "升级会员后即可穿透查看具体废标条款原文及应对策略。",
              },
            ],
            complianceAlerts: [],
            depositAndFees: {
              depositRequired: false,
              depositAmount: "【会员专属解锁】",
            },
          },
        },
      };
    }

    // 免费版且无现成缓存：生成基础试看
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      return { success: false, authenticated: true, isLocked: false, error: "公告不存在" };
    }

    const preview = analyzeWithHeuristics(tender);
    return {
      success: true,
      authenticated: true,
      isLocked: true,
      lockReason: "当前为免费版用户，仅展示部分 AI 试看概览。升级黄金版或白金版会员即可解锁完整一票否决条款排查、评标办法穿透及智能备忘清单。",
      planCode: entitlement.planCode,
      planName: entitlement.planName,
      remainingQuota: 0,
      data: {
        executiveSummary: {
          projectOverview: preview.executiveSummary.projectOverview,
          procuringEntity: preview.executiveSummary.procuringEntity,
          scopeOfWork: "【会员专属解锁】查看招标范围与核心交付要求...",
          duration: "【会员专属解锁】工期要求...",
          paymentTerms: "【会员专属解锁】付款条件与结算比例...",
          budgetOrPrice: preview.executiveSummary.budgetOrPrice,
        },
        riskRadar: {
          riskScore: preview.riskRadar.riskScore,
          riskLevel: preview.riskRadar.riskLevel,
          disqualifiedItems: [
            {
              clause: "【会员专属】一票否决/星号条款排查（已发现潜在实质性废标项）",
              level: "CRITICAL",
              explanation: "升级会员后即可穿透查看具体废标条款原文及应对策略。",
            },
          ],
          complianceAlerts: [],
          depositAndFees: {
            depositRequired: preview.riskRadar.depositAndFees.depositRequired,
            depositAmount: "【会员专属解锁】",
          },
        },
      },
    };
  }

  // 2. 付费会员 / 管理员用户
  try {
    // 检查缓存
    if (!options.forceRefresh) {
      const cached = await prisma.tenderAiAnalysis.findUnique({
        where: { tenderId },
      });

      if (cached && cached.status === "COMPLETED") {
        const result = await getOrGenerateTenderAiAnalysis(tenderId, { forceRefresh: false });
        return {
          success: true,
          authenticated: true,
          isLocked: false,
          planCode: entitlement.planCode,
          planName: entitlement.planName,
          remainingQuota: isAdmin ? 9999 : entitlement.features.aiQuota,
          data: result.data,
        };
      }
    }


    // 无缓存，尝试扣除配额
    const quotaResult = await consumeAiQuota(session.uid, { isAdmin });
    if (!quotaResult.allowed && !isAdmin) {
      return {
        success: false,
        authenticated: true,
        isLocked: false,
        error: `您今日的 AI 标书速读配额已用完（每日上限 ${quotaResult.quota} 篇）。配额将于次日 0 点重置，或升级更高阶企业套餐。`,
        remainingQuota: 0,
      };
    }

    // 执行分析
    const result = await getOrGenerateTenderAiAnalysis(tenderId, { forceRefresh: false });
    return {
      success: true,
      authenticated: true,
      isLocked: false,
      planCode: entitlement.planCode,
      planName: entitlement.planName,
      remainingQuota: isAdmin ? 9999 : quotaResult.remaining,
      data: result.data,
    };
  } catch (err) {
    console.error("AI analysis action failed:", err);
    return {
      success: false,
      authenticated: true,
      isLocked: false,
      error: "AI 分析处理失败，请稍后重试",
    };
  }
}
