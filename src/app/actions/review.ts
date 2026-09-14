"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  aggregateReviewMetrics,
  calculatePriceGapPercent,
  generateReviewReportMarkdown,
  type PrimaryCauseType,
  type ReviewItemData,
  type ReviewMetricsSummary,
  type ReviewOutcome,
} from "@/lib/review-manager";

export interface ReviewAnalyticsResponse {
  success: boolean;
  summary?: ReviewMetricsSummary;
  reviews?: ReviewItemData[];
  error?: string;
}

export interface SingleReviewResponse {
  success: boolean;
  data?: ReviewItemData | null;
  error?: string;
}

export interface SaveReviewInput {
  followId: number;
  outcome: ReviewOutcome;
  winningSupplier?: string;
  winningAmount?: number;
  myBidAmount?: number;
  ranking?: number;
  scoreGap?: number;
  primaryCause: PrimaryCauseType;
  secondaryCauses?: string[];
  strengths?: string;
  shortcomings?: string;
  actionItems?: string;
  reviewer?: string;
}

/**
 * 获取复盘归因大盘全量指标与明细清单
 */
export async function getReviewAnalyticsAction(options?: {
  mode?: "personal" | "team";
  outcomeFilter?: string;
  causeFilter?: string;
}): Promise<ReviewAnalyticsResponse> {
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

    const requestedMode = options?.mode || (effectiveTeamId ? "team" : "personal");

    const whereClause: Record<string, unknown> = {};

    if (effectiveTeamId && requestedMode === "team") {
      whereClause.teamId = effectiveTeamId;
    } else {
      whereClause.userId = user.uid;
    }

    if (options?.outcomeFilter && options.outcomeFilter !== "ALL") {
      whereClause.outcome = options.outcomeFilter;
    }

    if (options?.causeFilter && options.causeFilter !== "ALL") {
      whereClause.primaryCause = options.causeFilter;
    }

    const records = await prisma.bidReview.findMany({
      where: whereClause,
      include: {
        follow: {
          include: {
            tender: {
              select: {
                id: true,
                title: true,
                purchaser: true,
                budgetAmount: true,
              },
            },
            team: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { reviewedAt: "desc" },
    });

    const reviews: ReviewItemData[] = records.map((r) => {
      let secCauses: string[] = [];
      if (Array.isArray(r.secondaryCauses)) {
        secCauses = r.secondaryCauses.map(String);
      } else if (typeof r.secondaryCauses === "string") {
        try {
          secCauses = JSON.parse(r.secondaryCauses);
        } catch {
          secCauses = [];
        }
      }

      return {
        id: r.id,
        followId: r.followId,
        userId: r.userId,
        outcome: r.outcome as ReviewOutcome,
        winningSupplier: r.winningSupplier,
        winningAmount: r.winningAmount ? Number(r.winningAmount) : null,
        myBidAmount: r.myBidAmount ? Number(r.myBidAmount) : null,
        priceGapPercent: r.priceGapPercent ? Number(r.priceGapPercent) : null,
        ranking: r.ranking,
        scoreGap: r.scoreGap ? Number(r.scoreGap) : null,
        primaryCause: r.primaryCause as PrimaryCauseType,
        secondaryCauses: secCauses,
        strengths: r.strengths,
        shortcomings: r.shortcomings,
        actionItems: r.actionItems,
        reviewer: r.reviewer,
        reviewedAt: r.reviewedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        projectInfo: {
          tenderId: r.follow.tender.id,
          title: r.follow.tender.title,
          purchaser: r.follow.tender.purchaser,
          budgetAmount: r.follow.tender.budgetAmount ? Number(r.follow.tender.budgetAmount) : null,
          status: r.follow.status,
          teamName: r.follow.team?.name,
          assignee: r.follow.assignee,
        },
      };
    });

    const summary = aggregateReviewMetrics(reviews);

    return {
      success: true,
      summary,
      reviews,
    };
  } catch (error) {
    console.error("getReviewAnalyticsAction error:", error);
    return { success: false, error: "获取复盘统计大盘失败" };
  }
}

/**
 * 获取指定跟进项目的复盘详情
 */
export async function getProjectReviewDetailAction(followId: number): Promise<SingleReviewResponse> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const review = await prisma.bidReview.findUnique({
      where: { followId },
      include: {
        follow: {
          include: {
            tender: {
              select: {
                id: true,
                title: true,
                purchaser: true,
                budgetAmount: true,
              },
            },
            team: { select: { name: true } },
          },
        },
      },
    });

    if (!review) {
      // 若尚未复盘，查询跟进基本信息并返回空复盘结构
      const follow = await prisma.tenderFollow.findUnique({
        where: { id: followId },
        include: {
          tender: {
            select: {
              id: true,
              title: true,
              purchaser: true,
              budgetAmount: true,
            },
          },
          team: { select: { name: true } },
        },
      });

      if (!follow) {
        return { success: false, error: "未找到该项目跟进记录" };
      }

      return {
        success: true,
        data: null,
      };
    }

    let secCauses: string[] = [];
    if (Array.isArray(review.secondaryCauses)) {
      secCauses = review.secondaryCauses.map(String);
    }

    const data: ReviewItemData = {
      id: review.id,
      followId: review.followId,
      userId: review.userId,
      outcome: review.outcome as ReviewOutcome,
      winningSupplier: review.winningSupplier,
      winningAmount: review.winningAmount ? Number(review.winningAmount) : null,
      myBidAmount: review.myBidAmount ? Number(review.myBidAmount) : null,
      priceGapPercent: review.priceGapPercent ? Number(review.priceGapPercent) : null,
      ranking: review.ranking,
      scoreGap: review.scoreGap ? Number(review.scoreGap) : null,
      primaryCause: review.primaryCause as PrimaryCauseType,
      secondaryCauses: secCauses,
      strengths: review.strengths,
      shortcomings: review.shortcomings,
      actionItems: review.actionItems,
      reviewer: review.reviewer,
      reviewedAt: review.reviewedAt.toISOString(),
      createdAt: review.createdAt.toISOString(),
      projectInfo: {
        tenderId: review.follow.tender.id,
        title: review.follow.tender.title,
        purchaser: review.follow.tender.purchaser,
        budgetAmount: review.follow.tender.budgetAmount ? Number(review.follow.tender.budgetAmount) : null,
        status: review.follow.status,
        teamName: review.follow.team?.name,
        assignee: review.follow.assignee,
      },
    };

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("getProjectReviewDetailAction error:", error);
    return { success: false, error: "获取项目复盘失败" };
  }
}

/**
 * 保存或更新投标复盘归因记录
 */
export async function saveProjectReviewAction(input: SaveReviewInput): Promise<{
  success: boolean;
  reviewId?: number;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const follow = await prisma.tenderFollow.findUnique({
      where: { id: input.followId },
      include: { team: true },
    });

    if (!follow) {
      return { success: false, error: "未找到对应的投标跟进项目" };
    }

    // 计算价格偏差率
    const priceGap = calculatePriceGapPercent(input.myBidAmount, input.winningAmount);

    const saved = await prisma.bidReview.upsert({
      where: { followId: input.followId },
      create: {
        followId: input.followId,
        userId: user.uid,
        outcome: input.outcome,
        winningSupplier: input.winningSupplier || null,
        winningAmount: input.winningAmount ? input.winningAmount : null,
        myBidAmount: input.myBidAmount ? input.myBidAmount : null,
        priceGapPercent: priceGap.percent !== null ? priceGap.percent : null,
        ranking: input.ranking || null,
        scoreGap: input.scoreGap !== undefined && input.scoreGap !== null ? input.scoreGap : null,
        primaryCause: input.primaryCause,
        secondaryCauses: input.secondaryCauses || [],
        strengths: input.strengths || null,
        shortcomings: input.shortcomings || null,
        actionItems: input.actionItems || null,
        reviewer: input.reviewer || user.name || "项目组",
        teamId: follow.teamId || null,
        reviewedAt: new Date(),
      },
      update: {
        outcome: input.outcome,
        winningSupplier: input.winningSupplier || null,
        winningAmount: input.winningAmount ? input.winningAmount : null,
        myBidAmount: input.myBidAmount ? input.myBidAmount : null,
        priceGapPercent: priceGap.percent !== null ? priceGap.percent : null,
        ranking: input.ranking || null,
        scoreGap: input.scoreGap !== undefined && input.scoreGap !== null ? input.scoreGap : null,
        primaryCause: input.primaryCause,
        secondaryCauses: input.secondaryCauses || [],
        strengths: input.strengths || null,
        shortcomings: input.shortcomings || null,
        actionItems: input.actionItems || null,
        reviewer: input.reviewer || user.name || "项目组",
        reviewedAt: new Date(),
      },
    });

    // 若看板状态尚非 WON / LOST，则自动对齐为复盘的开标状态
    if (follow.status !== input.outcome) {
      await prisma.tenderFollow.update({
        where: { id: input.followId },
        data: {
          status: input.outcome,
          targetAmount: input.myBidAmount ? input.myBidAmount : follow.targetAmount,
        },
      });
    }

    revalidatePath("/tracker");
    revalidatePath("/reviews");

    return {
      success: true,
      reviewId: saved.id,
    };
  } catch (error) {
    console.error("saveProjectReviewAction error:", error);
    return { success: false, error: "保存投标复盘记录失败" };
  }
}

/**
 * 删除复盘记录
 */
export async function deleteProjectReviewAction(reviewId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const review = await prisma.bidReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return { success: false, error: "复盘记录不存在" };
    }

    if (review.userId !== user.uid && user.role !== "ADMIN") {
      return { success: false, error: "无权删除他人负责的项目复盘" };
    }

    await prisma.bidReview.delete({
      where: { id: reviewId },
    });

    revalidatePath("/tracker");
    revalidatePath("/reviews");

    return { success: true };
  } catch (error) {
    console.error("deleteProjectReviewAction error:", error);
    return { success: false, error: "删除复盘记录失败" };
  }
}

/**
 * 生成公文级复盘报告 Markdown 文本
 */
export async function exportReviewReportAction(followId: number): Promise<{
  success: boolean;
  markdown?: string;
  error?: string;
}> {
  try {
    const res = await getProjectReviewDetailAction(followId);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "未找到该项目的开标复盘记录" };
    }

    const markdown = generateReviewReportMarkdown(res.data);
    return { success: true, markdown };
  } catch (error) {
    console.error("exportReviewReportAction error:", error);
    return { success: false, error: "生成复盘总结报告失败" };
  }
}
