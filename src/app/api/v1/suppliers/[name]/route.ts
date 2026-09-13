import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { tenderTypeLabel } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.statusCode || 401, message: auth.error },
      { status: auth.statusCode || 401 }
    );
  }

  const { name: rawName } = await params;
  const supplierName = decodeURIComponent(rawName || "").trim();

  if (!supplierName) {
    return NextResponse.json(
      { code: 400, message: "供应商名称不能为空" },
      { status: 400 }
    );
  }

  // 1. 查询该供应商的所有中标/成交标讯
  const winTenders = await prisma.tender.findMany({
    where: { winningSupplier: { contains: supplierName } },
    orderBy: { publishDate: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      publishDate: true,
      budgetAmount: true,
      awardAmount: true,
      purchaser: true,
      provinceCode: true,
      projectRefId: true,
    },
  });

  if (winTenders.length === 0) {
    return NextResponse.json(
      { code: 404, message: `未找到供应商「${supplierName}」的中标成交数据` },
      { status: 404 }
    );
  }

  // 2. 统计中标总额与买方分布网络
  let totalWinAmount = 0;
  const purchaserMap = new Map<string, { count: number; totalAmount: number }>();
  const provinceCount = new Map<string, number>();

  for (const t of winTenders) {
    if (t.awardAmount) {
      totalWinAmount += Number(t.awardAmount);
    }
    if (t.purchaser) {
      const p = t.purchaser.trim();
      const curr = purchaserMap.get(p) || { count: 0, totalAmount: 0 };
      curr.count += 1;
      if (t.awardAmount) {
        curr.totalAmount += Number(t.awardAmount);
      }
      purchaserMap.set(p, curr);
    }
    if (t.provinceCode) {
      provinceCount.set(t.provinceCode, (provinceCount.get(t.provinceCode) || 0) + 1);
    }
  }

  // 核心买方客户网络
  const topPurchasers = Array.from(purchaserMap.entries())
    .map(([purchaser, stat]) => ({
      purchaser,
      dealCount: stat.count,
      totalAmount: stat.totalAmount,
      totalAmountWan: Number((stat.totalAmount / 10000).toFixed(2)),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || b.dealCount - a.dealCount)
    .slice(0, 10);

  // 核心胜标区域
  const mainProvince = Array.from(provinceCount.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] || null;

  return NextResponse.json({
    code: 200,
    message: "success",
    data: {
      supplierName,
      mainProvinceCode: mainProvince,
      totalWinCount: winTenders.length,
      totalWinAmount,
      totalWinAmountWan: Number((totalWinAmount / 10000).toFixed(2)),
      topPurchaserClients: topPurchasers,
      recentWinningTenders: winTenders.slice(0, 15).map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        typeLabel: tenderTypeLabel(t.type),
        publishDate: t.publishDate.toISOString(),
        budgetAmount: t.budgetAmount ? Number(t.budgetAmount) : null,
        awardAmount: t.awardAmount ? Number(t.awardAmount) : null,
        purchaser: t.purchaser,
        projectId: t.projectRefId,
      })),
    },
    meta: {
      remainingQuota: auth.quotaRemaining,
    },
  });
}
