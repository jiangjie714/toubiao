import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateProjectStage, projectStageLabel } from "@/lib/project";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.statusCode || 401, message: auth.error },
      { status: auth.statusCode || 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const stage = searchParams.get("stage")?.trim() || "";
  const province = searchParams.get("province")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { canonicalTitle: { contains: q } },
      { projectNo: { contains: q } },
      {
        notices: {
          some: {
            OR: [
              { title: { contains: q } },
              { purchaser: { contains: q } },
              { winningSupplier: { contains: q } },
            ],
          },
        },
      },
    ];
  }

  if (province) {
    where.provinceCode = province;
  }

  const [total, rawProjects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: {
        notices: {
          orderBy: { publishDate: "desc" },
          select: {
            id: true,
            title: true,
            type: true,
            publishDate: true,
            budgetAmount: true,
            awardAmount: true,
            purchaser: true,
            winningSupplier: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = rawProjects
    .map((p) => {
      const stageVal = calculateProjectStage(p.notices);
      const stageLabelVal = projectStageLabel(stageVal);

      // 仲裁预算金额
      const budgets = p.notices
        .map((n) => (n.budgetAmount ? Number(n.budgetAmount) : null))
        .filter((b): b is number => b !== null && b > 0);
      const maxBudget = budgets.length > 0 ? Math.max(...budgets) : null;

      // 仲裁中标金额与中标商
      const resultNotice = p.notices.find((n) => n.type === "RESULT" && n.awardAmount);
      const awardAmount = resultNotice?.awardAmount ? Number(resultNotice.awardAmount) : null;
      const winningSupplier =
        p.notices.find((n) => n.winningSupplier)?.winningSupplier || null;

      const purchaser = p.notices.find((n) => n.purchaser)?.purchaser || null;
      const displayTitle = p.notices[0]?.title || p.canonicalTitle;

      return {
        id: p.id,
        projectNo: p.projectNo,
        canonicalTitle: p.canonicalTitle,
        displayTitle,
        provinceCode: p.provinceCode,
        stage: stageVal,
        stageLabel: stageLabelVal,
        noticeCount: p.notices.length,
        budgetAmount: maxBudget,
        budgetAmountWan: maxBudget ? Number((maxBudget / 10000).toFixed(2)) : null,
        awardAmount,
        awardAmountWan: awardAmount ? Number((awardAmount / 10000).toFixed(2)) : null,
        purchaser,
        winningSupplier,
        firstSeenAt: p.firstSeenAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    })
    .filter((item) => {
      if (stage && stage !== "all" && item.stage !== stage) {
        return false;
      }
      return true;
    });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    code: 200,
    message: "success",
    data: {
      total,
      page,
      pageSize,
      totalPages,
      items,
    },
    meta: {
      remainingQuota: auth.quotaRemaining,
    },
  });
}
