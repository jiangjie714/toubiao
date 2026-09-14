"use server";

import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import {
  generateProposalOutline,
  type ProposalOutlineResult,
} from "@/lib/proposal-generator";

export interface ProposalOutlineActionResponse {
  success: boolean;
  data?: ProposalOutlineResult;
  isPlatinumOrAbove: boolean;
  planName: string;
  error?: string;
}

export async function getProposalOutlineAction({
  tenderId,
}: {
  tenderId: number;
}): Promise<ProposalOutlineActionResponse> {
  try {
    const user = await getSession();
    if (!user) {
      return {
        success: false,
        isPlatinumOrAbove: false,
        planName: "未登录",
        error: "请先登录后再使用标书大纲生成功能",
      };
    }

    const entitlement = await getEntitlement(user.uid);
    const planCode = entitlement.planCode || "FREE";
    const isPlatinumOrAbove =
      planCode === "PLATINUM" || planCode === "ENTERPRISE" || planCode === "PRO";

    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        purchaser: true,
        agency: true,
        projectNo: true,
        budgetAmount: true,
        publishDate: true,
        expireDate: true,
        openTime: true,
        sourceUrl: true,
      },
    });

    if (!tender) {
      return {
        success: false,
        isPlatinumOrAbove,
        planName: entitlement.planName,
        error: "未找到对应的招标公告",
      };
    }

    const fullResult = generateProposalOutline(tender);

    // 分级权益控制：未付费或黄金版用户可查看概要及前两章、前 3 条点对点应答
    if (!isPlatinumOrAbove && planCode === "FREE") {
      const truncatedResult: ProposalOutlineResult = {
        ...fullResult,
        sections: fullResult.sections.slice(0, 3).map((sec, idx) => {
          if (idx === 2) {
            return {
              ...sec,
              subSections: sec.subSections.slice(0, 1),
            };
          }
          return sec;
        }),
        pointToPointMatrix: fullResult.pointToPointMatrix.slice(0, 3),
      };

      return {
        success: true,
        data: truncatedResult,
        isPlatinumOrAbove: false,
        planName: entitlement.planName,
      };
    }

    return {
      success: true,
      data: fullResult,
      isPlatinumOrAbove: true,
      planName: entitlement.planName,
    };
  } catch (error) {
    console.error("Error in getProposalOutlineAction:", error);
    return {
      success: false,
      isPlatinumOrAbove: false,
      planName: "未知",
      error: "服务器处理标书大纲生成请求时发生异常，请稍后重试",
    };
  }
}
