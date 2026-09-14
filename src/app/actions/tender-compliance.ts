"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import {
  runTenderComplianceScan,
  type TenderComplianceReport,
  type ComplianceCheckStatus,
} from "@/lib/tender-compliance";
import { getMyCompanyProfileAction } from "./company-profile";

export interface ComplianceActionResult {
  success: boolean;
  authenticated: boolean;
  isPremium: boolean;
  planCode: string;
  report?: TenderComplianceReport;
  userCheckStates?: Record<string, { status: ComplianceCheckStatus; notes?: string }>;
  error?: string;
}

export async function getTenderComplianceReportAction(
  tenderId: number
): Promise<ComplianceActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        authenticated: false,
        isPremium: false,
        planCode: "GUEST",
        error: "请先登录后体验标书合规体检",
      };
    }

    const [tender, entitlement, profileRes] = await Promise.all([
      prisma.tender.findUnique({
        where: { id: tenderId },
        select: {
          id: true,
          title: true,
          content: true,
          purchaser: true,
          budgetAmount: true,
          expireDate: true,
        },
      }),
      getEntitlement(session.uid),
      getMyCompanyProfileAction(),
    ]);

    if (!tender) {
      return {
        success: false,
        authenticated: true,
        isPremium: false,
        planCode: entitlement.planCode,
        error: "未找到对应标讯",
      };
    }

    const isPremium =
      session.role === "ADMIN" ||
      entitlement.planCode === "PLATINUM" ||
      entitlement.planCode.startsWith("ENTERPRISE");

    const fullReport = runTenderComplianceScan(
      {
        id: tender.id,
        title: tender.title,
        content: tender.content,
        purchaser: tender.purchaser,
        budgetAmount: tender.budgetAmount ? Number(tender.budgetAmount) : null,
        expireDate: tender.expireDate,
      },
      profileRes.data
    );

    // 非付费用户截断：保留前 5 项高发核心检查项，后续项锁定脱敏
    if (!isPremium) {
      fullReport.rules = fullReport.rules.map((rule, idx) => {
        if (idx < 5) return rule;
        return {
          ...rule,
          checkPoint: "【白金/企业会员专享】该深度废标红线审核要点已锁定，请升级后查阅",
          responseRequirement: "【白金/企业会员专享】标准应答要求与排版规范已锁定",
          evidenceRequired: "【白金/企业会员专享】所需权威佐证与检测清单已锁定",
          detectedTenderClauses: [],
          autoCheckResult: undefined,
        };
      });
    }

    return {
      success: true,
      authenticated: true,
      isPremium,
      planCode: entitlement.planCode,
      report: fullReport,
    };
  } catch (err) {
    console.error("Failed to generate compliance report:", err);
    return {
      success: false,
      authenticated: true,
      isPremium: false,
      planCode: "UNKNOWN",
      error: "生成标书合规扫描报告失败",
    };
  }
}
