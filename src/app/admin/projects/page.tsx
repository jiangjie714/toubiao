import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectGovernanceMetrics } from "@/lib/project-arbitration";
import { calculateProjectStage, projectStageLabel } from "@/lib/project";
import ProjectsManagerView, {
  type AdminProjectRow,
} from "@/components/admin/projects-manager-view";

export const metadata = {
  title: "项目主数据与多源仲裁治理中枢 - 标讯通管理后台",
};

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    province?: string;
    multi?: string;
    page?: string;
  }>;
}) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    redirect("/login?next=/admin/projects");
  }

  const {
    q = "",
    stage = "all",
    province = "",
    multi = "",
    page = "1",
  } = await searchParams;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = 20;

  // 1. 获取全局资产指标与省份列表
  const [metrics, provinces] = await Promise.all([
    getProjectGovernanceMetrics(),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const provinceMap = new Map(provinces.map((p) => [p.code, p.name]));

  // 2. 构造查询条件
  const where: Record<string, unknown> = {};

  if (q.trim()) {
    const query = q.trim();
    where.OR = [
      { canonicalTitle: { contains: query } },
      { projectNo: { contains: query } },
      {
        notices: {
          some: {
            OR: [
              { title: { contains: query } },
              { purchaser: { contains: query } },
              { winningSupplier: { contains: query } },
            ],
          },
        },
      },
    ];
  }

  if (province) {
    where.provinceCode = province;
  }

  // 3. 统计总数
  const totalItems = await prisma.project.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // 4. 分页加载项目
  const rawProjects = await prisma.project.findMany({
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
    skip: (pageNum - 1) * pageSize,
    take: pageSize,
  });

  // 5. 格式化数据行并进行阶段判定与多源仲裁推演
  const formattedProjects: AdminProjectRow[] = [];

  for (const p of rawProjects) {
    const stageVal = calculateProjectStage(p.notices);
    const stageLabelVal = projectStageLabel(stageVal);

    // 阶段过滤
    if (stage !== "all" && stageVal !== stage) {
      continue;
    }

    // 仅看多公告穿透
    if (multi === "1" && p.notices.length < 2) {
      continue;
    }

    // 仲裁最高预算
    const budgets = p.notices
      .map((n) => (n.budgetAmount ? Number(n.budgetAmount) : null))
      .filter((b): b is number => b !== null && b > 0);
    const maxBudget = budgets.length > 0 ? Math.max(...budgets) : null;

    // 仲裁中标金额与中标商
    const resultNotice = p.notices.find((n) => n.type === "RESULT" && n.awardAmount);
    const awardAmount = resultNotice?.awardAmount ? Number(resultNotice.awardAmount) : null;
    const winningSupplier =
      p.notices.find((n) => n.winningSupplier)?.winningSupplier || null;

    // 仲裁采购人
    const purchaser = p.notices.find((n) => n.purchaser)?.purchaser || null;

    // 显示标题优先取第一篇非空标题
    const displayTitle = p.notices[0]?.title || p.canonicalTitle;

    formattedProjects.push({
      id: p.id,
      projectNo: p.projectNo,
      canonicalTitle: p.canonicalTitle,
      displayTitle,
      provinceCode: p.provinceCode,
      provinceName: p.provinceCode ? provinceMap.get(p.provinceCode) || null : null,
      stage: stageVal,
      stageLabel: stageLabelVal,
      noticeCount: p.notices.length,
      budgetAmountWan: maxBudget ? Number((maxBudget / 10000).toFixed(2)) : null,
      awardAmountWan: awardAmount ? Number((awardAmount / 10000).toFixed(2)) : null,
      purchaser,
      winningSupplier,
      firstSeenAt: p.firstSeenAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      notices: p.notices.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        publishDate: n.publishDate.toISOString(),
        budgetAmount: n.budgetAmount ? Number(n.budgetAmount) : null,
        awardAmount: n.awardAmount ? Number(n.awardAmount) : null,
        purchaser: n.purchaser,
        winningSupplier: n.winningSupplier,
      })),
    });
  }

  return (
    <ProjectsManagerView
      initialProjects={formattedProjects}
      metrics={metrics}
      provinces={provinces}
      currentPage={pageNum}
      totalPages={totalPages}
      totalItems={totalItems}
    />
  );
}
