"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import {
  scanMatchedOpportunities,
  evaluateProfileCompetitiveness,
  type OpportunityMatchItem,
  type ProfileCompetitivenessReport,
} from "@/lib/ai/opportunity-radar";
import type { CompanyProfileData } from "./company-profile";

export type OpportunityRadarActionResponse = {
  success: boolean;
  authenticated: boolean;
  hasProfile: boolean;
  isPlatinumOrAbove: boolean;
  data?: {
    profile: CompanyProfileData | null;
    competitiveness: ProfileCompetitivenessReport;
    items: OpportunityMatchItem[];
    totalScanned: number;
    highCount: number;
    mediumCount: number;
    totalAvailable: number;
    unlockedCount: number;
    isPlatinumOrAbove: boolean;
  };
  error?: string;
};

export async function getSmartMatchedOpportunitiesAction(options: {
  type?: string;
  provinceCode?: string;
} = {}): Promise<OpportunityRadarActionResponse> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      authenticated: false,
      hasProfile: false,
      isPlatinumOrAbove: false,
      error: "请先登录后查看智能商机匹配雷达",
    };
  }

  const [profileRecord, entitlement] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { userId: session.uid },
    }),
    getEntitlement(session.uid),
  ]);

  const isAdmin = session.role === "ADMIN";
  const isPlatinumOrAbove =
    isAdmin ||
    entitlement.planCode === "PLATINUM" ||
    entitlement.planCode.startsWith("ENTERPRISE");

  const profileData: CompanyProfileData = profileRecord
    ? {
        companyName: profileRecord.companyName,
        registeredCapital: profileRecord.registeredCapital ?? "",
        certifications: Array.isArray(profileRecord.certifications)
          ? (profileRecord.certifications as string[])
          : [],
        qualifications: Array.isArray(profileRecord.qualifications)
          ? (profileRecord.qualifications as string[])
          : [],
        keyCases: Array.isArray(profileRecord.keyCases)
          ? (profileRecord.keyCases as Array<{ title: string; amount: string; year: string }>)
          : [],
      }
    : {
        companyName: "",
        registeredCapital: "",
        certifications: [],
        qualifications: [],
        keyCases: [],
      };

  const competitiveness = evaluateProfileCompetitiveness(profileRecord ? profileData : null);

  // 若企业尚未录入主体名称，则无法进行精准匹配
  if (!profileRecord || !profileRecord.companyName) {
    return {
      success: true,
      authenticated: true,
      hasProfile: false,
      isPlatinumOrAbove,
      data: {
        profile: null,
        competitiveness,
        items: [],
        totalScanned: 0,
        highCount: 0,
        mediumCount: 0,
        totalAvailable: 0,
        unlockedCount: 0,
        isPlatinumOrAbove,
      },
    };
  }

  // 扫描全网最新匹配商机
  const scanLimit = isPlatinumOrAbove ? 60 : 20;
  const scanResult = await scanMatchedOpportunities({
    profile: profileData,
    userId: session.uid,
    limit: scanLimit,
    type: options.type || undefined,
    provinceCode: options.provinceCode || undefined,
  });

  const totalAvailable = scanResult.items.length;
  // 商业化分级限制：免费用户仅展示前 3 条高匹配商机，其余需要升级白金版
  const displayLimit = isPlatinumOrAbove ? totalAvailable : Math.min(3, totalAvailable);
  const items = scanResult.items.slice(0, displayLimit);

  return {
    success: true,
    authenticated: true,
    hasProfile: true,
    isPlatinumOrAbove,
    data: {
      profile: profileData,
      competitiveness,
      items,
      totalScanned: scanResult.totalScanned,
      highCount: scanResult.highCount,
      mediumCount: scanResult.mediumCount,
      totalAvailable,
      unlockedCount: items.length,
      isPlatinumOrAbove,
    },
  };
}

/**
 * 将商机雷达推荐的项目一键加入跟进看板
 */
export async function addRadarItemToTrackerAction(tenderId: number): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "请先登录" };
  }

  try {
    const existing = await prisma.tenderFollow.findUnique({
      where: {
        userId_tenderId: {
          userId: session.uid,
          tenderId,
        },
      },
    });

    if (existing) {
      return { success: true, message: "该标讯已在跟进看板中" };
    }

    await prisma.tenderFollow.create({
      data: {
        userId: session.uid,
        tenderId,
        status: "EVALUATING",
        priority: "HIGH",
        notes: "由智能商机雷达推荐一键导入跟进看板",
      },
    });

    revalidatePath("/tracker");
    revalidatePath("/qualifications");
    return { success: true, message: "已成功加入跟进看板！" };
  } catch (err) {
    console.error("Failed to add radar tender to tracker:", err);
    return { success: false, error: "加入跟进看板失败，请稍后重试" };
  }
}
