"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { generateProposalKit, type ProposalKitData } from "@/lib/ai/proposal-generator";

export interface ProposalKitActionResult {
  success: boolean;
  error?: string;
  isPremium?: boolean;
  planCode?: string;
  data?: ProposalKitData & {
    isPremium: boolean;
    planCode: string;
    lockedMatrixCount: number;
  };
}

export async function getProposalKitAction(
  tenderId: number
): Promise<ProposalKitActionResult> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后使用标书编制助手" };
    }

    const [tender, entitlement] = await Promise.all([
      prisma.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          title: true,
          content: true,
          projectNo: true,
          purchaser: true,
          budgetAmount: true,
          openTime: true,
          expireDate: true,
        },
      }),
      getEntitlement(user.uid),
    ]);

    if (!tender) {
      return { success: false, error: "未找到对应标讯" };
    }

    const isPremium =
      user.role === "ADMIN" ||
      entitlement.planCode === "PLATINUM" ||
      entitlement.planCode === "ENTERPRISE";

    const rawKit = generateProposalKit({
      ...tender,
      budgetAmount: tender.budgetAmount ? Number(tender.budgetAmount) : null,
    });

    if (!isPremium) {
      // 免费版/黄金版部分脱敏
      const maskedMatrix = rawKit.complianceMatrix.map((item, idx) => {
        if (idx < 2) return { ...item, isLocked: false };
        return {
          ...item,
          responseStrategy: "【白金/企业会员专享】建议应答策略与技术偏离防范要点已锁定",
          evidenceRequired: "【白金/企业会员专享】所需资质/财务/业绩证明原件清单已锁定",
          isLocked: true,
        };
      });

      const maskedChecks = rawKit.preSubmissionChecks.map((item, idx) => {
        if (idx < 3) return { ...item, isLocked: false };
        return {
          ...item,
          checkPoint: "【白金会员专享】开标前防废标关键自查项已锁定，请升级后查看",
          isLocked: true,
        };
      });

      return {
        success: true,
        isPremium: false,
        planCode: entitlement.planCode,
        data: {
          ...rawKit,
          complianceMatrix: maskedMatrix,
          preSubmissionChecks: maskedChecks,
          isPremium: false,
          planCode: entitlement.planCode,
          lockedMatrixCount: Math.max(0, rawKit.complianceMatrix.length - 2),
        },
      };
    }

    return {
      success: true,
      isPremium: true,
      planCode: entitlement.planCode,
      data: {
        ...rawKit,
        isPremium: true,
        planCode: entitlement.planCode,
        lockedMatrixCount: 0,
      },
    };
  } catch (err) {
    console.error("Failed to generate proposal kit:", err);
    return { success: false, error: "生成标书编制方案失败，请稍后重试" };
  }
}
