"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import {
  getTenderCompareData,
  type TenderCompareResult,
} from "@/lib/tender-compare";

export type CompareActionResponse = {
  success: boolean;
  data?: TenderCompareResult;
  error?: string;
};

export async function getTenderCompareAction(
  ids: number[]
): Promise<CompareActionResponse> {
  try {
    const user = await getSession();
    const entitlement = user ? await getEntitlement(user.uid) : null;
    const isVip =
      user?.role === "ADMIN" ||
      (entitlement && entitlement.planCode !== "FREE");

    const maxLimit = isVip ? 4 : 2;
    const planName = entitlement?.planName || "免费版";

    const data = await getTenderCompareData(ids, {
      maxLimit,
      planName,
    });

    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error("getTenderCompareAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取标段对比数据失败",
    };
  }
}

export type TenderCandidate = {
  id: number;
  title: string;
  type: string;
  budgetAmount: number | null;
  purchaser: string | null;
  publishDate: string;
};

/**
 * 在对比罗盘中快速搜索备选标讯添加对比
 */
export async function searchTendersForCompareAction(
  query: string
): Promise<{ success: boolean; data?: TenderCandidate[]; error?: string }> {
  try {
    const q = query.trim();
    if (!q) return { success: true, data: [] };

    const parsedId = parseInt(q, 10);
    const isIdQuery = !isNaN(parsedId) && String(parsedId) === q;

    const tenders = await prisma.tender.findMany({
      where: isIdQuery
        ? { id: parsedId }
        : {
            title: {
              contains: q,
              mode: "insensitive",
            },
          },
      select: {
        id: true,
        title: true,
        type: true,
        budgetAmount: true,
        purchaser: true,
        publishDate: true,
      },
      orderBy: { publishDate: "desc" },
      take: 8,
    });

    return {
      success: true,
      data: tenders.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        budgetAmount: t.budgetAmount ? Number(t.budgetAmount) : null,
        purchaser: t.purchaser,
        publishDate: t.publishDate.toISOString().slice(0, 10),
      })),
    };
  } catch (err) {
    console.error("searchTendersForCompareAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "搜索标讯失败",
    };
  }
}
