"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export type CompanyProfileData = {
  companyName: string;
  registeredCapital: string;
  certifications: string[]; // 如 ["ISO9001", "CMMI3", "高新技术企业"]
  qualifications: string[]; // 如 ["电子与智能化工程一级", "通信工程总承包二级"]
  keyCases: Array<{
    title: string;
    amount: string;
    year: string;
  }>;
};

export type CompanyProfileResponse = {
  success: boolean;
  authenticated: boolean;
  data?: CompanyProfileData | null;
  error?: string;
};

export async function getMyCompanyProfileAction(): Promise<CompanyProfileResponse> {
  const session = await getSession();
  if (!session) {
    return { success: false, authenticated: false, error: "请先登录" };
  }

  const profile = await prisma.companyProfile.findUnique({
    where: { userId: session.uid },
  });

  if (!profile) {
    return { success: true, authenticated: true, data: null };
  }

  return {
    success: true,
    authenticated: true,
    data: {
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
    },
  };
}

export async function saveCompanyProfileAction(
  formData: CompanyProfileData,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "请先登录" };
  }

  const companyName = formData.companyName.trim();
  if (!companyName) {
    return { success: false, error: "企业名称不能为空" };
  }

  try {
    await prisma.companyProfile.upsert({
      where: { userId: session.uid },
      update: {
        companyName,
        registeredCapital: formData.registeredCapital.trim() || null,
        certifications: formData.certifications || [],
        qualifications: formData.qualifications || [],
        keyCases: formData.keyCases || [],
      },
      create: {
        userId: session.uid,
        companyName,
        registeredCapital: formData.registeredCapital.trim() || null,
        certifications: formData.certifications || [],
        qualifications: formData.qualifications || [],
        keyCases: formData.keyCases || [],
      },
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to save company profile:", err);
    return { success: false, error: "保存企业资质档案失败，请稍后重试" };
  }
}
