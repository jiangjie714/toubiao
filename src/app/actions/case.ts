"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  matchCasesForTender,
  type CompanyCaseItem,
  type TenderCaseMatchAnalysis,
} from "@/lib/case-matching";
import { formatDate } from "@/lib/constants";
import { INDUSTRY_META } from "@/lib/industry";

export interface CompanyCasesResponse {
  success: boolean;
  cases?: CompanyCaseItem[];
  companyName?: string;
  totalAmountWan?: number;
  error?: string;
}

/**
 * 获取当前企业业绩案例库列表
 */
export async function getCompanyCasesAction(): Promise<CompanyCasesResponse> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    // 团队关联
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.uid },
      select: { teamId: true },
    });
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: user.uid },
      select: { id: true },
    });
    const effectiveTeamId = teamMember?.teamId || ownedTeam?.id || null;

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: user.uid },
      select: { companyName: true },
    });
    const companyName = companyProfile?.companyName || user.name || "我司";

    const whereCondition = effectiveTeamId
      ? {
          OR: [{ userId: user.uid }, { teamId: effectiveTeamId }],
        }
      : { userId: user.uid };

    const records = await prisma.companyCase.findMany({
      where: whereCondition,
      orderBy: { signDate: "desc" },
    });

    const now = new Date();
    let totalAmountWan = 0;

    const cases: CompanyCaseItem[] = records.map((r) => {
      const amt = Number(r.amountWan);
      totalAmountWan += amt;

      const signDateObj = new Date(r.signDate);
      const diffYears = (now.getTime() - signDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365);
      const isOverdueThreeYears = diffYears > 3;

      return {
        id: r.id,
        title: r.title,
        clientName: r.clientName,
        amountWan: amt,
        signDate: formatDate(r.signDate),
        signYear: signDateObj.getFullYear(),
        industryCode: r.industryCode,
        industryLabel: r.industryCode && INDUSTRY_META[r.industryCode] ? INDUSTRY_META[r.industryCode].name : "通用综合",
        serviceScope: r.serviceScope,
        projectLeader: r.projectLeader,
        hasAcceptanceDoc: r.hasAcceptanceDoc,
        contractFileUrl: r.contractFileUrl,
        isOverdueThreeYears,
        createdAt: formatDate(r.createdAt),
      };
    });

    return {
      success: true,
      cases,
      companyName,
      totalAmountWan: Math.round(totalAmountWan * 100) / 100,
    };
  } catch (err) {
    console.error("Error in getCompanyCasesAction:", err);
    return { success: false, error: "获取业绩资产库失败，请稍后刷新重试" };
  }
}

/**
 * 新增或编辑业绩案例
 */
export async function saveCompanyCaseAction(payload: {
  id?: number;
  title: string;
  clientName: string;
  amountWan: number;
  signDate: string;
  industryCode?: string | null;
  serviceScope?: string | null;
  projectLeader?: string | null;
  hasAcceptanceDoc?: boolean;
  contractFileUrl?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    if (!payload.title.trim()) {
      return { success: false, error: "合同项目名称不能为空" };
    }
    if (!payload.clientName.trim()) {
      return { success: false, error: "业主/客户单位不能为空" };
    }
    if (!payload.amountWan || payload.amountWan <= 0) {
      return { success: false, error: "合同金额必须大于 0 万元" };
    }
    if (!payload.signDate) {
      return { success: false, error: "合同签署日期不能为空" };
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

    const data = {
      title: payload.title.trim(),
      clientName: payload.clientName.trim(),
      amountWan: payload.amountWan,
      signDate: new Date(payload.signDate),
      industryCode: payload.industryCode || null,
      serviceScope: payload.serviceScope?.trim() || null,
      projectLeader: payload.projectLeader?.trim() || null,
      hasAcceptanceDoc: payload.hasAcceptanceDoc ?? false,
      contractFileUrl: payload.contractFileUrl?.trim() || null,
      teamId: effectiveTeamId,
    };

    if (payload.id) {
      await prisma.companyCase.update({
        where: { id: payload.id },
        data,
      });
    } else {
      await prisma.companyCase.create({
        data: {
          ...data,
          userId: user.uid,
        },
      });
    }

    revalidatePath("/cases");
    return { success: true };
  } catch (err) {
    console.error("Error in saveCompanyCaseAction:", err);
    return { success: false, error: "保存业绩案例失败" };
  }
}

/**
 * 删除业绩案例
 */
export async function deleteCompanyCaseAction(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    await prisma.companyCase.delete({
      where: { id },
    });

    revalidatePath("/cases");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteCompanyCaseAction:", err);
    return { success: false, error: "删除业绩案例失败" };
  }
}

/**
 * 针对特定招标公告，智能匹配并评分企业案例库
 */
export async function getMatchedCasesForTenderAction({
  tenderId,
}: {
  tenderId: number;
}): Promise<{
  success: boolean;
  data?: TenderCaseMatchAnalysis;
  companyName?: string;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        title: true,
        content: true,
        budgetAmount: true,
        industryCode: true,
        publishDate: true,
      },
    });

    if (!tender) {
      return { success: false, error: "未找到对应招标公告" };
    }

    const casesRes = await getCompanyCasesAction();
    const userCases = casesRes.cases || [];

    const matchAnalysis = matchCasesForTender(tender, userCases);

    return {
      success: true,
      data: matchAnalysis,
      companyName: casesRes.companyName || "我司",
    };
  } catch (err) {
    console.error("Error in getMatchedCasesForTenderAction:", err);
    return { success: false, error: "计算类似业绩匹配度失败，请稍后重试" };
  }
}
