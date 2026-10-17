import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ProjectClusterInput {
  title: string;
  type: string;
  projectNo?: string | null;
  provinceCode?: string | null;
  purchaser?: string | null;
  content?: string | null;
  budgetAmount?: number | null;
  awardAmount?: number | null;
  openTime?: Date | null;
  clarifyDeadline?: Date | null;
  winningSupplier?: string | null;
}

export type ProjectStage =
  | "INTENTION"
  | "BIDDING"
  | "CLARIFYING"
  | "EVALUATING"
  | "AWARDED"
  | "TERMINATED";

/**
 * 标准化项目编号：去除标点符号、空格与包围符号
 */
export function normalizeProjectNo(rawNo?: string | null): string | null {
  if (!rawNo) return null;
  const clean = rawNo.replace(/[\[\]（）()【】\s：:_-]/g, "").trim();
  return clean.length >= 4 ? clean : null;
}

/**
 * 标题特征清洗与规范化：消除“采购意向”、“招标公告”、“变更公告”、“中标结果”等阶段词干扰
 */
export function canonicalizeProjectTitle(title: string): string {
  return title
    .replace(/[（(【\[][^（）()【】\[\]]*[）)】\]]/g, "")
    .replace(/^(?:关于|对|就|组织|开展)+/g, "")
    .replace(/(?:公开招标|邀请招标|竞争性谈判|竞争性磋商|询价采购|询价|单一来源|采购意向公开|采购意向|变更公告|更正公告|答疑纪要|澄清更正|中标候选人公示|中标结果公告|成交结果公告|废标公告|流标公告|招标公告|招标|采购|工程|项目)+/g, "")
    .replace(/第?[一二三四五六七八九十\d]+次/g, "")
    .replace(/[\s：:，,。.、\-—_/\\|]+/g, "")
    .replace(/(?:的)+$/g, "")
    .toLowerCase()
    .trim();
}

/**
 * 2-Gram 字符相似度计算
 */
export function calculateBigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (value: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < value.length - 1; i++) {
      const gram = value.slice(i, i + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  let intersection = 0;
  for (const [gram, count] of left) {
    intersection += Math.min(count, right.get(gram) ?? 0);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/**
 * 从更正/澄清公告正文中提取原招标公文编号或原项目引用溯源
 */
export function extractOriginProjectRef(content?: string | null): {
  originProjectNo?: string;
  originTitleSnippet?: string;
} {
  if (!content) return {};
  const clean = content.slice(0, 3000);

  // 1. 正则匹配原公告编号/原项目编号
  const noMatches = [
    /(?:原公告编号|原项目编号|原招标编号|原计划编号)[：:\s]*([a-zA-Z0-9_\-\u4e00-\u9fa5]{6,36})/i,
    /(?:项目编号|招标编号)[：:\s]*([a-zA-Z0-9_\-]{6,36})/i,
  ];
  for (const pat of noMatches) {
    const m = clean.match(pat);
    if (m && m[1] && m[1].length >= 6) {
      return { originProjectNo: m[1].trim() };
    }
  }

  // 2. 正则匹配原公告名称引用书名号
  const titleMatch = clean.match(
    /(?:对|就|原)[《“]([^”》]{6,40}(?:招标|采购|工程|项目)[^”》]*)[”》]/
  );
  if (titleMatch && titleMatch[1]) {
    return { originTitleSnippet: titleMatch[1].trim() };
  }

  return {};
}

/**
 * 推导公文所代表的生命周期阶段演进
 */
export function inferProjectStage(
  currentStage: string,
  newNoticeType: string
): ProjectStage {
  if (newNoticeType === "RESULT") return "AWARDED";
  if (newNoticeType === "CHANGE") {
    return currentStage === "AWARDED" ? "AWARDED" : "CLARIFYING";
  }
  if (newNoticeType === "NOTICE") {
    return currentStage === "AWARDED" || currentStage === "CLARIFYING"
      ? (currentStage as ProjectStage)
      : "BIDDING";
  }
  if (newNoticeType === "INQUIRY") {
    return currentStage === "AWARDED" ? "AWARDED" : "BIDDING";
  }
  return currentStage as ProjectStage;
}

/**
 * 核心级联启发式聚类引擎：跨源匹配或新建项目主数据并级联生命周期
 */
export async function cascadeClusterProject(
  input: ProjectClusterInput
): Promise<number | null> {
  const canonicalTitle = canonicalizeProjectTitle(input.title);
  if (!canonicalTitle || canonicalTitle.length < 2) return null;

  let matchedProjectId: number | null = null;
  const normNo = normalizeProjectNo(input.projectNo);

  // -------------------------------------------------------------
  // Layer 1: 严格项目编号精确匹配
  // -------------------------------------------------------------
  if (input.projectNo) {
    const existing = await prisma.project.findFirst({
      where: {
        OR: [
          { projectNo: input.projectNo },
          normNo ? { projectNo: { contains: normNo } } : {},
        ],
      },
      select: { id: true, stage: true },
    });
    if (existing) {
      matchedProjectId = existing.id;
    }
  }

  // -------------------------------------------------------------
  // Layer 2: 更正/澄清公告逆向溯源匹配
  // -------------------------------------------------------------
  if (!matchedProjectId && input.type === "CHANGE" && input.content) {
    const { originProjectNo, originTitleSnippet } = extractOriginProjectRef(input.content);
    if (originProjectNo) {
      const originMatch = await prisma.project.findFirst({
        where: { projectNo: { contains: originProjectNo } },
        select: { id: true },
      });
      if (originMatch) matchedProjectId = originMatch.id;
    }

    if (!matchedProjectId && originTitleSnippet) {
      const originCanonical = canonicalizeProjectTitle(originTitleSnippet);
      const candidates = await prisma.project.findMany({
        where: {
          canonicalTitle: { contains: originCanonical.slice(0, 10) },
          provinceCode: input.provinceCode ?? undefined,
        },
        take: 3,
        select: { id: true, canonicalTitle: true },
      });
      const best = candidates.find(
        (c) => calculateBigramSimilarity(originCanonical, c.canonicalTitle) >= 0.75
      );
      if (best) matchedProjectId = best.id;
    }
  }

  // -------------------------------------------------------------
  // Layer 3: 同买方单位 + 核心标段词高置信度合并
  // -------------------------------------------------------------
  if (!matchedProjectId && input.purchaser && input.purchaser.length >= 4) {
    const purchaserProjects = await prisma.project.findMany({
      where: {
        purchaserName: input.purchaser,
        provinceCode: input.provinceCode ?? undefined,
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
      select: { id: true, canonicalTitle: true },
    });

    const matchByPurchaser = purchaserProjects.find(
      (p) => calculateBigramSimilarity(canonicalTitle, p.canonicalTitle) >= 0.72
    );
    if (matchByPurchaser) {
      matchedProjectId = matchByPurchaser.id;
    }
  }

  // -------------------------------------------------------------
  // Layer 4: 标题模糊相似度近邻兜底
  // -------------------------------------------------------------
  if (!matchedProjectId) {
    const candidates = await prisma.project.findMany({
      where: {
        provinceCode: input.provinceCode ?? undefined,
      },
      take: 100,
      orderBy: { updatedAt: "desc" },
      select: { id: true, canonicalTitle: true },
    });

    const fuzzyMatch = candidates.find(
      (p) => calculateBigramSimilarity(canonicalTitle, p.canonicalTitle) >= 0.85
    );
    if (fuzzyMatch) {
      matchedProjectId = fuzzyMatch.id;
    }
  }

  // -------------------------------------------------------------
  // 数据更新与级联生命周期状态机
  // -------------------------------------------------------------
  if (matchedProjectId) {
    const current = await prisma.project.findUnique({
      where: { id: matchedProjectId },
    });

    if (current) {
      const nextStage = inferProjectStage(current.stage, input.type);
      const updateData: Prisma.ProjectUpdateInput = {
        updatedAt: new Date(),
        stage: nextStage,
      };

      if (!current.projectNo && input.projectNo) {
        updateData.projectNo = input.projectNo;
      }
      if (!current.purchaserName && input.purchaser) {
        updateData.purchaserName = input.purchaser;
      }
      if (input.budgetAmount && (!current.budgetTotal || Number(current.budgetTotal) === 0)) {
        updateData.budgetTotal = new Prisma.Decimal(input.budgetAmount);
      }
      if (input.awardAmount) {
        updateData.awardTotal = new Prisma.Decimal(input.awardAmount);
      }
      if (input.winningSupplier) {
        updateData.winnerName = input.winningSupplier;
      }
      if (input.openTime) {
        // 更正公告中若有新的开标时间，覆盖为最新延期时间
        updateData.bidOpenTime = input.openTime;
      }
      if (input.clarifyDeadline) {
        updateData.clarifyDeadline = input.clarifyDeadline;
      }

      await prisma.project.update({
        where: { id: matchedProjectId },
        data: updateData,
      });

      return matchedProjectId;
    }
  }

  // 若无匹配，新建项目主数据
  const initialStage: ProjectStage =
    input.type === "RESULT"
      ? "AWARDED"
      : input.type === "CHANGE"
      ? "CLARIFYING"
      : "BIDDING";

  const created = await prisma.project.create({
    data: {
      projectNo: input.projectNo || null,
      canonicalTitle,
      provinceCode: input.provinceCode || null,
      purchaserName: input.purchaser || null,
      stage: initialStage,
      budgetTotal: input.budgetAmount ? new Prisma.Decimal(input.budgetAmount) : null,
      awardTotal: input.awardAmount ? new Prisma.Decimal(input.awardAmount) : null,
      winnerName: input.winningSupplier || null,
      bidOpenTime: input.openTime || null,
      clarifyDeadline: input.clarifyDeadline || null,
    },
    select: { id: true },
  });

  return created.id;
}
