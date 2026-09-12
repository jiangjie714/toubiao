"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { checkEnterpriseFit, type FitCheckResult } from "@/lib/ai/fit-checker";
import { getOrGenerateTenderAiAnalysis } from "@/lib/ai/bid-reader";
import type { CompanyProfileData } from "./company-profile";

export type FitCheckActionResponse = {
  success: boolean;
  authenticated: boolean;
  isLocked: boolean;
  lockReason?: string;
  hasProfile: boolean;
  profile?: CompanyProfileData | null;
  result?: FitCheckResult;
  error?: string;
};

export async function runEnterpriseFitCheckAction(
  tenderId: number,
): Promise<FitCheckActionResponse> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      authenticated: false,
      isLocked: true,
      hasProfile: false,
      lockReason: "请先登录后体验 AI 资质匹配与赢面测算",
    };
  }

  const entitlement = await getEntitlement(session.uid);
  const isAdmin = session.role === "ADMIN";
  const isPlatinumOrAbove =
    isAdmin ||
    entitlement.planCode === "PLATINUM" ||
    entitlement.planCode.startsWith("ENTERPRISE");

  if (!isPlatinumOrAbove) {
    return {
      success: false,
      authenticated: true,
      isLocked: true,
      hasProfile: false,
      lockReason: "AI 资质匹配与赢面测算为【白金版 / 企业定制版】专属特权。升级后可录入企业资质库，智能预估投标胜率与加减分点。",
    };
  }

  const profile = await prisma.companyProfile.findUnique({
    where: { userId: session.uid },
  });

  if (!profile) {
    return {
      success: true,
      authenticated: true,
      isLocked: false,
      hasProfile: false,
    };
  }

  const profileData: CompanyProfileData = {
    companyName: profile.companyName,
    registeredCapital: profile.registeredCapital ?? "",
    certifications: Array.isArray(profile.certifications)
      ? (profile.certifications as string[])
      : [],
    qualifications: Array.isArray(profile.qualifications)
      ? (profile.qualifications as string[])
      : [],
    keyCases: Array.isArray(profile.keyCases)
      ? (profile.keyCases as Array<{ title: string; amount: string; year: string }>)
      : [],
  };

  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
  });

  if (!tender) {
    return {
      success: false,
      authenticated: true,
      isLocked: false,
      hasProfile: true,
      error: "标书公告不存在",
    };
  }

  // 获取 AI 分析结果辅助打分
  const aiResult = await getOrGenerateTenderAiAnalysis(tenderId);

  const fitResult = checkEnterpriseFit(tender, aiResult.data, profileData);

  return {
    success: true,
    authenticated: true,
    isLocked: false,
    hasProfile: true,
    profile: profileData,
    result: fitResult,
  };
}
