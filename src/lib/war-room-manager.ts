export type DecisionType = "GO" | "CONDITIONAL_GO" | "NO_GO";

export const DECISION_META: Record<
  DecisionType,
  { label: string; shortLabel: string; badgeColor: string; bgLight: string; desc: string }
> = {
  GO: {
    label: "建议坚决投标 (GO)",
    shortLabel: "建议投标",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    bgLight: "bg-emerald-50 border-emerald-200 text-emerald-900",
    desc: "各维度综合竞争力突出，赢面高，建议组建专项投标项目组全流程推进。",
  },
  CONDITIONAL_GO: {
    label: "审慎附条件投标 (CONDITIONAL GO)",
    shortLabel: "审慎跟进",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    bgLight: "bg-amber-50 border-amber-200 text-amber-900",
    desc: "项目具备一定机会但存在资质/业绩/垫资短板，需明确解决方案后方可立项投入。",
  },
  NO_GO: {
    label: "建议放弃止损 (NO GO)",
    shortLabel: "建议放弃",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
    bgLight: "bg-rose-50 border-rose-200 text-rose-900",
    desc: "存在致命短板或风险收益严重失衡，建议果断放弃投标，避免耗费高额编制与资金成本。",
  },
};

export interface EvaluationScoresInput {
  marketScore: number;     // 市场与客户关系 (0-100)
  techScore: number;       // 技术方案与交付可行性 (0-100)
  commercialScore: number; // 资质与业绩满足度 (0-100)
  financialScore: number;  // 资金占用与回款周期风险 (0-100)
  decisionReason?: string;
  riskNotes?: string;
  leadEvaluator?: string;
}

export interface CalculatedDecisionResult {
  marketScore: number;
  techScore: number;
  commercialScore: number;
  financialScore: number;
  overallScore: number;
  decision: DecisionType;
  decisionLabel: string;
  decisionBadgeColor: string;
  advice: string;
  hasFatalVeto: boolean;
  fatalReason?: string;
}

/**
 * 依据四维打分精算综合评分与 Go / No-Go 立项决策结论
 * 权重: 市场关系 30% + 技术可行性 25% + 商务资质业绩 25% + 财务资金 20%
 */
export function calculateGoNoGoDecision(input: {
  marketScore: number;
  techScore: number;
  commercialScore: number;
  financialScore: number;
}): CalculatedDecisionResult {
  const m = Math.max(0, Math.min(100, Math.round(input.marketScore || 0)));
  const t = Math.max(0, Math.min(100, Math.round(input.techScore || 0)));
  const c = Math.max(0, Math.min(100, Math.round(input.commercialScore || 0)));
  const f = Math.max(0, Math.min(100, Math.round(input.financialScore || 0)));

  const overallScore = Math.round(m * 0.3 + t * 0.25 + c * 0.25 + f * 0.2);

  // 一票否决机制：若任一维度评分 < 50 分，视为存在严重硬伤
  let hasFatalVeto = false;
  let fatalReason = "";
  if (m < 50) {
    hasFatalVeto = true;
    fatalReason = "客户关系或市场准入门槛评估低于及格线 (低于50分)，可能存在排他性控标";
  } else if (t < 50) {
    hasFatalVeto = true;
    fatalReason = "技术方案或履约交付难度超出能力范围 (低于50分)，履约风险极大";
  } else if (c < 50) {
    hasFatalVeto = true;
    fatalReason = "资质认证或类似业绩存在一票否决缺项 (低于50分)，资格审查面临直接废标";
  } else if (f < 50) {
    hasFatalVeto = true;
    fatalReason = "资金占用巨大或付款条件极其苛刻 (低于50分)，垫资爆仓风险极高";
  }

  let decision: DecisionType = "GO";
  let advice = "";

  if (hasFatalVeto) {
    decision = "NO_GO";
    advice = `【一票否决触发】${fatalReason}。除非能在封标前彻底消除该项硬伤，否则建议果断止损放弃。`;
  } else if (overallScore >= 80) {
    decision = "GO";
    advice = "项目综合竞争力优异，各维度均满足高胜率投标条件，建议立即成立专项投标工作组全速推进！";
  } else if (overallScore >= 65) {
    decision = "CONDITIONAL_GO";
    advice = "项目具备一定的中标机会，但存在部分中度风险点，建议在补齐资质联合体或落实垫资方案后审慎投标。";
  } else {
    decision = "NO_GO";
    advice = "综合评分未达到投标建议基准线 (65分)，预期投入产出比不佳，建议放弃本次投标。";
  }

  return {
    marketScore: m,
    techScore: t,
    commercialScore: c,
    financialScore: f,
    overallScore,
    decision,
    decisionLabel: DECISION_META[decision].label,
    decisionBadgeColor: DECISION_META[decision].badgeColor,
    advice,
    hasFatalVeto,
    fatalReason,
  };
}

export interface WarRoomDetailData {
  followId: number;
  tenderId: number;
  tenderTitle: string;
  purchaser: string | null;
  budgetAmount: number | null;
  status: string;
  priority: string;
  assignee: string | null;
  expireDate: string | null;
  daysToDeadline: number | null;
  creatorName: string;
  notes: string | null;
  teamName?: string;
  evaluation: {
    id?: number;
    marketScore: number;
    techScore: number;
    commercialScore: number;
    financialScore: number;
    overallScore: number;
    decision: DecisionType;
    decisionLabel: string;
    decisionBadgeColor: string;
    decisionReason: string | null;
    riskNotes: string | null;
    leadEvaluator: string | null;
    evaluatedAt: string;
    advice?: string;
  };
  qualificationOverview: {
    totalRequired: number;
    matchedCount: number;
    expiringCount: number;
    expiredCount: number;
    missingCount: number;
    overallFit: string;
    fitLabel: string;
    fitBadgeColor: string;
  };
  caseOverview: {
    totalCasesCount: number;
    validThreeYearsCount: number;
    topMatchCount: number;
    estimatedBonusPoints: number;
  };
  depositOverview: {
    hasDeposit: boolean;
    amount?: number;
    status?: string;
    statusLabel?: string;
    payeeName?: string | null;
    refundDeadline?: string | null;
    isOverdueRisk?: boolean;
  };
  commentsCount: number;
  generatedAt: string;
}

/**
 * 生成公文级《投标项目立项评审与投标决策书》文本
 */
export function generateProjectDossierDocument(
  data: WarRoomDetailData,
  format: "markdown" | "html" = "markdown"
): string {
  const budgetStr = data.budgetAmount ? `${data.budgetAmount} 万元` : "未公开/详见标书";
  const evalData = data.evaluation;

  if (format === "markdown") {
    let md = `# 投标项目立项评审与投标决策书\n\n`;
    md += `> 报告生成时间：${data.generatedAt} | 主持评审人：${evalData.leadEvaluator || data.assignee || "未指定"}\n\n`;
    md += `## 一、标讯项目基础信息\n\n`;
    md += `- **项目名称**：${data.tenderTitle}\n`;
    md += `- **采购单位**：${data.purchaser || "招标人公开招录"}\n`;
    md += `- **预算规模**：${budgetStr}\n`;
    md += `- **截标时间**：${data.expireDate || "详见招标文件"} (距今约 ${data.daysToDeadline ?? "未知"} 天)\n`;
    md += `- **跟进负责人**：${data.assignee || "待指派"}\n\n`;

    md += `## 二、多维度立项评审评分表\n\n`;
    md += `| 评估维度 | 权重 | 评分 (0-100) | 核心考量重点 |\n`;
    md += `|---|---|---|---|\n`;
    md += `| **市场与客户关系** | 30% | **${evalData.marketScore}分** | 客户接触度、前期技术引导、竞对壁垒、控标倾向 |\n`;
    md += `| **技术方案与交付** | 25% | **${evalData.techScore}分** | 技术条款实质偏离度、实施周期、人员与物料资源保障 |\n`;
    md += `| **商务资质与业绩** | 25% | **${evalData.commercialScore}分** | ISO/CMMI资质完备度、近3年类似项目业绩达标与加分 |\n`;
    md += `| **资金与回款风险** | 20% | **${evalData.financialScore}分** | 投标保证金占用、垫资要求、付款节点与财政资金保障 |\n`;
    md += `| **综合加权得分** | 100% | **${evalData.overallScore}分** | **立项结论：${evalData.decisionLabel}** |\n\n`;

    md += `## 三、三流合一资产体检概览\n\n`;
    md += `- **资质审查对标**：标讯门槛要求 ${data.qualificationOverview.totalRequired} 项，已满足有效 ${data.qualificationOverview.matchedCount} 项，临期换证 ${data.qualificationOverview.expiringCount} 项，缺失 ${data.qualificationOverview.missingCount} 项 (${data.qualificationOverview.fitLabel})\n`;
    md += `- **类似业绩支撑**：在库合格业绩 ${data.caseOverview.validThreeYearsCount} 项，首选满分业绩 ${data.caseOverview.topMatchCount} 项，预估商务业绩加分 +${data.caseOverview.estimatedBonusPoints} 分\n`;
    md += `- **保证金流转**：${data.depositOverview.hasDeposit ? `已登记出账 ${data.depositOverview.amount} 元 (${data.depositOverview.statusLabel})` : "暂未登记保证金台账"}\n\n`;

    md += `## 四、立项决策结论与核心理由\n\n`;
    md += `**决策决议**：${evalData.decisionLabel}\n\n`;
    md += `**立项理由**：\n${evalData.decisionReason || "经多部门联合评审，该项目符合企业战略与业务定位，具备可行性。"}\n\n`;
    if (evalData.riskNotes) {
      md += `**关键风险与防范预案**：\n${evalData.riskNotes}\n\n`;
    }

    md += `## 五、会签与审批签署栏\n\n`;
    md += `| 评审部门 | 评审专员 | 会签意见 | 签名 / 日期 |\n`;
    md += `|---|---|---|---|\n`;
    md += `| 销售部负责人 | ${data.assignee || "________"} | 同意立项跟进 | ____________________ |\n`;
    md += `| 技术解决方案部 | ________ | 技术参数无负偏离 | ____________________ |\n`;
    md += `| 商务与财务部 | ________ | 资金与资质核验通过 | ____________________ |\n`;
    md += `| 公司分管副总/投委会 | ________ | 准予立项 / 封标投递 | ____________________ |\n`;
    return md;
  }

  // HTML Print Format
  const html = `<div style="font-family: 'SimSun', '宋体', serif; max-width: 800px; margin: 0 auto; color: #111; line-height: 1.6; padding: 24px;">
  <h1 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 8px;">投标项目立项评审与投标决策书</h1>
  <p style="text-align: center; font-size: 12px; color: #666; margin-bottom: 24px;">评审时间：${data.generatedAt} &nbsp;|&nbsp; 牵头评审人：${evalData.leadEvaluator || data.assignee || "未指定"}</p>

  <h3 style="font-size: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-top: 20px;">一、项目基础信息</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px 10px; background: #f8fafc; width: 120px; font-weight: bold;">项目全称</td>
      <td style="border: 1px solid #ccc; padding: 6px 10px;" colspan="3">${data.tenderTitle}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px 10px; background: #f8fafc; font-weight: bold;">采购单位</td>
      <td style="border: 1px solid #ccc; padding: 6px 10px;">${data.purchaser || "详见标书"}</td>
      <td style="border: 1px solid #ccc; padding: 6px 10px; background: #f8fafc; width: 100px; font-weight: bold;">预算金额</td>
      <td style="border: 1px solid #ccc; padding: 6px 10px;">${budgetStr}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px 10px; background: #f8fafc; font-weight: bold;">截标时间</td>
      <td style="border: 1px solid #ccc; padding: 6px 10px;">${data.expireDate || "详见标书"}</td>
      <td style="border: 1px solid #ccc; padding: 6px 10px; background: #f8fafc; font-weight: bold;">跟进负责人</td>
      <td style="border: 1px solid #ccc; padding: 6px 10px;">${data.assignee || "未指定"}</td>
    </tr>
  </table>

  <h3 style="font-size: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-top: 20px;">二、四维立项量化评审表</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; text-align: center;">
    <tr style="background: #f1f5f9; font-weight: bold;">
      <th style="border: 1px solid #ccc; padding: 6px;">评估维度</th>
      <th style="border: 1px solid #ccc; padding: 6px;">权重</th>
      <th style="border: 1px solid #ccc; padding: 6px;">得分 (0-100)</th>
      <th style="border: 1px solid #ccc; padding: 6px; text-align: left;">考量标准与关键依据</th>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">市场与客户关系</td>
      <td style="border: 1px solid #ccc; padding: 6px;">30%</td>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">${evalData.marketScore}分</td>
      <td style="border: 1px solid #ccc; padding: 6px; text-align: left;">前期技术对接深度、业主需求倾向、竞对壁垒</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">技术方案与交付</td>
      <td style="border: 1px solid #ccc; padding: 6px;">25%</td>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">${evalData.techScore}分</td>
      <td style="border: 1px solid #ccc; padding: 6px; text-align: left;">技术参数实质响应、实施周期排期、实施团队保障</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">商务资质与业绩</td>
      <td style="border: 1px solid #ccc; padding: 6px;">25%</td>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">${evalData.commercialScore}分</td>
      <td style="border: 1px solid #ccc; padding: 6px; text-align: left;">ISO/CMMI资质齐备度、类似业绩合规性与加分潜力</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">资金与回款风险</td>
      <td style="border: 1px solid #ccc; padding: 6px;">20%</td>
      <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">${evalData.financialScore}分</td>
      <td style="border: 1px solid #ccc; padding: 6px; text-align: left;">投标保证金占用、垫资要求、付款节点安全度</td>
    </tr>
    <tr style="background: #f8fafc;">
      <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">综合加权评定</td>
      <td style="border: 1px solid #ccc; padding: 8px;">100%</td>
      <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; color: #2563eb; font-size: 15px;">${evalData.overallScore}分</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; font-weight: bold;">立项决议结论：${evalData.decisionLabel}</td>
    </tr>
  </table>

  <h3 style="font-size: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-top: 20px;">三、立项决策结论与核心理由</h3>
  <div style="border: 1px solid #ccc; padding: 12px; margin-bottom: 16px; font-size: 13px; background: #fafafa; border-radius: 4px;">
    <p style="margin: 0 0 8px 0; font-weight: bold;">评审结论：<span style="color: #2563eb;">${evalData.decisionLabel}</span></p>
    <p style="margin: 0 0 6px 0;"><strong>决策理由：</strong>${evalData.decisionReason || "经联合评审，各维度综合能力匹配，准予立项开展投标。"}</p>
    ${evalData.riskNotes ? `<p style="margin: 6px 0 0 0; color: #b45309;"><strong>风险防范要点：</strong>${evalData.riskNotes}</p>` : ""}
  </div>

  <h3 style="font-size: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-top: 24px;">四、部门会签审批</h3>
  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; text-align: center;">
    <tr style="background: #f1f5f9;">
      <th style="border: 1px solid #ccc; padding: 8px; width: 140px;">评审部门</th>
      <th style="border: 1px solid #ccc; padding: 8px; width: 120px;">会签人</th>
      <th style="border: 1px solid #ccc; padding: 8px;">审批意见</th>
      <th style="border: 1px solid #ccc; padding: 8px; width: 140px;">签署日期</th>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 12px;">销售/商务拓展部</td>
      <td style="border: 1px solid #ccc; padding: 12px;">${data.assignee || ""}</td>
      <td style="border: 1px solid #ccc; padding: 12px;">同意立项跟进</td>
      <td style="border: 1px solid #ccc; padding: 12px;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 12px;">技术方案部</td>
      <td style="border: 1px solid #ccc; padding: 12px;">&nbsp;</td>
      <td style="border: 1px solid #ccc; padding: 12px;">技术方案论证通过</td>
      <td style="border: 1px solid #ccc; padding: 12px;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 12px;">商务与财务部</td>
      <td style="border: 1px solid #ccc; padding: 12px;">&nbsp;</td>
      <td style="border: 1px solid #ccc; padding: 12px;">资质完备/保证金已审核</td>
      <td style="border: 1px solid #ccc; padding: 12px;">&nbsp;</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 16px; font-weight: bold;">总经理 / 投委会</td>
      <td style="border: 1px solid #ccc; padding: 16px;">&nbsp;</td>
      <td style="border: 1px solid #ccc; padding: 16px; font-weight: bold;">准予立项 / 封标投递</td>
      <td style="border: 1px solid #ccc; padding: 16px;">&nbsp;</td>
    </tr>
  </table>
</div>`;

  return html;
}
