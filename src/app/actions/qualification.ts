"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  calculateQualificationStatus,
  summarizeQualifications,
  matchQualificationsForTender,
  QUALIFICATION_CATEGORIES,
  type QualificationCategory,
  type CompanyQualificationItem,
  type QualificationSummary,
  type TenderQualificationMatchAnalysis,
} from "@/lib/qualification-manager";
import { formatDate } from "@/lib/constants";

export interface QualificationsListResponse {
  success: boolean;
  qualifications?: CompanyQualificationItem[];
  summary?: QualificationSummary;
  companyName?: string;
  error?: string;
}

/**
 * 获取当前用户/团队的资质证书资产库与指标汇总
 */
export async function getQualificationsAction(): Promise<QualificationsListResponse> {
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

    const records = await prisma.companyQualification.findMany({
      where: whereCondition,
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    });

    const items: CompanyQualificationItem[] = records.map((r) => {
      const {
        daysRemaining,
        status,
        statusLabel,
        annualInspectDaysRemaining,
        isAnnualInspectDue,
      } = calculateQualificationStatus(r.expiryDate, r.annualInspectDate);

      const category = (r.category as QualificationCategory) in QUALIFICATION_CATEGORIES
        ? (r.category as QualificationCategory)
        : "MANAGEMENT";

      return {
        id: r.id,
        userId: r.userId,
        name: r.name,
        category,
        categoryLabel: QUALIFICATION_CATEGORIES[category]?.label || "管理体系认证",
        certNo: r.certNo,
        issuingAuthority: r.issuingAuthority,
        issueDate: r.issueDate ? formatDate(r.issueDate) : null,
        expiryDate: formatDate(r.expiryDate),
        daysRemaining,
        status,
        statusLabel,
        annualInspectDate: r.annualInspectDate ? formatDate(r.annualInspectDate) : null,
        annualInspectDaysRemaining,
        isAnnualInspectDue,
        coverageScope: r.coverageScope,
        level: r.level,
        certFileUrl: r.certFileUrl,
        notes: r.notes,
        teamId: r.teamId,
        createdAt: formatDate(r.createdAt),
      };
    });

    const summary = summarizeQualifications(items);

    return {
      success: true,
      qualifications: items,
      summary,
      companyName,
    };
  } catch (err) {
    console.error("Error in getQualificationsAction:", err);
    return { success: false, error: "获取资质证书库失败，请稍后刷新重试" };
  }
}

export interface SaveQualificationInput {
  id?: number;
  name: string;
  category: QualificationCategory;
  certNo?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate: string;
  annualInspectDate?: string;
  coverageScope?: string;
  level?: string;
  certFileUrl?: string;
  notes?: string;
}

/**
 * 新增或编辑企业资质证书资产
 */
export async function saveQualificationAction(
  data: SaveQualificationInput
): Promise<{ success: boolean; qualificationId?: number; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    if (!data.name || data.name.trim().length < 2) {
      return { success: false, error: "资质/证书全称不得少于 2 个字" };
    }

    if (!data.expiryDate) {
      return { success: false, error: "请填写证书有效期截止日期" };
    }

    const expiryDate = new Date(data.expiryDate);
    if (isNaN(expiryDate.getTime())) {
      return { success: false, error: "有效期截止日期格式不正确" };
    }

    let issueDate: Date | null = null;
    if (data.issueDate) {
      const d = new Date(data.issueDate);
      if (!isNaN(d.getTime())) issueDate = d;
    }

    let annualInspectDate: Date | null = null;
    if (data.annualInspectDate) {
      const d = new Date(data.annualInspectDate);
      if (!isNaN(d.getTime())) annualInspectDate = d;
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.uid },
      select: { teamId: true },
    });
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: user.uid },
      select: { id: true },
    });
    const teamId = teamMember?.teamId || ownedTeam?.id || null;

    const { status } = calculateQualificationStatus(expiryDate, annualInspectDate);

    const payload = {
      name: data.name.trim(),
      category: data.category || "MANAGEMENT",
      certNo: data.certNo?.trim() || null,
      issuingAuthority: data.issuingAuthority?.trim() || null,
      issueDate,
      expiryDate,
      status,
      annualInspectDate,
      coverageScope: data.coverageScope?.trim() || null,
      level: data.level?.trim() || null,
      certFileUrl: data.certFileUrl?.trim() || null,
      notes: data.notes?.trim() || null,
    };

    let recordId: number;

    if (data.id) {
      // 权限核查
      const existing = await prisma.companyQualification.findUnique({
        where: { id: data.id },
      });
      if (!existing) {
        return { success: false, error: "待修改的证书记录不存在" };
      }
      if (existing.userId !== user.uid && (!teamId || existing.teamId !== teamId)) {
        return { success: false, error: "无权修改其他企业/成员的资质证书" };
      }

      const updated = await prisma.companyQualification.update({
        where: { id: data.id },
        data: payload,
      });
      recordId = updated.id;
    } else {
      const created = await prisma.companyQualification.create({
        data: {
          ...payload,
          userId: user.uid,
          teamId,
        },
      });
      recordId = created.id;
    }

    revalidatePath("/qualifications");
    return { success: true, qualificationId: recordId };
  } catch (err) {
    console.error("Error in saveQualificationAction:", err);
    return { success: false, error: "保存资质证书失败，请稍后重试" };
  }
}

/**
 * 删除指定的资质证书
 */
export async function deleteQualificationAction(
  qualificationId: number
): Promise<{ success: boolean; error?: string }> {
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
    const teamId = teamMember?.teamId || ownedTeam?.id || null;

    const existing = await prisma.companyQualification.findUnique({
      where: { id: qualificationId },
    });
    if (!existing) {
      return { success: false, error: "证书记录不存在或已被删除" };
    }
    if (existing.userId !== user.uid && (!teamId || existing.teamId !== teamId)) {
      return { success: false, error: "无权删除其他企业/成员的资质证书" };
    }

    await prisma.companyQualification.delete({
      where: { id: qualificationId },
    });

    revalidatePath("/qualifications");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteQualificationAction:", err);
    return { success: false, error: "删除失败，请稍后重试" };
  }
}

/**
 * 针对指定招标项目，执行资质门槛智能初审与匹配对标
 */
export async function getTenderQualificationMatchAction({
  tenderId,
}: {
  tenderId: number;
}): Promise<{
  success: boolean;
  data?: TenderQualificationMatchAnalysis;
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
      },
    });

    if (!tender) {
      return { success: false, error: "未找到指定的标讯公告" };
    }

    const listRes = await getQualificationsAction();
    const qualifications = listRes.qualifications || [];

    const analysis = matchQualificationsForTender(tender, qualifications);

    return {
      success: true,
      data: analysis,
      companyName: listRes.companyName,
    };
  } catch (err) {
    console.error("Error in getTenderQualificationMatchAction:", err);
    return { success: false, error: "资格智能初审对标失败，请稍后重试" };
  }
}
