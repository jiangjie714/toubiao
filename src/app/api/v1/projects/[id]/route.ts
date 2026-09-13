import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateProjectStage, projectStageLabel } from "@/lib/project";
import { tenderTypeLabel } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.statusCode || 401, message: auth.error },
      { status: auth.statusCode || 401 }
    );
  }

  const { id: rawId } = await params;
  const projectId = parseInt(rawId, 10);
  if (isNaN(projectId)) {
    return NextResponse.json(
      { code: 400, message: "无效的项目 ID 参数" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      notices: {
        orderBy: { publishDate: "asc" },
        include: {
          orgContacts: true,
          attachments: {
            select: {
              id: true,
              name: true,
              size: true,
              contentType: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json(
      { code: 404, message: "未找到该项目主数据" },
      { status: 404 }
    );
  }

  const stage = calculateProjectStage(project.notices);
  const stageLabel = projectStageLabel(stage);

  // 仲裁最高预算金额
  const budgets = project.notices
    .map((n) => (n.budgetAmount ? Number(n.budgetAmount) : null))
    .filter((b): b is number => b !== null && b > 0);
  const maxBudget = budgets.length > 0 ? Math.max(...budgets) : null;

  // 仲裁中标结果公告与金额
  const resultNotice = project.notices.find((n) => n.type === "RESULT" && n.awardAmount);
  const awardAmount = resultNotice?.awardAmount ? Number(resultNotice.awardAmount) : null;
  const winningSupplier =
    project.notices.find((n) => n.winningSupplier)?.winningSupplier || null;
  const purchaser = project.notices.find((n) => n.purchaser)?.purchaser || null;
  const agency = project.notices.find((n) => n.agency)?.agency || null;

  // 节约金额与节约率
  let savingsAmount: number | null = null;
  let savingsRate: number | null = null;
  if (maxBudget && awardAmount && maxBudget >= awardAmount) {
    savingsAmount = Number((maxBudget - awardAmount).toFixed(2));
    savingsRate = Number((((maxBudget - awardAmount) / maxBudget) * 100).toFixed(1));
  }

  // 构造编排时间线
  const timeline = project.notices.map((n) => ({
    tenderId: n.id,
    title: n.title,
    type: n.type,
    typeLabel: tenderTypeLabel(n.type),
    publishDate: n.publishDate.toISOString(),
    budgetAmount: n.budgetAmount ? Number(n.budgetAmount) : null,
    awardAmount: n.awardAmount ? Number(n.awardAmount) : null,
    purchaser: n.purchaser,
    agency: n.agency,
    winningSupplier: n.winningSupplier,
    sourceUrl: n.sourceUrl,
    attachmentsCount: n.attachments.length,
    attachments: n.attachments,
    contacts: n.orgContacts.map((c) => ({
      id: c.id,
      orgName: c.orgName,
      role: c.role,
      phone: c.phone,
      email: c.email,
      address: c.address,
    })),
  }));

  return NextResponse.json({
    code: 200,
    message: "success",
    data: {
      id: project.id,
      projectNo: project.projectNo,
      canonicalTitle: project.canonicalTitle,
      displayTitle: project.notices[0]?.title || project.canonicalTitle,
      provinceCode: project.provinceCode,
      stage,
      stageLabel,
      noticeCount: project.notices.length,
      budgetAmount: maxBudget,
      budgetAmountWan: maxBudget ? Number((maxBudget / 10000).toFixed(2)) : null,
      awardAmount,
      awardAmountWan: awardAmount ? Number((awardAmount / 10000).toFixed(2)) : null,
      savingsAmount,
      savingsRate,
      purchaser,
      agency,
      winningSupplier,
      firstSeenAt: project.firstSeenAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      timeline,
    },
    meta: {
      remainingQuota: auth.quotaRemaining,
    },
  });
}
