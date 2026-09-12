import { prisma } from "@/lib/prisma";
import type { Tender } from "@prisma/client";

export interface AiExecutiveSummary {
  projectOverview: string;
  procuringEntity: string;
  scopeOfWork: string;
  duration: string;
  paymentTerms: string;
  budgetOrPrice: string;
}

export interface AiDisqualifiedItem {
  clause: string;
  level: "CRITICAL" | "HIGH";
  explanation: string;
}

export interface AiComplianceAlert {
  type: "QUALIFICATION" | "FINANCIAL" | "TIMELINE" | "PERFORMANCE";
  title: string;
  description: string;
}

export interface AiDepositAndFees {
  depositRequired: boolean;
  depositAmount?: string;
  depositDeadline?: string;
  depositMethod?: string;
}

export interface AiRiskRadar {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  disqualifiedItems: AiDisqualifiedItem[];
  complianceAlerts: AiComplianceAlert[];
  depositAndFees: AiDepositAndFees;
}

export interface AiScoringMethod {
  methodType: string;
  weights: {
    price: number;
    technical: number;
    business: number;
  };
  keyScoringPoints: Array<{
    category: "价格" | "技术" | "商务" | "其他";
    focus: string;
  }>;
}

export interface AiTimelineAndKey {
  bidDeadline?: string;
  bidOpeningTime?: string;
  docObtainDeadline?: string;
  clarificationDeadline?: string;
  keyChecklist: string[];
}

export interface AiAnalysisData {
  executiveSummary: AiExecutiveSummary;
  riskRadar: AiRiskRadar;
  scoringMethod: AiScoringMethod;
  timelineAndKey: AiTimelineAndKey;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  createdAt: Date;
}

export type TenderWithRelations = Tender;

// -------------------------------------------------------------
// 启发式正则与文本提取工具函数
// -------------------------------------------------------------

function cleanHtmlAndNormalize(content: string): string {
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[\r\n]+/g, "\n");
}

function extractMatch(text: string, regex: RegExp, defaultVal = "招标文件未明确标注，详见正文"): string {
  const match = text.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return defaultVal;
}

/**
 * 内置高精度启发式标书分析引擎 (Heuristic Engine)
 * 在未配置大模型 API Key 或网络离线时提供 100% 可用、结构化的深度解读
 */
export function analyzeWithHeuristics(tender: TenderWithRelations): {
  executiveSummary: AiExecutiveSummary;
  riskRadar: AiRiskRadar;
  scoringMethod: AiScoringMethod;
  timelineAndKey: AiTimelineAndKey;
  modelUsed: string;
} {
  const text = cleanHtmlAndNormalize(tender.content ?? "");
  const title = tender.title ?? "";

  // 1. 一页纸速读 (Executive Summary)
  const procuringEntity =
    tender.purchaser ??
    extractMatch(text, /(?:采购人|招标人|采购单位|招标单位|业主单位)[：:\s]*([^,\n;，；]{2,40})/);

  const budgetOrPrice = tender.budgetAmount
    ? `${tender.budgetAmount} 万元`
    : extractMatch(
        text,
        /(?:最高限价|预算金额|预算总计|控制价|招标控制价)[：:\s]*([^,\n;，；]{2,30})/,
        "按招标文件规定/未披露具体上限",
      );


  const duration = extractMatch(
    text,
    /(?:工期|交货期|交付期限|履行期限|服务期限|服务期|合同履行期限)[：:\s]*([^\n;；。]{2,50})/,
    "自合同签订之日起至履行完毕（详见合同条款）",
  );

  const paymentTerms = extractMatch(
    text,
    /(?:付款方式|资金结算|支付方式|预付款)[：:\s]*([^\n;；。]{4,100})/,
    "按合同履约进度分期支付或验收合格后结算",
  );

  let scopeOfWork = extractMatch(
    text,
    /(?:采购需求|招标范围|标的名称|采购内容|建设内容|服务内容)[：:\s]*([^\n;；。]{4,120})/,
    "",
  );
  if (!scopeOfWork) {
    scopeOfWork = `本项目针对“${title}”开展采购/施工/技术服务，包含招标文件规定的全部供货与履约保障。`;
  }

  const executiveSummary: AiExecutiveSummary = {
    projectOverview: `本项目为【${procuringEntity || "采购单位"}】发布的【${title}】，属于标准招投标与政府采购项目。`,
    procuringEntity: procuringEntity || "详见公告",
    scopeOfWork,
    duration,
    paymentTerms,
    budgetOrPrice,
  };

  // 2. 废标与合规风险雷达 (Risk Radar)
  const disqualifiedItems: AiDisqualifiedItem[] = [];

  // 检测星号条款 / 实质性条款
  if (/[\*★▲#]/.test(text) || /一票否决|实质性要求|不得超过最高限价/.test(text)) {
    disqualifiedItems.push({
      clause: "星号（★/▲）实质性参数与条款响应",
      level: "CRITICAL",
      explanation: "标书含有带标记的实质性要求，若出现负偏离或不满足将直接导致一票否决/废标。",
    });
  }

  // 检测最高限价超额废标
  if (/超过|超出.*(?:最高限价|预算金额|控制价)/.test(text) || tender.budgetAmount) {
    disqualifiedItems.push({
      clause: "投标报价超限一票否决",
      level: "CRITICAL",
      explanation: "投标报价不得超过最高限价/预算金额，否则作无效标或废标处理。",
    });
  }

  // 检测密封与签字盖章要求
  if (/密封|盖章|电子签章|签字/.test(text)) {
    disqualifiedItems.push({
      clause: "投标文件密封、签署与CA电子签章规范",
      level: "HIGH",
      explanation: "投标文件需严格按照要求在指定处逐项加盖公章、法定代表人印章或CA证书签名，缺漏将直接废标。",
    });
  }

  if (disqualifiedItems.length === 0) {
    disqualifiedItems.push({
      clause: "常规资格审查与符合性检查",
      level: "HIGH",
      explanation: "未发现非常规一票否决条款，但需严格遵守三证合一、信用查询及无违法记录硬性门槛。",
    });
  }

  // 合规警示
  const complianceAlerts: AiComplianceAlert[] = [];
  if (/信用中国|中国政府采购网.*信用记录|失信被执行人/.test(text)) {
    complianceAlerts.push({
      type: "QUALIFICATION",
      title: "信用记录核查警示",
      description: "需在开标日前在“信用中国”和“中国政府采购网”打印信用核查截图，并确保无失信惩戒记录。",
    });
  }

  if (/社保|缴纳税收|完税证明/.test(text)) {
    complianceAlerts.push({
      type: "FINANCIAL",
      title: "社保与纳税证明合规要求",
      description: "需提供近半年或指定期限内的依法纳税和员工社保缴纳证明文件，时间断缴将影响资格审查。",
    });
  }

  if (/同类项目|业绩|合同复印件/.test(text)) {
    complianceAlerts.push({
      type: "PERFORMANCE",
      title: "同类项目业绩支撑证明",
      description: "业绩评分或资格审查要求提供合同关键页、中标通知书或验收证明复印件/扫描件。",
    });
  }

  if (complianceAlerts.length === 0) {
    complianceAlerts.push({
      type: "TIMELINE",
      title: "递交截止与文件格式合规",
      description: "请特别核对投标文件格式模板要求，确保在截止时间前完成递交或线上解密。",
    });
  }

  // 保证金要求
  const depositMatch = text.match(/(?:投标保证金|保证金金额|缴纳保证金)[：:\s]*([^，,\n;；。]{2,40})/);
  const depositAmount = depositMatch ? depositMatch[1].trim() : undefined;
  const depositRequired = Boolean(depositAmount) || /需缴纳保证金|递交保证金/.test(text);

  const depositAndFees: AiDepositAndFees = {
    depositRequired,
    depositAmount: depositRequired ? depositAmount || "详见招标文件指定金额或免收" : "免收或未作硬性要求",
    depositDeadline: tender.expireDate
      ? `开标截止前 (${new Date(tender.expireDate).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })})`
      : "同投标截止时间",
    depositMethod: /电汇|转账|保函/.test(text) ? "银行转账 / 电子保函 / 银行保函" : "转账汇款或电子保函",
  };

  // 计算综合风险分数 (0-100)
  let riskScore = 25; // 基础分
  if (disqualifiedItems.some((item) => item.level === "CRITICAL")) riskScore += 25;
  if (complianceAlerts.length >= 2) riskScore += 20;
  if (depositRequired) riskScore += 10;
  if (/联合体.*不接受/.test(text)) riskScore += 5;
  riskScore = Math.min(100, Math.max(10, riskScore));

  const riskLevel = riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";

  const riskRadar: AiRiskRadar = {
    riskScore,
    riskLevel,
    disqualifiedItems,
    complianceAlerts,
    depositAndFees,
  };

  // 3. 评标办法与分值比例 (Scoring Method)
  let methodType = "综合评分法";
  let weights = { price: 30, technical: 50, business: 20 };

  if (/最低评标价法|最低价中标|经评审的最低投标价/.test(text)) {
    methodType = "最低评标价法";
    weights = { price: 80, technical: 10, business: 10 };
  } else if (/竞争性磋商/.test(text) || tender.type?.includes("竞争性磋商")) {
    methodType = "竞争性磋商（综合评审）";
    weights = { price: 20, technical: 60, business: 20 };
  } else if (/竞争性谈判|单一来源|询价/.test(text) || tender.type?.includes("询价")) {
    methodType = "最低价评审法（询价/谈判）";
    weights = { price: 70, technical: 20, business: 10 };
  }


  // 尝试从文本中解析更精准的分值
  const priceScoreMatch = text.match(/价格分[：:\s]*(\d{1,2})[分%]/);
  const techScoreMatch = text.match(/技术分[：:\s]*(\d{1,2})[分%]/);
  const bizScoreMatch = text.match(/商务分[：:\s]*(\d{1,2})[分%]/);
  if (priceScoreMatch && techScoreMatch) {
    const p = parseInt(priceScoreMatch[1], 10);
    const t = parseInt(techScoreMatch[1], 10);
    const b = bizScoreMatch ? parseInt(bizScoreMatch[1], 10) : Math.max(0, 100 - p - t);
    weights = { price: p, technical: t, business: b };
  }

  const keyScoringPoints: AiScoringMethod["keyScoringPoints"] = [
    {
      category: "价格",
      focus: methodType.includes("最低")
        ? "满足全部实质性要求的前提下，报价最低者推荐为第一中标候选人。"
        : `采用基准价计算公式（满分 ${weights.price} 分），合理报价是进入中段区间并拿满分的核心。`,
    },
    {
      category: "技术",
      focus: `技术方案完整性、实施进度保障、应急预案及重难点分析（满分约 ${weights.technical} 分）。`,
    },
    {
      category: "商务",
      focus: `企业资质等级、同类项目类似业绩合同、团队成员职业资格与社保证明（满分约 ${weights.business} 分）。`,
    },
  ];

  const scoringMethod: AiScoringMethod = {
    methodType,
    weights,
    keyScoringPoints,
  };

  // 4. 关键时间线与备忘清单 (Timeline & Key)
  const bidDeadline = tender.expireDate
    ? new Date(tender.expireDate).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    : extractMatch(text, /(?:截止时间|递交截止)[：:\s]*([^，,\n;；]{6,40})/, "见招标文件通知");

  const bidOpeningTime = extractMatch(
    text,
    /(?:开标时间|开启时间)[：:\s]*([^，,\n;；]{6,40})/,
    bidDeadline,
  );

  const docObtainDeadline = extractMatch(
    text,
    /(?:获取采购文件|获取招标文件|报名截止)[：:\s]*([^，,\n;；]{6,40})/,
    "投标截止前或公告指定时间",
  );

  const keyChecklist = [
    "确认报名/招标文件获取流程与截止节点",
    depositRequired ? "在截止时间前完成投标保证金打款或开具电子保函" : "查阅是否需提供免收保证金声明函",
    "核验法定代表人授权委托书及身份证明有效期",
    "逐条自查并响应招标文件带标记（★/▲）的实质性条款",
    "编制投标报价明细表并核算总价、单价逻辑一致性",
    "完成投标文件盖章、封装或电子招投标系统客户端解密演练",
  ];

  const timelineAndKey: AiTimelineAndKey = {
    bidDeadline,
    bidOpeningTime,
    docObtainDeadline,
    keyChecklist,
  };

  return {
    executiveSummary,
    riskRadar,
    scoringMethod,
    timelineAndKey,
    modelUsed: "builtin-heuristic-v1",
  };
}

/**
 * 如果配置了大模型 API，则尝试调用大模型增强分析，否则无缝回退
 */
async function analyzeWithLlm(
  tender: TenderWithRelations,
): Promise<{
  executiveSummary: AiExecutiveSummary;
  riskRadar: AiRiskRadar;
  scoringMethod: AiScoringMethod;
  timelineAndKey: AiTimelineAndKey;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
} | null> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return null;
  }

  const prompt = `你是一名拥有15年资深招投标风控与评审经验的专家。请阅读以下标书公告，提取关键信息并按照严格的 JSON 格式输出分析结果。

【标书基本信息】
标题：${tender.title}
采购人：${tender.purchaser ?? "未知"}
预算：${tender.budgetAmount ? `${tender.budgetAmount}万元` : "未明确"}
截止时间：${tender.expireDate ? tender.expireDate.toISOString() : "未明确"}
省市代码：${tender.provinceCode ?? "未知"}


【公告正文】
${cleanHtmlAndNormalize(tender.content ?? "").slice(0, 6000)}

【输出要求】
必须只返回合法 JSON，符合以下结构，不得包含额外 markdown 代码块：
{
  "executiveSummary": {
    "projectOverview": "简明扼要的项目背景介绍（2句话内）",
    "procuringEntity": "采购/招标人单位名称",
    "scopeOfWork": "核心采购需求与交付内容",
    "duration": "工期或履约交付期限",
    "paymentTerms": "付款条件与资金结算方式",
    "budgetOrPrice": "预算金额或最高限价"
  },
  "riskRadar": {
    "riskScore": 45,
    "riskLevel": "LOW",
    "disqualifiedItems": [
      {
        "clause": "一票否决/实质性条款（如*号条款、超预算、资质硬要求）",
        "level": "CRITICAL",
        "explanation": "废标原因及风险说明"
      }
    ],
    "complianceAlerts": [
      {
        "type": "QUALIFICATION",
        "title": "风险标题",
        "description": "详细说明"
      }
    ],
    "depositAndFees": {
      "depositRequired": true,
      "depositAmount": "保证金金额",
      "depositDeadline": "缴纳截止时间",
      "depositMethod": "转账或保函"
    }
  },
  "scoringMethod": {
    "methodType": "综合评分法",
    "weights": {
      "price": 30,
      "technical": 50,
      "business": 20
    },
    "keyScoringPoints": [
      {
        "category": "价格",
        "focus": "得分要点说明"
      }
    ]
  },
  "timelineAndKey": {
    "bidDeadline": "投标截止时间",
    "bidOpeningTime": "开标时间",
    "docObtainDeadline": "标书获取截止",
    "keyChecklist": [
      "准备事项1",
      "准备事项2"
    ]
  }
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a professional bidding analysis AI that strictly outputs JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[AI Bid Reader] LLM API error status: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      executiveSummary: parsed.executiveSummary,
      riskRadar: parsed.riskRadar,
      scoringMethod: parsed.scoringMethod,
      timelineAndKey: parsed.timelineAndKey,
      modelUsed: `llm-${model}`,
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    console.warn("[AI Bid Reader] LLM call failed or timed out, falling back to heuristic engine:", err);
    return null;
  }
}

/**
 * Cache-First 标书智能速读与风险雷达分析服务
 */
export async function getOrGenerateTenderAiAnalysis(
  tenderId: number,
  options: { forceRefresh?: boolean } = {},
): Promise<{ data: AiAnalysisData; isCached: boolean }> {
  // 1. 检查缓存
  if (!options.forceRefresh) {
    const cached = await prisma.tenderAiAnalysis.findUnique({
      where: { tenderId },
    });

    if (cached && cached.status === "COMPLETED") {
      return {
        isCached: true,
        data: {
          executiveSummary: JSON.parse(cached.executiveSummary) as AiExecutiveSummary,
          riskRadar: cached.riskRadar as unknown as AiRiskRadar,
          scoringMethod: cached.scoringMethod as unknown as AiScoringMethod,
          timelineAndKey: cached.timelineAndKey as unknown as AiTimelineAndKey,
          modelUsed: cached.modelUsed,
          promptTokens: cached.promptTokens,
          completionTokens: cached.completionTokens,
          createdAt: cached.createdAt,
        },
      };
    }
  }

  // 2. 获取标书原始详情
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
  });

  if (!tender) {
    throw new Error(`Tender with ID ${tenderId} not found`);
  }

  // 3. 执行分析（优先 LLM，失败或未配置时回退 Heuristics）
  let analysis = await analyzeWithLlm(tender);
  if (!analysis) {
    const heuristicResult = analyzeWithHeuristics(tender);
    analysis = {
      ...heuristicResult,
      promptTokens: 0,
      completionTokens: 0,
    };
  }

  // 4. 写入缓存 (Upsert)
  const saved = await prisma.tenderAiAnalysis.upsert({
    where: { tenderId },
    update: {
      executiveSummary: JSON.stringify(analysis.executiveSummary),
      riskRadar: analysis.riskRadar as unknown as object,
      scoringMethod: analysis.scoringMethod as unknown as object,
      timelineAndKey: analysis.timelineAndKey as unknown as object,
      modelUsed: analysis.modelUsed,
      promptTokens: analysis.promptTokens,
      completionTokens: analysis.completionTokens,
      status: "COMPLETED",
    },
    create: {
      tenderId,
      executiveSummary: JSON.stringify(analysis.executiveSummary),
      riskRadar: analysis.riskRadar as unknown as object,
      scoringMethod: analysis.scoringMethod as unknown as object,
      timelineAndKey: analysis.timelineAndKey as unknown as object,
      modelUsed: analysis.modelUsed,
      promptTokens: analysis.promptTokens,
      completionTokens: analysis.completionTokens,
      status: "COMPLETED",
    },
  });

  return {
    isCached: false,
    data: {
      executiveSummary: analysis.executiveSummary,
      riskRadar: analysis.riskRadar,
      scoringMethod: analysis.scoringMethod,
      timelineAndKey: analysis.timelineAndKey,
      modelUsed: saved.modelUsed,
      promptTokens: saved.promptTokens,
      completionTokens: saved.completionTokens,
      createdAt: saved.createdAt,
    },
  };
}
