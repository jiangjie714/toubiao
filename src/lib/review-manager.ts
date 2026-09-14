export type ReviewOutcome = "WON" | "LOST";

export type PrimaryCauseType =
  | "PRICE"
  | "TECHNICAL"
  | "COMMERCIAL"
  | "CLIENT_RELATION"
  | "COMPLIANCE"
  | "DELIVERY"
  | "OTHER";

export interface CauseMeta {
  code: PrimaryCauseType;
  label: string;
  shortLabel: string;
  category: "PRICE" | "PRODUCT" | "RELATION" | "PROCESS";
  badgeColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  description: string;
  defaultSuggestions: string[];
}

export const PRIMARY_CAUSES_META: Record<PrimaryCauseType, CauseMeta> = {
  PRICE: {
    code: "PRICE",
    label: "报价策略失误 (偏离基准价/高于竞争对手)",
    shortLabel: "报价偏离",
    category: "PRICE",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    bgColor: "bg-amber-50",
    textColor: "text-amber-800",
    borderColor: "border-amber-200",
    description: "投标报价显著偏离复合评标基准价，或在同等技术分下商务报价高于最终中标方导致总分落后。",
    defaultSuggestions: [
      "引入历史中标价区间博弈模型与复合均价拟合算法",
      "严密测算硬件/软件采购底价并建立阶梯折扣库",
      "针对低价敏感型项目采用差异化分包或标准件选型压降BOM成本",
    ],
  },
  TECHNICAL: {
    code: "TECHNICAL",
    label: "技术方案偏离 (关键参数负偏离/方案未定制)",
    shortLabel: "技术硬伤",
    category: "PRODUCT",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
    bgColor: "bg-rose-50",
    textColor: "text-rose-800",
    borderColor: "border-rose-200",
    description: "标书响应方案存在非星号关键参数负偏离、需求理解泛化或技术答辩未击中专家关注点。",
    defaultSuggestions: [
      "严格执行技术参数对照逐条点对点打勾点检制度",
      "杜绝标准模板套用，必须输出针对业主痛点的专属拓扑图与实施路径",
      "组织技术负责人提前开展全真模拟述标与盲审问答演练",
    ],
  },
  COMMERCIAL: {
    code: "COMMERCIAL",
    label: "商务业绩资质短板 (类似案例不足/证书评级差距)",
    shortLabel: "资质业绩",
    category: "PRODUCT",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-800",
    borderColor: "border-indigo-200",
    description: "项目要求的特定同类业绩合同金额、年限或认证资质证书（如保密、体系、CMMI）未达满分档。",
    defaultSuggestions: [
      "加快储备项目所属细分赛道标杆合同与用户验收好评件",
      "依据资质预警罗盘提前启动关键高分资质的补缺申报或升级",
      "对重特大项目论证联合体投标或战略生态伙伴绑定的可行性",
    ],
  },
  CLIENT_RELATION: {
    code: "CLIENT_RELATION",
    label: "客情与倾向壁垒 (竞对长期深耕/需求控标壁垒)",
    shortLabel: "客情控标",
    category: "RELATION",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    bgColor: "bg-purple-50",
    textColor: "text-purple-800",
    borderColor: "border-purple-200",
    description: "业主前期意向方案被竞品长期把控或定制化引导，我方介入过晚缺乏信任背书与深层共识。",
    defaultSuggestions: [
      "前置介入采购意向公开阶段，提前 30-90 天参与前期技术交流与需求论证",
      "建立决策链多维度拜访机制，避免单一接口人信息断层",
      "对控标痕迹严重且无法化解的非对称竞争项目坚决执行 No-Go 止损",
    ],
  },
  COMPLIANCE: {
    code: "COMPLIANCE",
    label: "合规审查被否 (格式瑕疵/保证金未到账/废标)",
    shortLabel: "合规废标",
    category: "PROCESS",
    badgeColor: "bg-red-100 text-red-800 border-red-300",
    bgColor: "bg-red-50",
    textColor: "text-red-800",
    borderColor: "border-red-200",
    description: "投标保证金缴纳路径错误、电子印章签字漏盖、法人授权或星号实质性条款漏答导致无效投标。",
    defaultSuggestions: [
      "标书封标前严格执行《一票否决项双人背对背交叉核验清单》",
      "保证金缴纳至少提前 48 小时出账并核验附言虚拟子账号一致性",
      "升级电子签章防伪与排版质检工具，确保页码与签章全域覆盖",
    ],
  },
  DELIVERY: {
    code: "DELIVERY",
    label: "交付实施与驻场顾虑 (售后网络弱/工期保障疑虑)",
    shortLabel: "交付实施",
    category: "PROCESS",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
    bgColor: "bg-sky-50",
    textColor: "text-sky-800",
    borderColor: "border-sky-200",
    description: "专家或业主对异地驻场运维能力、关键实施人员社保证明或工期承诺可行性存在扣分。",
    defaultSuggestions: [
      "标书中具象化承诺本地化常驻项目部配置与2小时极速到达SLA",
      "提前调配具备同类大型工程履约经验的一建/PMP注册经理并绑定社保证明",
      "提供清晰量化可追溯的甘特图与应急资源调度预案",
    ],
  },
  OTHER: {
    code: "OTHER",
    label: "其他综合突发因素 (评标委员会异议/政策变更等)",
    shortLabel: "其他因素",
    category: "PROCESS",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    bgColor: "bg-slate-50",
    textColor: "text-slate-800",
    borderColor: "border-slate-200",
    description: "不可抗力、地方保护倾向、评标委员会理解分歧或未公布评分子项的其他外部影响。",
    defaultSuggestions: [
      "必要时依据政府采购法依规申请专家打分明细信息公开",
      "持续跟进后续合同签署及履约公示，监测中标方履约合规性",
    ],
  },
};

export const COMMON_SECONDARY_TAGS = [
  "基准价测算失真",
  "竞对极端低价",
  "非星号技术负偏离",
  "标书针对性不足",
  "同类业绩金额未达顶格",
  "项目经理社保年限不足",
  "特定荣誉/专利缺失",
  "介入过晚客情断层",
  "控标参数未提澄清质疑",
  "签字盖章漏项",
  "保证金未注项目编号",
  "本地化服务承诺泛化",
  "述标答辩现场发挥欠佳",
];

export interface ReviewItemData {
  id: number;
  followId: number;
  userId: number;
  outcome: ReviewOutcome;
  winningSupplier?: string | null;
  winningAmount?: number | null;
  myBidAmount?: number | null;
  priceGapPercent?: number | null;
  ranking?: number | null;
  scoreGap?: number | null;
  primaryCause: PrimaryCauseType;
  secondaryCauses: string[];
  strengths?: string | null;
  shortcomings?: string | null;
  actionItems?: string | null;
  reviewer?: string | null;
  reviewedAt: string;
  createdAt: string;
  projectInfo: {
    tenderId: number;
    title: string;
    purchaser?: string | null;
    budgetAmount?: number | null;
    status: string;
    teamName?: string | null;
    assignee?: string | null;
  };
}

export interface ReviewMetricsSummary {
  totalCount: number;
  wonCount: number;
  lostCount: number;
  winRate: number; // 0-100
  totalWonAmount: number; // 元
  totalMyBidAmount: number; // 元
  totalBudgetAmount: number; // 元
  causeBreakdown: {
    cause: PrimaryCauseType;
    label: string;
    shortLabel: string;
    count: number;
    percent: number;
    badgeColor: string;
  }[];
  priceGapStats: {
    higherCount: number; // 高于中标价
    similarCount: number; // 紧贴中标价 (-5% ~ +5%)
    lowerCount: number; // 低于中标价
    avgPriceGapPercent: number;
  };
  topShortcomings: string[];
  topStrengths: string[];
}

/**
 * 计算报价偏离度百分比
 * ((我方报价 - 最终中标金额) / 最终中标金额) * 100
 */
export function calculatePriceGapPercent(
  myBidAmount?: number | null,
  winningAmount?: number | null
): { percent: number | null; text: string; status: "higher" | "lower" | "equal" | "unknown" } {
  if (!myBidAmount || !winningAmount || winningAmount <= 0) {
    return { percent: null, text: "未录入完整比对报价", status: "unknown" };
  }

  const gap = myBidAmount - winningAmount;
  const percent = Math.round((gap / winningAmount) * 10000) / 100; // 保留2位小数

  if (Math.abs(percent) <= 1) {
    return { percent, text: `微弱差距 (${percent > 0 ? "+" : ""}${percent}%)`, status: "equal" };
  } else if (percent > 0) {
    return { percent, text: `高于中标价 +${percent}%`, status: "higher" };
  } else {
    return { percent, text: `低于中标价 ${percent}%`, status: "lower" };
  }
}

/**
 * 汇总统计复盘大盘关键指标与归因漏斗
 */
export function aggregateReviewMetrics(reviews: ReviewItemData[]): ReviewMetricsSummary {
  const totalCount = reviews.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      wonCount: 0,
      lostCount: 0,
      winRate: 0,
      totalWonAmount: 0,
      totalMyBidAmount: 0,
      totalBudgetAmount: 0,
      causeBreakdown: [],
      priceGapStats: {
        higherCount: 0,
        similarCount: 0,
        lowerCount: 0,
        avgPriceGapPercent: 0,
      },
      topShortcomings: [],
      topStrengths: [],
    };
  }

  let wonCount = 0;
  let lostCount = 0;
  let totalWonAmount = 0;
  let totalMyBidAmount = 0;
  let totalBudgetAmount = 0;

  const causeCounts: Record<PrimaryCauseType, number> = {
    PRICE: 0,
    TECHNICAL: 0,
    COMMERCIAL: 0,
    CLIENT_RELATION: 0,
    COMPLIANCE: 0,
    DELIVERY: 0,
    OTHER: 0,
  };

  let higherCount = 0;
  let similarCount = 0;
  let lowerCount = 0;
  let sumGapPercent = 0;
  let validGapCount = 0;

  const shortcomingsList: string[] = [];
  const strengthsList: string[] = [];

  for (const item of reviews) {
    if (item.outcome === "WON") {
      wonCount++;
      if (item.winningAmount) totalWonAmount += Number(item.winningAmount);
    } else {
      lostCount++;
    }

    if (item.myBidAmount) totalMyBidAmount += Number(item.myBidAmount);
    if (item.projectInfo.budgetAmount) totalBudgetAmount += Number(item.projectInfo.budgetAmount);

    if (item.primaryCause && causeCounts[item.primaryCause] !== undefined) {
      causeCounts[item.primaryCause]++;
    }

    if (item.priceGapPercent !== null && item.priceGapPercent !== undefined) {
      const p = Number(item.priceGapPercent);
      validGapCount++;
      sumGapPercent += p;
      if (p > 5) higherCount++;
      else if (p < -5) lowerCount++;
      else similarCount++;
    }

    if (item.shortcomings && item.shortcomings.trim()) {
      shortcomingsList.push(item.shortcomings.trim());
    }
    if (item.strengths && item.strengths.trim()) {
      strengthsList.push(item.strengths.trim());
    }
  }

  const winRate = totalCount > 0 ? Math.round((wonCount / totalCount) * 1000) / 10 : 0;
  const avgPriceGapPercent =
    validGapCount > 0 ? Math.round((sumGapPercent / validGapCount) * 10) / 10 : 0;

  // 整理失标归因排序
  const causeBreakdown = (Object.keys(causeCounts) as PrimaryCauseType[])
    .map((code) => {
      const count = causeCounts[code];
      const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const meta = PRIMARY_CAUSES_META[code];
      return {
        cause: code,
        label: meta.label,
        shortLabel: meta.shortLabel,
        count,
        percent,
        badgeColor: meta.badgeColor,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    totalCount,
    wonCount,
    lostCount,
    winRate,
    totalWonAmount,
    totalMyBidAmount,
    totalBudgetAmount,
    causeBreakdown,
    priceGapStats: {
      higherCount,
      similarCount,
      lowerCount,
      avgPriceGapPercent,
    },
    topShortcomings: shortcomingsList.slice(0, 5),
    topStrengths: strengthsList.slice(0, 5),
  };
}

/**
 * 格式化金额为万元/元字符串
 */
export function formatCurrencyWan(amount?: number | null): string {
  if (!amount || isNaN(amount)) return "-";
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(2)} 万元`;
  }
  return `${amount.toLocaleString("zh-CN")} 元`;
}

/**
 * 一键生成《投标项目开标复盘与胜败归因诊断报告》(Markdown公文格式)
 */
export function generateReviewReportMarkdown(item: ReviewItemData): string {
  const meta = PRIMARY_CAUSES_META[item.primaryCause] || PRIMARY_CAUSES_META.OTHER;
  const isWon = item.outcome === "WON";
  const outcomeText = isWon ? "【中标 WIN】" : "【失标 LOSS】";
  const dateStr = item.reviewedAt ? item.reviewedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const priceGapInfo = calculatePriceGapPercent(item.myBidAmount, item.winningAmount);

  return `# 投标项目开标复盘与胜败归因总结报告

**报告编号**: REV-${item.followId}-${Date.now().toString().slice(-6)}  
**项目名称**: ${item.projectInfo.title}  
**开标结果**: **${outcomeText}**  
**复盘主持/主笔人**: ${item.reviewer || "项目复盘工作组"}  
**复盘归档日期**: ${dateStr}  

---

## 一、项目与开标核心数据对比

| 关键对比指标 | 数据明细 / 现状 | 说明与对标分析 |
| :--- | :--- | :--- |
| **采购单位 (业主)** | ${item.projectInfo.purchaser || "详见采购公告"} | 最终需求方 |
| **项目采购预算** | ${formatCurrencyWan(item.projectInfo.budgetAmount)} | 采购控制上限价 |
| **最终中标单位** | ${item.winningSupplier || (isWon ? "我方企业中标" : "竞对单位")} | 本项目第一中标候选人 |
| **最终中标金额** | ${formatCurrencyWan(item.winningAmount)} | 最终成交落地金额 |
| **我方投标报价** | ${formatCurrencyWan(item.myBidAmount)} | 我方封标最终报价 |
| **报价偏离率** | **${priceGapInfo.text}** | ${item.priceGapPercent !== null ? `相对偏离 ${(Number(item.priceGapPercent) > 0 ? "+" : "") + item.priceGapPercent}%` : "未录入"} |
| **综合评分排名** | ${item.ranking ? `第 ${item.ranking} 名` : "未公布名次"} | 评标专家最终赋分排序 |
| **与第一名分差** | ${item.scoreGap !== null && item.scoreGap !== undefined ? `${item.scoreGap} 分` : "无分差记录"} | 综合实力与现场赋分差距 |

---

## 二、胜败核心归因深度诊断

### 1. 核心主因判定
> **诊断结论**: **${meta.label}**  
> **归因释义**: ${meta.description}

### 2. 关联失误与次要诱因标签
${
  item.secondaryCauses && item.secondaryCauses.length > 0
    ? item.secondaryCauses.map((tag) => `- ⚠️ **${tag}**`).join("\n")
    : "- 无特定次要诱因标签"
}

---

## 三、本次实战亮点与经验沉淀 (Keep Doing)

${
  item.strengths && item.strengths.trim()
    ? item.strengths.trim()
    : "本项目尚未记录突出亮点。建议在商务组织协同、方案快速响应、响应速度等方面做深入提炼。"
}

---

## 四、短板与失误教训检讨 (Stop Doing)

${
  item.shortcomings && item.shortcomings.trim()
    ? item.shortcomings.trim()
    : "未登记明显失误，但建议重点排查商务技术扣分明细与报价测算偏差点。"
}

---

## 五、整改防范措施与长效机制沉淀 (Start Doing)

${
  item.actionItems && item.actionItems.trim()
    ? item.actionItems.trim()
    : meta.defaultSuggestions.map((s, idx) => `${idx + 1}. ${s}`).join("\n")
}

### 💡 专家建议锦囊
${meta.defaultSuggestions.map((s) => `- ${s}`).join("\n")}

---

*报告生成：标讯通企业级智能决策罗盘 · 商业化复盘引擎*
`;
}
