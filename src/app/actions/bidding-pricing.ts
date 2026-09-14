"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import {
  getPurchaserDiscountBenchmark,
  calculateBiddingPricingStrategy,
  type BiddingPricingAnalysis,
} from "@/lib/bidding-pricing";

export type BiddingPricingActionResponse = {
  success: boolean;
  authenticated: boolean;
  isPlatinumOrAbove: boolean;
  data?: BiddingPricingAnalysis;
  error?: string;
};

export async function getBiddingPricingCompassAction(params: {
  tenderId: number;
  proposedQuoteWan?: number;
}): Promise<BiddingPricingActionResponse> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      authenticated: false,
      isPlatinumOrAbove: false,
      error: "请先登录后体验投标报价博弈罗盘",
    };
  }

  const { tenderId, proposedQuoteWan } = params;
  if (!tenderId || isNaN(tenderId)) {
    return {
      success: false,
      authenticated: true,
      isPlatinumOrAbove: false,
      error: "无效的标讯 ID",
    };
  }

  const [tender, entitlement] = await Promise.all([
    prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        title: true,
        purchaser: true,
        industryCode: true,
        budgetAmount: true,
        awardAmount: true,
      },
    }),
    getEntitlement(session.uid),
  ]);

  if (!tender) {
    return {
      success: false,
      authenticated: true,
      isPlatinumOrAbove: false,
      error: "未找到对应标讯",
    };
  }

  const isAdmin = session.role === "ADMIN";
  const isPlatinumOrAbove =
    isAdmin ||
    entitlement.planCode === "PLATINUM" ||
    entitlement.planCode.startsWith("ENTERPRISE");

  // 若无明确预算金额，尝试取中标金额或设置默认参考值 100 万
  let budgetWan = 100;
  if (tender.budgetAmount && Number(tender.budgetAmount) > 0) {
    budgetWan = Math.round((Number(tender.budgetAmount) / 10000) * 100) / 100;
  } else if (tender.awardAmount && Number(tender.awardAmount) > 0) {
    budgetWan = Math.round((Number(tender.awardAmount) / 10000) * 1.1 * 100) / 100;
  }

  const benchmark = await getPurchaserDiscountBenchmark(
    tender.purchaser,
    tender.industryCode
  );

  const analysis = calculateBiddingPricingStrategy({
    tenderId: tender.id,
    budgetAmountWan: budgetWan,
    benchmark,
    proposedQuoteWan: proposedQuoteWan || null,
  });

  return {
    success: true,
    authenticated: true,
    isPlatinumOrAbove,
    data: analysis,
  };
}
