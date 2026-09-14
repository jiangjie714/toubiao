"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  calculateGoNoGoDecision,
  generateProjectDossierDocument,
  DECISION_META,
  type DecisionType,
  type EvaluationScoresInput,
  type WarRoomDetailData,
} from "@/lib/war-room-manager";
import { getQualificationsAction } from "@/app/actions/qualification";
import { getCompanyCasesAction } from "@/app/actions/case";
import { matchQualificationsForTender } from "@/lib/qualification-manager";
import { matchCasesForTender } from "@/lib/case-matching";
import { formatDate } from "@/lib/constants";

export interface WarRoomResponse {
  success: boolean;
  data?: WarRoomDetailData;
  error?: string;
}

/**
 * 获取指定跟进标讯项目的协同作战指挥室全盘数据 (三流合一 + 立项评审)
 */
export async function getWarRoomDetailAction(followId: number): Promise<WarRoomResponse> {
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
      select: { id: true, name: true },
    });
    const effectiveTeamId = teamMember?.teamId || ownedTeam?.id || null;

    const follow = await prisma.tenderFollow.findUnique({
      where: { id: followId },
      include: {
        tender: true,
        evaluation: true,
        user: { select: { name: true, username: true } },
        team: { select: { name: true } },
        _count: { select: { comments: true } },
      },
    });

    if (!follow) {
      return { success: false, error: "未找到该项目的跟进记录" };
    }

    // 权限校验
    if (follow.userId !== user.uid && (!effectiveTeamId || follow.teamId !== effectiveTeamId)) {
      return { success: false, error: "无权查看该项目的作战指挥室" };
    }

    const tender = follow.tender;
    const now = new Date();
    let daysToDeadline: number | null = null;
    if (tender.expireDate) {
      const diff = new Date(tender.expireDate).getTime() - now.getTime();
      daysToDeadline = Math.ceil(diff / (1000 * 3600 * 24));
    }

    // 并行获取企业资质、类似业绩与保证金台账
    const [qualRes, caseRes, depositRecord] = await Promise.all([
      getQualificationsAction(),
      getCompanyCasesAction(),
      prisma.bidDeposit.findFirst({
        where: {
          tenderId: tender.id,
          ...(effectiveTeamId
            ? { OR: [{ userId: user.uid }, { teamId: effectiveTeamId }] }
            : { userId: user.uid }),
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // 1. 资质对标概览
    const qualAnalysis = matchQualificationsForTender(tender, qualRes.qualifications || []);

    // 2. 类似业绩概览
    const caseAnalysis = matchCasesForTender(tender, caseRes.cases || []);

    // 3. 保证金台账概览
    let depositOverview = {
      hasDeposit: false,
      amount: undefined as number | undefined,
      status: undefined as string | undefined,
      statusLabel: undefined as string | undefined,
      payeeName: undefined as string | null | undefined,
      refundDeadline: undefined as string | null | undefined,
      isOverdueRisk: false,
    };

    if (depositRecord) {
      const isOverdue =
        depositRecord.status === "OVERDUE_RISK" ||
        (depositRecord.status === "IN_TRANSIT" &&
          depositRecord.refundDeadline &&
          new Date(depositRecord.refundDeadline) < now);

      let statusLabel = "在途锁定";
      if (depositRecord.status === "REFUNDED") statusLabel = "已退回到账";
      if (depositRecord.status === "REFUND_APPLIED") statusLabel = "已申请催退";
      if (isOverdue) statusLabel = "超期高危滞留";

      depositOverview = {
        hasDeposit: true,
        amount: Number(depositRecord.amount),
        status: depositRecord.status,
        statusLabel,
        payeeName: depositRecord.payeeName,
        refundDeadline: depositRecord.refundDeadline ? formatDate(depositRecord.refundDeadline) : null,
        isOverdueRisk: !!isOverdue,
      };
    }

    // 4. 立项评审数据
    let evaluationData: WarRoomDetailData["evaluation"];
    if (follow.evaluation) {
      const ev = follow.evaluation;
      const dec = (ev.decision as DecisionType) in DECISION_META ? (ev.decision as DecisionType) : "GO";
      evaluationData = {
        id: ev.id,
        marketScore: ev.marketScore,
        techScore: ev.techScore,
        commercialScore: ev.commercialScore,
        financialScore: ev.financialScore,
        overallScore: ev.overallScore,
        decision: dec,
        decisionLabel: DECISION_META[dec].label,
        decisionBadgeColor: DECISION_META[dec].badgeColor,
        decisionReason: ev.decisionReason,
        riskNotes: ev.riskNotes,
        leadEvaluator: ev.leadEvaluator,
        evaluatedAt: formatDate(ev.evaluatedAt),
      };
    } else {
      // 默认初始评测 (80分默认值)
      const calculated = calculateGoNoGoDecision({
        marketScore: 80,
        techScore: 80,
        commercialScore: 80,
        financialScore: 80,
      });
      evaluationData = {
        marketScore: 80,
        techScore: 80,
        commercialScore: 80,
        financialScore: 80,
        overallScore: calculated.overallScore,
        decision: calculated.decision,
        decisionLabel: calculated.decisionLabel,
        decisionBadgeColor: calculated.decisionBadgeColor,
        decisionReason: null,
        riskNotes: null,
        leadEvaluator: follow.assignee || user.name || user.username,
        evaluatedAt: formatDate(now),
        advice: calculated.advice,
      };
    }

    const warRoomData: WarRoomDetailData = {
      followId: follow.id,
      tenderId: tender.id,
      tenderTitle: tender.title,
      purchaser: tender.purchaser,
      budgetAmount: tender.budgetAmount ? Number(tender.budgetAmount) : null,
      status: follow.status,
      priority: follow.priority,
      assignee: follow.assignee,
      expireDate: tender.expireDate ? formatDate(tender.expireDate) : null,
      daysToDeadline,
      creatorName: follow.user.name || follow.user.username,
      notes: follow.notes,
      teamName: follow.team?.name || ownedTeam?.name,
      evaluation: evaluationData,
      qualificationOverview: {
        totalRequired: qualAnalysis.totalRequired,
        matchedCount: qualAnalysis.matchedCount,
        expiringCount: qualAnalysis.expiringCount,
        expiredCount: qualAnalysis.expiredCount,
        missingCount: qualAnalysis.missingCount,
        overallFit: qualAnalysis.overallQualificationFit,
        fitLabel: qualAnalysis.fitLabel,
        fitBadgeColor: qualAnalysis.fitBadgeColor,
      },
      caseOverview: {
        totalCasesCount: caseAnalysis.summary.totalCasesCount,
        validThreeYearsCount: caseAnalysis.summary.validThreeYearsCount,
        topMatchCount: caseAnalysis.summary.topMatchCount,
        estimatedBonusPoints: caseAnalysis.summary.estimatedBonusPoints,
      },
      depositOverview,
      commentsCount: follow._count.comments,
      generatedAt: formatDate(now),
    };

    return {
      success: true,
      data: warRoomData,
    };
  } catch (err) {
    console.error("Error in getWarRoomDetailAction:", err);
    return { success: false, error: "获取作战指挥室全盘数据失败，请稍后重试" };
  }
}

/**
 * 保存或更新项目的多维立项评估与 Go / No-Go 决策
 */
export async function saveProjectEvaluationAction(
  followId: number,
  input: EvaluationScoresInput
): Promise<{ success: boolean; evaluation?: WarRoomDetailData["evaluation"]; error?: string }> {
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

    const follow = await prisma.tenderFollow.findUnique({
      where: { id: followId },
    });
    if (!follow) {
      return { success: false, error: "跟进记录不存在" };
    }
    if (follow.userId !== user.uid && (!effectiveTeamId || follow.teamId !== effectiveTeamId)) {
      return { success: false, error: "无权修改该项目的立项决策" };
    }

    // 精算立项得分与 Go/No-Go 结论
    const calculated = calculateGoNoGoDecision(input);

    const saved = await prisma.bidProjectEvaluation.upsert({
      where: { followId },
      create: {
        followId,
        marketScore: calculated.marketScore,
        techScore: calculated.techScore,
        commercialScore: calculated.commercialScore,
        financialScore: calculated.financialScore,
        overallScore: calculated.overallScore,
        decision: calculated.decision,
        decisionReason: input.decisionReason?.trim() || null,
        riskNotes: input.riskNotes?.trim() || null,
        leadEvaluator: input.leadEvaluator?.trim() || user.name || user.username,
        evaluatedAt: new Date(),
      },
      update: {
        marketScore: calculated.marketScore,
        techScore: calculated.techScore,
        commercialScore: calculated.commercialScore,
        financialScore: calculated.financialScore,
        overallScore: calculated.overallScore,
        decision: calculated.decision,
        decisionReason: input.decisionReason?.trim() || null,
        riskNotes: input.riskNotes?.trim() || null,
        leadEvaluator: input.leadEvaluator?.trim() || user.name || user.username,
        evaluatedAt: new Date(),
      },
    });

    // 同步更新 follow 的 winRateScore
    await prisma.tenderFollow.update({
      where: { id: followId },
      data: { winRateScore: calculated.overallScore },
    });

    revalidatePath("/tracker");
    revalidatePath(`/tender/${follow.tenderId}`);

    const dec = saved.decision as DecisionType;
    return {
      success: true,
      evaluation: {
        id: saved.id,
        marketScore: saved.marketScore,
        techScore: saved.techScore,
        commercialScore: saved.commercialScore,
        financialScore: saved.financialScore,
        overallScore: saved.overallScore,
        decision: dec,
        decisionLabel: DECISION_META[dec].label,
        decisionBadgeColor: DECISION_META[dec].badgeColor,
        decisionReason: saved.decisionReason,
        riskNotes: saved.riskNotes,
        leadEvaluator: saved.leadEvaluator,
        evaluatedAt: formatDate(saved.evaluatedAt),
        advice: calculated.advice,
      },
    };
  } catch (err) {
    console.error("Error in saveProjectEvaluationAction:", err);
    return { success: false, error: "保存立项决策失败，请稍后重试" };
  }
}

/**
 * 获取指定项目的完整立项决策与筹备全案公文文本
 */
export async function generateDossierAction(
  followId: number,
  format: "markdown" | "html" = "markdown"
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const detailRes = await getWarRoomDetailAction(followId);
    if (!detailRes.success || !detailRes.data) {
      return { success: false, error: detailRes.error || "获取作战数据失败" };
    }

    const content = generateProjectDossierDocument(detailRes.data, format);
    return { success: true, content };
  } catch (err) {
    console.error("Error in generateDossierAction:", err);
    return { success: false, error: "生成立项公文失败" };
  }
}
