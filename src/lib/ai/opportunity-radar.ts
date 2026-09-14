import { prisma } from "../prisma";
import type { CompanyProfileData } from "@/app/actions/company-profile";

export interface OpportunityMatchItem {
  tenderId: number;
  title: string;
  type: string;
  publishDate: string;
  expireDate?: string | null;
  budgetAmountWan?: number | null;
  awardAmountWan?: number | null;
  purchaser?: string | null;
  provinceName?: string | null;
  cityName?: string | null;
  matchScore: number; // 0 - 100
  matchLevel: "HIGH" | "MEDIUM" | "LOW";
  matchRate: number; // 资质符合度 %
  dimensionScores: {
    qualification: number;
    performance: number;
    capitalStrength: number;
  };
  strengths: string[];
  gaps: string[];
  isFollowed?: boolean;
}

export interface ProfileCompetitivenessReport {
  healthScore: number; // 0 - 100
  level: "完善" | "良好" | "待补全";
  summary: string;
  stats: {
    certificationsCount: number;
    qualificationsCount: number;
    keyCasesCount: number;
    hasRegisteredCapital: boolean;
  };
  suggestions: string[];
}

/**
 * 评估企业资质资产的完备度与竞争力健康分
 */
export function evaluateProfileCompetitiveness(
  profile: CompanyProfileData | null | undefined
): ProfileCompetitivenessReport {
  if (!profile || !profile.companyName) {
    return {
      healthScore: 10,
      level: "待补全",
      summary: "尚未登记企业主体与资质档案，系统无法进行专属商机匹配",
      stats: {
        certificationsCount: 0,
        qualificationsCount: 0,
        keyCasesCount: 0,
        hasRegisteredCapital: false,
      },
      suggestions: [
        "录入企业全称与注册资本，激活资金门槛测算",
        "录入 ISO、高新或专精特新认证，获取体系评分优势",
        "录入近三年代表标杆业绩，提升商务胜率",
      ],
    };
  }

  let score = 20; // 基础企业名称分
  const suggestions: string[] = [];

  const hasCapital = !!(profile.registeredCapital && profile.registeredCapital.trim());
  if (hasCapital) score += 20;
  else suggestions.push("补充注册资本，以便系统精准推荐标段金额匹配的商机");

  const certCount = profile.certifications?.length || 0;
  if (certCount >= 3) score += 25;
  else if (certCount >= 1) {
    score += 15;
    suggestions.push("增补 ISO9001/27001、高企或安全认证，提升政采加分覆盖率");
  } else {
    suggestions.push("录入企业资质证书，以解锁体系加分项匹配");
  }

  const qualCount = profile.qualifications?.length || 0;
  if (qualCount >= 2) score += 15;
  else if (qualCount >= 1) score += 10;
  else suggestions.push("录入专项施工或设计行业资质（如电子与智能化、系统集成）");

  const caseCount = profile.keyCases?.length || 0;
  if (caseCount >= 3) score += 20;
  else if (caseCount >= 1) {
    score += 10;
    suggestions.push("继续补充近三年代表合同，提高同类业绩项商务满分率");
  } else {
    suggestions.push("录入至少 1-2 项类似标杆业绩合同，避免业绩项失分");
  }

  const healthScore = Math.min(100, Math.max(10, score));
  let level: ProfileCompetitivenessReport["level"] = "待补全";
  let summary = "企业资质档案仍需进一步完善，以获得更高精度的商机推荐";

  if (healthScore >= 80) {
    level = "完善";
    summary = "企业资质与业绩储备充足，已处于极佳的商机智能匹配就绪状态";
  } else if (healthScore >= 50) {
    level = "良好";
    summary = "基础资质已具备，建议根据提示补充专业资质或标杆合同";
  }

  return {
    healthScore,
    level,
    summary,
    stats: {
      certificationsCount: certCount,
      qualificationsCount: qualCount,
      keyCasesCount: caseCount,
      hasRegisteredCapital: hasCapital,
    },
    suggestions,
  };
}

function parseCapitalNumber(val: string): number {
  const match = val.match(/([\d\.]+)/);
  if (!match) return 0;
  let num = parseFloat(match[1]);
  if (val.includes("亿")) num *= 10000;
  return num;
}

/**
 * 单条标讯与企业资质的契合度精算
 */
export function calculateTenderFitScore(
  tender: {
    id: number;
    title: string;
    content: string;
    type: string;
    budgetAmount?: number | null;
  },
  profile: CompanyProfileData
): {
  matchScore: number;
  matchLevel: "HIGH" | "MEDIUM" | "LOW";
  matchRate: number;
  dimensionScores: {
    qualification: number;
    performance: number;
    capitalStrength: number;
  };
  strengths: string[];
  gaps: string[];
} {
  const content = (tender.content || "") + " " + (tender.title || "");
  const strengths: string[] = [];
  const gaps: string[] = [];

  // 1. 资质体系契合度 (40%)
  let qualScore = 65;
  const certs = (profile.certifications || []).map((c) => c.toLowerCase());
  const quals = (profile.qualifications || []).map((q) => q.toLowerCase());

  // ISO 管理体系
  const tenderHasIso = /iso|质量管理体系|信息安全|环境管理/i.test(content);
  const userHasIso = certs.some((c) => c.includes("iso"));
  if (userHasIso) {
    qualScore += 15;
    if (tenderHasIso) {
      strengths.push("具备 ISO 认证，完全契合标书管理体系加分项");
    }
  } else if (tenderHasIso) {
    qualScore -= 10;
    gaps.push("标书包含体系加分要求，您未录入相关 ISO 证书");
  }

  // 高企/专精特新/ITSS
  const userHasTech = certs.some((c) => c.includes("高新") || c.includes("专精特新") || c.includes("itss") || c.includes("cmmi"));
  if (userHasTech) {
    qualScore += 10;
    strengths.push("具备高新/专精特新或高阶能力认证，具备政策倾斜优势");
  }

  // 专业行业资质对口
  if (quals.length > 0) {
    const directHit = quals.some((q) => content.toLowerCase().includes(q) || (q.includes("智能化") && content.includes("智能")));
    if (directHit) {
      qualScore += 15;
      strengths.push("专项承包资质与采购项目施工/服务范畴高度对口吻合");
    } else {
      qualScore += 5;
    }
  } else {
    qualScore -= 5;
    gaps.push("尚未登记专业承包资质，若该标的设资质门槛可能受限");
  }
  qualScore = Math.min(100, Math.max(30, qualScore));

  // 2. 类似业绩案例支撑 (35%)
  let perfScore = 50;
  const cases = profile.keyCases || [];
  const budget = tender.budgetAmount ? tender.budgetAmount : 0;
  const budgetWan = budget > 0 ? Math.round(budget / 10000) : 0;

  if (cases.length >= 3) {
    perfScore = 95;
    strengths.push(`拥有 ${cases.length} 项代表案例，近三年同类履约经验充足`);
  } else if (cases.length >= 1) {
    perfScore = 80;
    strengths.push(`具备代表业绩支撑（如 ${cases[0].title}）`);
    if (budgetWan > 500) {
      gaps.push("标的金额较大，建议增补 500 万级同类大单合同以锁定满分");
    }
  } else {
    perfScore = 40;
    gaps.push("暂未录入类似业绩合同，在商务评分环节可能面临失分");
  }

  // 3. 注册资本与履约能力 (25%)
  let capScore = 70;
  const userCapital = parseCapitalNumber(profile.registeredCapital || "0");
  if (userCapital > 0) {
    if (budgetWan > 0 && userCapital >= budgetWan * 2) {
      capScore = 95;
      strengths.push(`注册资本（${profile.registeredCapital}）充沛，远超标的规模，资金信誉佳`);
    } else if (budgetWan > 0 && userCapital < budgetWan * 0.5) {
      capScore = 55;
      gaps.push(`标的预算高，企业注册资本偏紧凑，需强化授信与审计材料`);
    } else {
      capScore = 80;
      strengths.push("企业注册资本满足招投标常规资质准入");
    }
  } else {
    capScore = 60;
  }

  const matchScore = Math.min(98, Math.max(25, Math.round(qualScore * 0.4 + perfScore * 0.35 + capScore * 0.25)));
  const matchRate = Math.min(100, Math.round(qualScore * 0.6 + perfScore * 0.4));

  let matchLevel: OpportunityMatchItem["matchLevel"] = "LOW";
  if (matchScore >= 80) matchLevel = "HIGH";
  else if (matchScore >= 60) matchLevel = "MEDIUM";

  return {
    matchScore,
    matchLevel,
    matchRate,
    dimensionScores: {
      qualification: qualScore,
      performance: perfScore,
      capitalStrength: capScore,
    },
    strengths,
    gaps,
  };
}

/**
 * 扫描全网最新标讯并生成个性化商机雷达匹配列表
 */
export async function scanMatchedOpportunities(options: {
  profile: CompanyProfileData;
  userId?: number;
  limit?: number;
  minScore?: number;
  type?: string;
  provinceCode?: string;
}): Promise<{
  items: OpportunityMatchItem[];
  totalScanned: number;
  highCount: number;
  mediumCount: number;
}> {
  const limit = options.limit || 30;
  const minScore = options.minScore || 40;

  // 1. 查找近 45 天内有效且正在公告或采购意向中的候选标讯
  const sinceDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const whereInput: Record<string, unknown> = {
    publishDate: { gte: sinceDate },
  };

  if (options.type) {
    whereInput.type = options.type;
  } else {
    // 默认重点推荐正在招标中或意向公告
    whereInput.type = { in: ["NOTICE", "INTENTION", "INQUIRY"] };
  }

  if (options.provinceCode) {
    whereInput.provinceCode = options.provinceCode;
  }

  const [candidates, regions] = await Promise.all([
    prisma.tender.findMany({
      where: whereInput,
      orderBy: { publishDate: "desc" },
      take: 120, // 取前 120 条候选池计算契合度
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        publishDate: true,
        expireDate: true,
        budgetAmount: true,
        awardAmount: true,
        purchaser: true,
        provinceCode: true,
        cityCode: true,
      },
    }),
    prisma.region.findMany({
      select: { code: true, name: true },
    }),
  ]);

  const regionMap = new Map(regions.map((r) => [r.code, r.name]));

  // 2. 查取当前用户已跟进的标讯 ID 集合
  let followedSet = new Set<number>();
  if (options.userId) {
    const follows = await prisma.tenderFollow.findMany({
      where: { userId: options.userId },
      select: { tenderId: true },
    });
    followedSet = new Set(follows.map((f) => f.tenderId));
  }

  // 3. 计算契合度并排序
  const scoredItems: OpportunityMatchItem[] = [];

  for (const item of candidates) {
    const fit = calculateTenderFitScore(
      {
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type,
        budgetAmount: item.budgetAmount ? Number(item.budgetAmount) : null,
      },
      options.profile
    );

    if (fit.matchScore >= minScore) {
      scoredItems.push({
        tenderId: item.id,
        title: item.title,
        type: item.type,
        publishDate: item.publishDate.toISOString().slice(0, 10),
        expireDate: item.expireDate ? item.expireDate.toISOString().slice(0, 10) : null,
        budgetAmountWan: item.budgetAmount ? Math.round((Number(item.budgetAmount) / 10000) * 100) / 100 : null,
        awardAmountWan: item.awardAmount ? Math.round((Number(item.awardAmount) / 10000) * 100) / 100 : null,
        purchaser: item.purchaser,
        provinceName: item.provinceCode ? regionMap.get(item.provinceCode) : null,
        cityName: item.cityCode ? regionMap.get(item.cityCode) : null,
        matchScore: fit.matchScore,
        matchLevel: fit.matchLevel,
        matchRate: fit.matchRate,
        dimensionScores: fit.dimensionScores,
        strengths: fit.strengths,
        gaps: fit.gaps,
        isFollowed: followedSet.has(item.id),
      });
    }
  }

  // 按综合匹配得分降序排列
  scoredItems.sort((a, b) => b.matchScore - a.matchScore);

  const highCount = scoredItems.filter((i) => i.matchLevel === "HIGH").length;
  const mediumCount = scoredItems.filter((i) => i.matchLevel === "MEDIUM").length;

  return {
    items: scoredItems.slice(0, limit),
    totalScanned: candidates.length,
    highCount,
    mediumCount,
  };
}
