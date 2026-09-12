import { prisma } from "../src/lib/prisma";
import { extractWinnerAndProject } from "../src/lib/pipeline/winner-extractor";

async function main() {
  console.log("=== 开始执行中标供应商、标的金额与项目生命周期主数据全库抽取与关联 ===");

  const tenders = await prisma.tender.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      type: true,
      provinceCode: true,
      winningSupplier: true,
      awardAmount: true,
      budgetAmount: true,
      projectNo: true,
      projectRefId: true,
      publishDate: true,
    },
    orderBy: { id: "asc" },
  });

  let winnerUpdatedCount = 0;
  let awardUpdatedCount = 0;
  let budgetUpdatedCount = 0;
  let projectNoUpdatedCount = 0;

  for (const t of tenders) {
    const extracted = extractWinnerAndProject(t.content, t.title);
    const updateData: Record<string, unknown> = {};

    // 1. 中标供应商
    if (!t.winningSupplier && extracted.winningSupplier && (t.type === "RESULT" || t.title.includes("中标") || t.title.includes("结果") || t.title.includes("成交"))) {
      updateData.winningSupplier = extracted.winningSupplier;
      winnerUpdatedCount++;
    }

    // 2. 中标金额 (万元)
    if (!t.awardAmount && extracted.awardAmountWan && (t.type === "RESULT" || t.title.includes("中标") || t.title.includes("结果") || t.title.includes("成交"))) {
      updateData.awardAmount = extracted.awardAmountWan;
      awardUpdatedCount++;
    }

    // 3. 预算金额 (万元)
    if (!t.budgetAmount && extracted.budgetAmountWan) {
      updateData.budgetAmount = extracted.budgetAmountWan;
      budgetUpdatedCount++;
    }

    // 4. 项目编号
    if (!t.projectNo && extracted.projectNo) {
      updateData.projectNo = extracted.projectNo;
      projectNoUpdatedCount++;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.tender.update({
        where: { id: t.id },
        data: updateData,
      });
    }
  }

  console.log(`[字段提取完成] 补充中标商: ${winnerUpdatedCount} 条, 中标金额: ${awardUpdatedCount} 条, 预算金额: ${budgetUpdatedCount} 条, 项目编号: ${projectNoUpdatedCount} 条`);

  // 5. 聚合与构建 Project 主数据
  console.log("=== 正在聚合项目主数据 (Project Lifecycle) ===");
  const allTendersWithProjectNo = await prisma.tender.findMany({
    where: { projectNo: { not: null } },
    select: { id: true, title: true, projectNo: true, provinceCode: true, publishDate: true, projectRefId: true },
    orderBy: { publishDate: "asc" },
  });

  // 按 projectNo 分组
  const projectMap = new Map<string, typeof allTendersWithProjectNo>();
  for (const t of allTendersWithProjectNo) {
    const pNo = t.projectNo!.trim();
    if (!pNo || pNo.length < 4) continue;
    if (!projectMap.has(pNo)) projectMap.set(pNo, []);
    projectMap.get(pNo)!.push(t);
  }

  let projectsCreated = 0;
  let tendersLinkedToProjects = 0;

  for (const [pNo, notices] of projectMap.entries()) {
    // 寻找或创建 Project
    let project = await prisma.project.findUnique({
      where: { projectNo: pNo },
    });

    if (!project) {
      // 取最早的公告标题作为主标题
      const canonicalTitle = notices[0].title
        .replace(/（招标公告.*$/, "")
        .replace(/中标(?:结果)?公告$/, "")
        .trim();

      project = await prisma.project.create({
        data: {
          projectNo: pNo,
          canonicalTitle: canonicalTitle || notices[0].title,
          provinceCode: notices[0].provinceCode || null,
          firstSeenAt: notices[0].publishDate,
        },
      });
      projectsCreated++;
    }

    // 关联 notice 到 project
    for (const n of notices) {
      if (n.projectRefId !== project.id) {
        await prisma.tender.update({
          where: { id: n.id },
          data: { projectRefId: project.id },
        });
        tendersLinkedToProjects++;
      }
    }
  }

  const finalStats = {
    totalTenders: await prisma.tender.count(),
    totalWithWinner: await prisma.tender.count({ where: { winningSupplier: { not: null } } }),
    totalWithAward: await prisma.tender.count({ where: { awardAmount: { not: null } } }),
    totalWithBudget: await prisma.tender.count({ where: { budgetAmount: { not: null } } }),
    totalWithProjectNo: await prisma.tender.count({ where: { projectNo: { not: null } } }),
    totalProjects: await prisma.project.count(),
    linkedTenders: await prisma.tender.count({ where: { projectRefId: { not: null } } }),
  };

  console.log("=== 抽取与聚合完成 ===");
  console.log(`新建 Project 主项目: ${projectsCreated} 个, 关联标讯条数: ${tendersLinkedToProjects} 条`);
  console.log("全库结构化现状指标:", finalStats);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
