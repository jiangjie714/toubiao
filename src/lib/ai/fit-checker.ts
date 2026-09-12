import type { Tender } from "@prisma/client";
import type { CompanyProfileData } from "@/app/actions/company-profile";
import type { AiAnalysisData } from "./bid-reader";

export interface FitCheckResult {
  winRateScore: number; // 0-100 综合胜率指数
  verdict: "极力推荐投标" | "谨慎参与（补齐短板）" | "建议审慎弃标";
  verdictLevel: "HIGH" | "MEDIUM" | "LOW";
  matchRate: number; // 资质硬指标符合度 (0-100%)
  dimensionScores: {
    qualification: number; // 资质认证得分 (0-100)
    performance: number; // 同类业绩支撑得分 (0-100)
    capitalStrength: number; // 注册资本与履约能力 (0-100)
  };
  strengths: string[];
  risksAndGaps: string[];
  actionAdvice: string[];
}

function parseCapitalNumber(val: string): number {
  const match = val.match(/([\d\.]+)/);
  if (!match) return 0;
  let num = parseFloat(match[1]);
  if (val.includes("亿")) num *= 10000;
  return num;
}

export function checkEnterpriseFit(
  tender: Tender,
  analysisData: Partial<AiAnalysisData> | undefined,
  profile: CompanyProfileData,
): FitCheckResult {
  const content = (tender.content ?? "") + " " + (tender.title ?? "");
  const strengths: string[] = [];
  const risksAndGaps: string[] = [];
  const actionAdvice: string[] = [];

  // 1. 资质与认证核验
  let qualificationScore = 70;
  const userCerts = (profile.certifications || []).map((c) => c.toLowerCase());
  const userQuals = (profile.qualifications || []).map((q) => q.toLowerCase());

  // 检查 ISO 体系
  const tenderMentionsIso = /iso|质量管理体系|信息安全管理/i.test(content);
  const userHasIso = userCerts.some((c) => c.includes("iso"));
  if (userHasIso) {
    strengths.push("具备 ISO 规范管理体系认证，可在技术与商务评审中获取完整加分。");
    qualificationScore += 15;
  } else if (tenderMentionsIso) {
    risksAndGaps.push("标书正文提及质量与安全认证要求，您未录入 ISO 认证，可能错失体系加分。");
    qualificationScore -= 15;
  }

  // 检查高企 / 专精特新 / 软著信用
  const userHasTech = userCerts.some((c) => c.includes("高新") || c.includes("专精特新"));
  if (userHasTech) {
    strengths.push("具备高新技术企业/专精特新资质，在政采创新扶持与技术加分中具有竞争优势。");
    qualificationScore += 10;
  }

  // 检查专业承包资质
  if (profile.qualifications && profile.qualifications.length > 0) {
    strengths.push(`拥有【${profile.qualifications.slice(0, 2).join("、")}】等行业资质储备。`);
    qualificationScore += 5;

    const hasDirectQualMatch = userQuals.some(
      (q) => content.toLowerCase().includes(q) || (q.includes("集成") && content.includes("集成")),
    );
    if (hasDirectQualMatch) {
      strengths.push("企业专项资质与本标段采购范围高度对口吻合。");
      qualificationScore += 10;
    }
  } else {
    risksAndGaps.push("企业专业资质档案尚为空白，建议尽快补全工程或行业专项资质。");
    qualificationScore -= 10;
  }

  qualificationScore = Math.min(100, Math.max(30, qualificationScore));

  // 2. 类似业绩案例核对
  let performanceScore = 50;
  const cases = profile.keyCases || [];
  if (cases.length >= 3) {
    performanceScore = 95;
    strengths.push(`已录入 ${cases.length} 项代表业绩案例，近三年履约经验储备丰富，商务业绩分胜率极高。`);
  } else if (cases.length >= 1) {
    performanceScore = 80;
    strengths.push(`具备同类代表业绩（如 ${cases[0].title}），满足常规业绩审查门槛。`);
    actionAdvice.push("若该标的设置阶段性阶梯业绩分（如每提供1份加2分），建议尽可能增补提供类似合同关键页。");
  } else {
    performanceScore = 40;
    risksAndGaps.push("暂未录入类似项目业绩合同，可能在综合评分法的“企业类似业绩”项面临失分。");
    actionAdvice.push("重点梳理近三年合同金额相当的类似标杆案例，并在投标文件中附上中标通知书与验收报告。");
  }

  // 3. 注册资本与履约资金力
  let capitalScore = 70;
  const userCapital = parseCapitalNumber(profile.registeredCapital || "0");
  const tenderBudget = tender.budgetAmount ? Number(tender.budgetAmount) : 0;

  if (userCapital > 0) {
    if (tenderBudget > 0 && userCapital >= tenderBudget * 2) {
      capitalScore = 95;
      strengths.push(`企业注册资本（${profile.registeredCapital}）充裕，大幅高于标的预算规模，履约信誉良好。`);
    } else if (tenderBudget > 0 && userCapital < tenderBudget * 0.5) {
      capitalScore = 55;
      risksAndGaps.push(`注册资本规模（${profile.registeredCapital}）相对标的预算偏紧凑，需强化审计报告与资金流证明。`);
    } else {
      capitalScore = 80;
      strengths.push(`注册资本满足正常招投标履约与财务指标要求。`);
    }
  } else {
    capitalScore = 60;
  }

  // 4. 废标雷达风险综合扣减
  let radarDeduction = 0;
  if (analysisData?.riskRadar) {
    if (analysisData.riskRadar.riskLevel === "HIGH") radarDeduction = 15;
    else if (analysisData.riskRadar.riskLevel === "MEDIUM") radarDeduction = 5;
  }

  // 5. 测算综合胜率指数
  const rawWinScore =
    qualificationScore * 0.4 + performanceScore * 0.35 + capitalScore * 0.25 - radarDeduction;
  const winRateScore = Math.min(98, Math.max(25, Math.round(rawWinScore)));

  const matchRate = Math.min(100, Math.round((qualificationScore * 0.6 + performanceScore * 0.4)));

  let verdict: FitCheckResult["verdict"] = "极力推荐投标";
  let verdictLevel: FitCheckResult["verdictLevel"] = "HIGH";

  if (winRateScore >= 78) {
    verdict = "极力推荐投标";
    verdictLevel = "HIGH";
    actionAdvice.unshift("贵公司与本标段资质与业绩匹配度极高，建议立即组织专业团队开展标书响应与报价测算。");
  } else if (winRateScore >= 60) {
    verdict = "谨慎参与（补齐短板）";
    verdictLevel = "MEDIUM";
    actionAdvice.unshift("整体具备竞标基础，但需针对失分短板定向加强技术方案深度与方案差异化。");
  } else {
    verdict = "建议审慎弃标";
    verdictLevel = "LOW";
    actionAdvice.unshift("当前资质或业绩与标段门槛存在明显落差，建议考虑组建联合体投标或精选更适配的项目。");
  }

  return {
    winRateScore,
    verdict,
    verdictLevel,
    matchRate,
    dimensionScores: {
      qualification: qualificationScore,
      performance: performanceScore,
      capitalStrength: capitalScore,
    },
    strengths,
    risksAndGaps,
    actionAdvice,
  };
}
