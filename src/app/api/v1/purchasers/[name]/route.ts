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
  const purchaserName = decodeURIComponent(rawName || "").trim();

  if (!purchaserName) {
    return NextResponse.json(
      { code: 400, message: "采购人名称不能为空" },
      { status: 400 }
    );
  }

  // 1. 查询该采购人的所有历史标讯
  const tenders = await prisma.tender.findMany({
    where: { purchaser: { contains: purchaserName } },
    orderBy: { publishDate: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      publishDate: true,
      budgetAmount: true,
      awardAmount: true,
      provinceCode: true,
      winningSupplier: true,
      projectRefId: true,
    },
  });

  if (tenders.length === 0) {
    return NextResponse.json(
      { code: 404, message: `未找到采购人「${purchaserName}」的相关标讯数据` },
      { status: 404 }
    );
  }

  // 2. 统计指标计算
  let totalBudget = 0;
  let totalAward = 0;
  const supplierMap = new Map<string, { count: number; totalAmount: number }>();
  const provinceCount = new Map<string, number>();

  for (const t of tenders) {
    if (t.budgetAmount) {
      totalBudget += Number(t.budgetAmount);
    }
    if (t.awardAmount) {
      totalAward += Number(t.awardAmount);
    }
    if (t.winningSupplier) {
      const s = t.winningSupplier.trim();
      const curr = supplierMap.get(s) || { count: 0, totalAmount: 0 };
      curr.count += 1;
      if (t.awardAmount) {
        curr.totalAmount += Number(t.awardAmount);
      }
      supplierMap.set(s, curr);
    }
    if (t.provinceCode) {
      provinceCount.set(t.provinceCode, (provinceCount.get(t.provinceCode) || 0) + 1);
    }
  }

  // 核心合作供应商排行榜
  const topSuppliers = Array.from(supplierMap.entries())
    .map(([supplier, stat]) => ({
      supplier,
      dealCount: stat.count,
      totalAmount: stat.totalAmount,
      totalAmountWan: Number((stat.totalAmount / 10000).toFixed(2)),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || b.dealCount - a.dealCount)
    .slice(0, 10);

  // 主要采购区域
  const mainProvince = Array.from(provinceCount.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] || null;

  return NextResponse.json({
    code: 200,
    message: "success",
    data: {
      purchaserName,
      mainProvinceCode: mainProvince,
      tenderCount: tenders.length,
      totalBudgetAmount: totalBudget,
      totalBudgetAmountWan: Number((totalBudget / 10000).toFixed(2)),
      totalAwardAmount: totalAward,
      totalAwardAmountWan: Number((totalAward / 10000).toFixed(2)),
      topCooperatingSuppliers: topSuppliers,
      recentTenders: tenders.slice(0, 15).map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        typeLabel: tenderTypeLabel(t.type),
        publishDate: t.publishDate.toISOString(),
        budgetAmount: t.budgetAmount ? Number(t.budgetAmount) : null,
        awardAmount: t.awardAmount ? Number(t.awardAmount) : null,
        winningSupplier: t.winningSupplier,
        projectId: t.projectRefId,
      })),
    },
    meta: {
      remainingQuota: auth.quotaRemaining,
    },
  });
}
