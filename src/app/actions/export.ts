"use server";

import { getSession } from "@/lib/auth";
import { getEntitlement, getExportQuota } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import { buildWhere, type ListSearchParams } from "@/lib/query";

export interface ExportFilterParams {
  q?: string;
  type?: string;
  province?: string;
  city?: string;
  from?: string;
  to?: string;
  hasBudget?: boolean;
  hasWinner?: boolean;
  minBudget?: number;
}

export interface UserExportQuotaInfo {
  authenticated: boolean;
  planCode: string;
  planName: string;
  canExport: boolean;
  canExportContacts: boolean;
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
  unlimited: boolean;
}

export interface ExportHistoryItem {
  id: number;
  createdAt: string;
  matchedCount: number;
  exportedCount: number;
  filters: Record<string, string>;
}

export async function getExportPreviewCountAction(
  filters: ExportFilterParams
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const searchParams: ListSearchParams = {
      q: filters.q,
      type: filters.type,
      province: filters.province,
      city: filters.city,
      from: filters.from,
      to: filters.to,
    };

    const where = buildWhere(searchParams);

    if (filters.hasBudget) {
      where.budgetAmount = { not: null };
    }
    if (filters.hasWinner) {
      where.winningSupplier = { not: null };
    }
    if (filters.minBudget && !isNaN(filters.minBudget)) {
      where.budgetAmount = { gte: filters.minBudget };
    }

    const count = await prisma.tender.count({ where });
    return { success: true, count };
  } catch (err) {
    console.error("Failed to calculate preview count:", err);
    return { success: false, count: 0, error: "计算符合条件的商机数量失败" };
  }
}

export async function getUserExportQuotaAction(): Promise<{
  success: boolean;
  data?: UserExportQuotaInfo;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return {
        success: false,
        error: "未登录",
        data: {
          authenticated: false,
          planCode: "GUEST",
          planName: "未登录访客",
          canExport: false,
          canExportContacts: false,
          dailyQuota: 0,
          usedToday: 0,
          remainingToday: 0,
          unlimited: false,
        },
      };
    }

    const entitlement = await getEntitlement(user.uid);
    const quotaStatus = await getExportQuota(user.uid);

    const dailyQuota = entitlement.features.exportDaily;
    const usedToday = quotaStatus.used;
    const canExport = dailyQuota > 0;
    const remainingToday = Math.max(0, dailyQuota - usedToday);
    const unlimited = entitlement.planCode.startsWith("ENTERPRISE");

    const canExportContacts =
      user.role === "ADMIN" ||
      entitlement.planCode === "PLATINUM" ||
      entitlement.planCode.startsWith("ENTERPRISE") ||
      entitlement.features.contacts;

    return {
      success: true,
      data: {
        authenticated: true,
        planCode: entitlement.planCode,
        planName: entitlement.planName,
        canExport,
        canExportContacts,
        dailyQuota,
        usedToday,
        remainingToday,
        unlimited,
      },
    };
  } catch (err) {
    console.error("Failed to get user export quota:", err);
    return { success: false, error: "获取导出配额失败" };
  }
}

export async function getUserExportHistoryAction(): Promise<{
  success: boolean;
  data?: ExportHistoryItem[];
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "未登录" };
    }

    const audits = await prisma.exportAudit.findMany({
      where: { userId: user.uid },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const items: ExportHistoryItem[] = audits.map((a) => ({
      id: a.id,
      createdAt: a.createdAt.toISOString().replace("T", " ").slice(0, 19),
      matchedCount: a.matchedCount,
      exportedCount: a.exportedCount,
      filters: (a.filters as Record<string, string>) || {},
    }));

    return { success: true, data: items };
  } catch (err) {
    console.error("Failed to get export history:", err);
    return { success: false, error: "获取导出历史失败" };
  }
}
