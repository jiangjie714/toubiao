import { prisma } from "@/lib/prisma";
import { tenderTypeLabel, tenderTypeColor } from "@/lib/constants";

export interface TimelineNotice {
  id: number;
  title: string;
  type: string;
  typeLabel: string;
  typeColor: string;
  publishDate: string;
  isCurrent: boolean;
  budgetOrAward?: string;
}

export interface ProjectTimelineData {
  hasMultipleNotices: boolean;
  projectNo: string | null;
  projectName: string;
  notices: TimelineNotice[];
}

export async function getProjectTimeline(tenderId: number): Promise<ProjectTimelineData> {
  const current = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: {
      id: true,
      title: true,
      type: true,
      projectNo: true,
      projectRefId: true,
      publishDate: true,
      budgetAmount: true,
      awardAmount: true,
    },
  });

  if (!current) {
    return {
      hasMultipleNotices: false,
      projectNo: null,
      projectName: "",
      notices: [],
    };
  }

  let notices: Array<{
    id: number;
    title: string;
    type: string;
    publishDate: Date;
    budgetAmount: unknown;
    awardAmount: unknown;
  }> = [];

  if (current.projectNo && current.projectNo.trim().length >= 4) {
    // 1. 优先按项目编号精确匹配关联全周期公告
    notices = await prisma.tender.findMany({
      where: { projectNo: current.projectNo.trim() },
      select: {
        id: true,
        title: true,
        type: true,
        publishDate: true,
        budgetAmount: true,
        awardAmount: true,
      },
      orderBy: { publishDate: "asc" },
    });
  } else if (current.projectRefId) {
    // 2. 按 projectRefId 关联匹配
    notices = await prisma.tender.findMany({
      where: { projectRefId: current.projectRefId },
      select: {
        id: true,
        title: true,
        type: true,
        publishDate: true,
        budgetAmount: true,
        awardAmount: true,
      },
      orderBy: { publishDate: "asc" },
    });
  }

  // 若仅有当前单条，兜底显示自身
  if (notices.length === 0) {
    notices = [current];
  }

  const timelineNotices: TimelineNotice[] = notices.map((n) => {
    let money = "";
    if (n.awardAmount) money = `中标: ${Number(n.awardAmount)}万元`;
    else if (n.budgetAmount) money = `预算: ${Number(n.budgetAmount)}万元`;

    return {
      id: n.id,
      title: n.title,
      type: n.type,
      typeLabel: tenderTypeLabel(n.type),
      typeColor: tenderTypeColor(n.type),
      publishDate: n.publishDate.toISOString().slice(0, 10),
      isCurrent: n.id === current.id,
      budgetOrAward: money || undefined,
    };
  });

  return {
    hasMultipleNotices: timelineNotices.length > 1,
    projectNo: current.projectNo,
    projectName: current.title,
    notices: timelineNotices,
  };
}
