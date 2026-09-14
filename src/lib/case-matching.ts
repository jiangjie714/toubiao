import { formatDate } from "./constants";
import { INDUSTRY_META } from "./industry";

export interface CompanyCaseItem {
  id: number;
  title: string;
  clientName: string;
  amountWan: number;
  signDate: string;
  signYear: number;
  industryCode: string | null;
  industryLabel?: string;
  serviceScope: string | null;
  projectLeader: string | null;
  hasAcceptanceDoc: boolean;
  contractFileUrl: string | null;
  isOverdueThreeYears: boolean;
  createdAt: string;
}

export type CaseMatchLevel = "TOP_MATCH" | "RECOMMENDED" | "COMPATIBLE" | "INELIGIBLE";

export interface CaseMatchResult {
  caseItem: CompanyCaseItem;
  matchScore: number; // 0 - 100
  matchLevel: CaseMatchLevel;
  matchLevelLabel: string;
  matchReasons: string[];
  riskWarnings: string[];
  dimensionScores: {
    timeScore: number;     // 满分 20
    amountScore: number;   // 满分 30
    industryScore: number; // 满分 40
    docScore: number;      // 满分 10
  };
}

export interface TenderCaseMatchAnalysis {
  tenderId: number;
  tenderTitle: string;
  tenderBudgetWan: number | null;
  tenderIndustryCode: string | null;
  tenderPublishDate: string;
  bestMatchedCases: CaseMatchResult[];
  summary: {
    totalCasesCount: number;
    validThreeYearsCount: number;
    topMatchCount: number;
    estimatedBonusPoints: number; // 预估该标讯业绩可得评分 (满分按10分或15分计)
  };
}

interface TenderMatchTarget {
  id: number;
  title: string;
  content?: string;
  budgetAmount?: number | { toString(): string } | null;
  industryCode?: string | null;
  publishDate: Date | string;
}

/**
 * 精算单条业绩针对标讯的契合度打分
 */
export function evaluateCaseMatch(
  tender: TenderMatchTarget,
  c: CompanyCaseItem
): CaseMatchResult {
  const tenderDate = new Date(tender.publishDate);
  const caseSignDate = new Date(c.signDate);
  const tenderBudgetWan = tender.budgetAmount ? Number(tender.budgetAmount) : null;

  const matchReasons: string[] = [];
  const riskWarnings: string[] = [];

  // 1. 时效性评测 (满分 20 分)
  // 招投标惯例：自招标公告发布之日起往前倒推 3 年 (1095天)
  const diffDays = (tenderDate.getTime() - caseSignDate.getTime()) / (1000 * 60 * 60 * 24);
  let timeScore = 0;

  if (diffDays < 0) {
    // 签署时间在公告之后？逻辑异常，扣分
    timeScore = 5;
    riskWarnings.push("合同签署日期晚于招标公告发布日，属于逻辑异常，请核对。");
  } else if (diffDays <= 365 * 3) {
    timeScore = 20;
    matchReasons.push("签署于近 3 年内，完全满足招标文件类似业绩时效要求。");
  } else if (diffDays <= 365 * 5) {
    timeScore = 8;
    riskWarnings.push(`合同签署已超过 3 年（约 ${(diffDays / 365).toFixed(1)} 年前），可能被评审专家判定为超期业绩。`);
  } else {
    timeScore = 0;
    riskWarnings.push("合同签署已超过 5 年，不建议作为类似业绩提交。");
  }

  // 2. 金额体量评测 (满分 30 分)
  let amountScore = 0;
  if (!tenderBudgetWan || tenderBudgetWan <= 0) {
    // 标讯无预算上限，按绝对金额分档
    if (c.amountWan >= 500) {
      amountScore = 30;
      matchReasons.push(`合同金额 ${c.amountWan} 万元（≥500万），具备充足体量优势。`);
    } else if (c.amountWan >= 100) {
      amountScore = 24;
      matchReasons.push(`合同金额 ${c.amountWan} 万元（≥100万），体量适中。`);
    } else {
      amountScore = 15;
    }
  } else {
    // 招投标通用“类似业绩”门槛：一般为预算金额的 30%~50% 以上
    const ratio = c.amountWan / tenderBudgetWan;
    if (ratio >= 0.6) {
      amountScore = 30;
      matchReasons.push(`合同金额 (${c.amountWan}万) 达本次招标预算的 ${(ratio * 100).toFixed(0)}%，体量充分满足要求。`);
    } else if (ratio >= 0.3) {
      amountScore = 24;
      matchReasons.push(`合同金额 (${c.amountWan}万) 达到招标预算 30% 以上常规门槛。`);
    } else if (ratio >= 0.1) {
      amountScore = 16;
      riskWarnings.push(`合同金额 (${c.amountWan}万) 占招标预算比例偏小 (${(ratio * 100).toFixed(0)}%)，部分严格招标人可能要求单项达标。`);
    } else {
      amountScore = 8;
      riskWarnings.push(`合同体量显著低于本项目预算 (${tenderBudgetWan}万元)。`);
    }
  }

  // 3. 行业与业务关键词语义契合度 (满分 40 分)
  let industryScore = 0;
  // 3.1 行业代码一致
  if (tender.industryCode && c.industryCode && tender.industryCode === c.industryCode) {
    industryScore += 20;
    matchReasons.push(`行业赛道高度吻合（${INDUSTRY_META[c.industryCode]?.name || c.industryCode}）。`);
  } else if (!tender.industryCode || !c.industryCode) {
    industryScore += 10;
  }

  // 3.2 标题与供货范围关键词重合匹配 (分词检索)
  const searchText = `${tender.title} ${tender.content || ""}`.toLowerCase();
  const caseKeywords = [
    c.title,
    ...(c.serviceScope ? c.serviceScope.split(/[,，、\s;；]+/) : []),
  ];

  let matchedKwCount = 0;
  for (const kw of caseKeywords) {
    if (kw.length >= 2 && searchText.includes(kw.toLowerCase())) {
      matchedKwCount++;
    }
  }

  if (matchedKwCount >= 3) {
    industryScore += 20;
    matchReasons.push(`业务内容与招标品目匹配度极高（命中多个核心工程/服务关键词）。`);
  } else if (matchedKwCount >= 1) {
    industryScore += 14;
    matchReasons.push(`业务品目与招标需求具备明显相关性。`);
  } else {
    industryScore += 6;
  }

  // 4. 证明材料完备度 (满分 10 分)
  let docScore = 0;
  if (c.hasAcceptanceDoc) {
    docScore += 5;
    matchReasons.push("具备完整竣工验收证明或用户好评材料，避免专家质疑。");
  } else {
    riskWarnings.push("尚未归档验收报告/完工证明，若招标文件要求提供验收单将无法计分。");
  }

  if (c.contractFileUrl) {
    docScore += 5;
  } else {
    riskWarnings.push("缺少合同扫描件电子存档。");
  }

  const matchScore = Math.min(100, Math.round(timeScore + amountScore + industryScore + docScore));

  let matchLevel: CaseMatchLevel = "INELIGIBLE";
  let matchLevelLabel = "不符合";

  if (matchScore >= 80 && timeScore >= 18) {
    matchLevel = "TOP_MATCH";
    matchLevelLabel = "首选满分业绩";
  } else if (matchScore >= 65 && timeScore >= 15) {
    matchLevel = "RECOMMENDED";
    matchLevelLabel = "高契合推荐";
  } else if (matchScore >= 45) {
    matchLevel = "COMPATIBLE";
    matchLevelLabel = "基本符合备选";
  } else {
    matchLevel = "INELIGIBLE";
    matchLevelLabel = "不建议选送";
  }

  return {
    caseItem: c,
    matchScore,
    matchLevel,
    matchLevelLabel,
    matchReasons,
    riskWarnings,
    dimensionScores: {
      timeScore,
      amountScore,
      industryScore,
      docScore,
    },
  };
}

/**
 * 针对具体标讯，从企业案例库中智能匹配最优业绩清单
 */
export function matchCasesForTender(
  tender: TenderMatchTarget,
  userCases: CompanyCaseItem[]
): TenderCaseMatchAnalysis {
  const tenderDate = new Date(tender.publishDate);
  const budgetWan = tender.budgetAmount ? Number(tender.budgetAmount) : null;

  const scoredCases: CaseMatchResult[] = userCases.map((c) =>
    evaluateCaseMatch(tender, c)
  );

  // 按匹配总分降序排列
  scoredCases.sort((a, b) => b.matchScore - a.matchScore);

  const topMatches = scoredCases.filter((sc) => sc.matchLevel === "TOP_MATCH" || sc.matchLevel === "RECOMMENDED");
  const validThreeYears = userCases.filter((c) => {
    const diff = (tenderDate.getTime() - new Date(c.signDate).getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 365 * 3;
  });

  // 估算业绩分（通常每项类似业绩 2~3 分，满分 10~15 分）
  const estimatedBonusPoints = Math.min(15, topMatches.length * 3);

  return {
    tenderId: tender.id,
    tenderTitle: tender.title,
    tenderBudgetWan: budgetWan,
    tenderIndustryCode: tender.industryCode ?? null,
    tenderPublishDate: formatDate(new Date(tender.publishDate)),
    bestMatchedCases: scoredCases,
    summary: {
      totalCasesCount: userCases.length,
      validThreeYearsCount: validThreeYears.length,
      topMatchCount: topMatches.length,
      estimatedBonusPoints,
    },
  };
}

/**
 * 生成国标规范的《类似项目业绩证明材料汇总一览表》HTML 与 Markdown
 */
export function generateCaseSummaryTableHtml(
  cases: CaseMatchResult[],
  companyName: string = "我单位"
): string {
  const rows = cases.map((m, idx) => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold;">${m.caseItem.title}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${m.caseItem.clientName}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-family: monospace;">
        ${m.caseItem.amountWan.toLocaleString()} 万元
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">${m.caseItem.signDate}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">
        ${m.caseItem.hasAcceptanceDoc ? "完备 (附验收单)" : "合同原件"}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; color: #64748b;">
        见证明材料第 [ ${idx + 1} ] 部分
      </td>
    </tr>
  `).join("");

  return `
<div style="font-family: SimSun, '宋体', serif; margin: 20px 0;">
  <h3 style="text-align: center; font-size: 16pt; margin-bottom: 8px;">
    类似项目业绩证明材料汇总一览表
  </h3>
  <p style="font-size: 10.5pt; color: #475569; margin-bottom: 12px; text-align: right;">
    投标人名称：${companyName}（盖章）
  </p>
  <table style="width: 100%; border-collapse: collapse; font-size: 10pt; line-height: 1.5;">
    <thead>
      <tr style="background-color: #f1f5f9; font-weight: bold; text-align: center;">
        <th style="border: 1px solid #cbd5e1; padding: 8px 6px; width: 45px;">序号</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px 6px;">类似业绩项目名称</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px 6px; width: 140px;">业主/客户单位</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px 6px; width: 100px;">合同金额</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px 6px; width: 95px;">签署日期</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px 6px; width: 105px;">验收情况</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px 6px; width: 110px;">证明材料页码</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</div>
`.trim();
}
