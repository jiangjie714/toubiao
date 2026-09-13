import { prisma } from "@/lib/prisma";
import { canonicalizeTitle, findOrCreateProjectId } from "@/../crawler/projects";
import { calculateProjectStage } from "@/lib/project";

export interface ReaggregateResult {
  totalScanned: number;
  linked: number;
  newlyCreated: number;
  durationMs: number;
}

export interface GovernanceMetrics {
  totalProjects: number;
  totalTenders: number;
  linkedTenders: number;
  orphanTenders: number;
  multiNoticeProjects: number;
  linkedRate: number;
}

/**
 * 提取标题或正文中可能隐藏的项目编号
 */
export function extractProjectNo(text: string): string | null {
  if (!text) return null;
  // 匹配类似: 项目编号：XYZ-2024-001 或 招标编号: [2024]01号
  const match = text.match(/(?:项目编号|招标编号|采购编号|采购计划编号|标段编号|编号)\s*[:：]\s*([a-zA-Z0-9_\-\u4e00-\u9fa5（）()[\]【】]{4,40})/);
  if (match && match[1]) {
    const code = match[1].trim();
    // 过滤无意义的词语
    if (code.length >= 4 && !code.includes("见公告") && !code.includes("详见")) {
      return code;
    }
  }
  return null;
}

/**
 * 批量重扫全库孤儿标讯（projectRefId == null），通过编号与标题相似度自动归集到项目主数据
 */
export async function reaggregateOrphanTenders(): Promise<ReaggregateResult> {
  const startTime = Date.now();
  const orphans = await prisma.tender.findMany({
    where: { projectRefId: null },
    select: {
      id: true,
      title: true,
      projectNo: true,
      provinceCode: true,
      content: true,
    },
    take: 500, // 批量安全批次
  });

  let linkedCount = 0;
  let newlyCreatedCount = 0;

  for (const orphan of orphans) {
    let effectiveProjectNo = orphan.projectNo;
    if (!effectiveProjectNo) {
      // 尝试从正文或标题中补救提取
      const extracted = extractProjectNo(orphan.content) || extractProjectNo(orphan.title);
      if (extracted) {
        effectiveProjectNo = extracted;
        // 顺带回填 tender 表的 projectNo
        await prisma.tender.update({
          where: { id: orphan.id },
          data: { projectNo: extracted },
        });
      }
    }

    const beforeCount = await prisma.project.count();
    const projectId = await findOrCreateProjectId({
      projectNo: effectiveProjectNo ?? undefined,
      title: orphan.title,
      provinceCode: orphan.provinceCode,
    });
    const afterCount = await prisma.project.count();

    if (afterCount > beforeCount) {
      newlyCreatedCount++;
    }

    if (projectId) {
      await prisma.tender.update({
        where: { id: orphan.id },
        data: { projectRefId: projectId },
      });
      linkedCount++;

      // 增量刷新该项目的生命周期与多源信息
      await arbitrateProject(projectId);
    }
  }

  return {
    totalScanned: orphans.length,
    linked: linkedCount,
    newlyCreated: newlyCreatedCount,
    durationMs: Date.now() - startTime,
  };
}

/**
 * 多源仲裁与主数据归一计算
 * 跨所有关联公告，汇总判定真实生命周期阶段、最全项目编号、最高置信度预算、最终中标金额与供应商
 */
export async function arbitrateProject(projectId: number): Promise<{
  success: boolean;
  noticesCount: number;
  stage: string;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      notices: {
        orderBy: { publishDate: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          publishDate: true,
          projectNo: true,
          purchaser: true,
          winningSupplier: true,
          budgetAmount: true,
          awardAmount: true,
          provinceCode: true,
        },
      },
    },
  });

  if (!project) return { success: false, noticesCount: 0, stage: "UNKNOWN" };

  const notices = project.notices;
  if (notices.length === 0) {
    return { success: true, noticesCount: 0, stage: "EMPTY" };
  }

  // 1. 阶段判定
  const stage = calculateProjectStage(notices);

  // 2. 仲裁项目编号（若主数据无编号，优先取首个非冲突的有效编号）
  let resolvedProjectNo = project.projectNo;
  if (!resolvedProjectNo) {
    const firstWithNo = notices.find((n) => n.projectNo && n.projectNo.trim().length > 0);
    if (firstWithNo?.projectNo) {
      const candidate = firstWithNo.projectNo.trim();
      const existing = await prisma.project.findUnique({ where: { projectNo: candidate } });
      if (!existing || existing.id === projectId) {
        resolvedProjectNo = candidate;
      }
    }
  }

  // 3. 仲裁省份（优先取首个非空省份）
  let resolvedProvince = project.provinceCode;
  if (!resolvedProvince) {
    const firstWithProv = notices.find((n) => n.provinceCode && n.provinceCode.trim().length > 0);
    if (firstWithProv?.provinceCode) {
      resolvedProvince = firstWithProv.provinceCode;
    }
  }

  // 4. 更新主项目元数据与时间戳
  await prisma.project.update({
    where: { id: projectId },
    data: {
      projectNo: resolvedProjectNo,
      provinceCode: resolvedProvince,
      updatedAt: new Date(),
    },
  });

  return {
    success: true,
    noticesCount: notices.length,
    stage,
  };
}

/**
 * 手动合并两个项目主数据（治理纠偏）
 * 将源项目的关联公告全部转移到目标项目，并删除源项目
 */
export async function mergeProjects(
  sourceProjectId: number,
  targetProjectId: number,
  operator: string = "admin"
): Promise<{ success: boolean; migratedCount: number; message: string }> {
  if (sourceProjectId === targetProjectId) {
    throw new Error("源项目与目标项目不能相同");
  }

  const [source, target] = await Promise.all([
    prisma.project.findUnique({ where: { id: sourceProjectId }, include: { notices: true } }),
    prisma.project.findUnique({ where: { id: targetProjectId } }),
  ]);

  if (!source) throw new Error(`源项目 ID=${sourceProjectId} 不存在`);
  if (!target) throw new Error(`目标项目 ID=${targetProjectId} 不存在`);

  const noticesCount = source.notices.length;

  // 1. 迁移所有标讯
  await prisma.tender.updateMany({
    where: { projectRefId: sourceProjectId },
    data: { projectRefId: targetProjectId },
  });

  // 2. 删除源项目
  await prisma.project.delete({
    where: { id: sourceProjectId },
  });

  // 3. 对目标项目重新执行多源仲裁
  await arbitrateProject(targetProjectId);

  console.log(
    `[项目治理] 管理员 ${operator} 成功将项目 #${sourceProjectId} 合并到 #${targetProjectId}，迁移公告 ${noticesCount} 篇`
  );

  return {
    success: true,
    migratedCount: noticesCount,
    message: `成功将项目 #${sourceProjectId} 的 ${noticesCount} 篇公告合并到项目 #${targetProjectId}！`,
  };
}

/**
 * 标讯脱离拆分（治理纠偏）
 * 将误合并的单篇公告从原项目移出，为其独立建立新项目
 */
export async function detachTenderFromProject(
  tenderId: number,
  operator: string = "admin"
): Promise<{ success: boolean; newProjectId: number; message: string }> {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: { id: true, title: true, projectNo: true, provinceCode: true, projectRefId: true },
  });

  if (!tender) throw new Error("标讯不存在");
  const oldProjectId = tender.projectRefId;

  let safeProjectNo = tender.projectNo;
  if (safeProjectNo) {
    const conflict = await prisma.project.findUnique({ where: { projectNo: safeProjectNo } });
    if (conflict) {
      safeProjectNo = null;
    }
  }

  // 1. 新建独立项目
  const newProject = await prisma.project.create({
    data: {
      canonicalTitle: canonicalizeTitle(tender.title) || tender.title,
      projectNo: safeProjectNo,
      provinceCode: tender.provinceCode,
    },
  });

  // 2. 绑定到新项目
  await prisma.tender.update({
    where: { id: tenderId },
    data: { projectRefId: newProject.id },
  });

  // 3. 刷新新项目
  await arbitrateProject(newProject.id);

  // 4. 若原项目还有公告则重新仲裁，若无公告则清理
  if (oldProjectId) {
    const remaining = await prisma.tender.count({ where: { projectRefId: oldProjectId } });
    if (remaining === 0) {
      await prisma.project.delete({ where: { id: oldProjectId } });
    } else {
      await arbitrateProject(oldProjectId);
    }
  }

  console.log(`[项目治理] 管理员 ${operator} 将标讯 #${tenderId} 拆分至新项目 #${newProject.id}`);

  return {
    success: true,
    newProjectId: newProject.id,
    message: `标讯 #${tenderId} 已成功拆分为独立项目 #${newProject.id}！`,
  };
}

/**
 * 获取项目数据治理核心大盘指标
 */
export async function getProjectGovernanceMetrics(): Promise<GovernanceMetrics> {
  const [totalProjects, totalTenders, linkedTenders, orphanTenders] = await Promise.all([
    prisma.project.count(),
    prisma.tender.count(),
    prisma.tender.count({ where: { projectRefId: { not: null } } }),
    prisma.tender.count({ where: { projectRefId: null } }),
  ]);

  // 计算拥有 >= 2 篇公告的长周期项目数
  // 通过 groupBy
  const groups = await prisma.tender.groupBy({
    by: ["projectRefId"],
    where: { projectRefId: { not: null } },
    _count: { id: true },
    having: {
      id: {
        _count: {
          gte: 2,
        },
      },
    },
  });

  const multiNoticeProjects = groups.length;
  const linkedRate = totalTenders > 0 ? Number(((linkedTenders / totalTenders) * 100).toFixed(1)) : 0;

  return {
    totalProjects,
    totalTenders,
    linkedTenders,
    orphanTenders,
    multiNoticeProjects,
    linkedRate,
  };
}
