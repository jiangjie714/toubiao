import { prisma } from "@/lib/prisma";

export type CompetitorTag = "CORE" | "REGIONAL" | "LOW_PRICE" | "PARTNER";

export type CompetitorEventKind =
  | "ENCROACHMENT"
  | "MEGA_PROJECT"
  | "DEEP_DISCOUNT"
  | "NORMAL_WIN";

export type CompetitorThreatLevel = "HIGH" | "MEDIUM" | "LOW";

export interface CompetitorTagMeta {
  tag: CompetitorTag;
  label: string;
  shortLabel: string;
  description: string;
  badgeCls: string;
}

export const COMPETITOR_TAG_METAS: Record<CompetitorTag, CompetitorTagMeta> = {
  CORE: {
    tag: "CORE",
    label: "核心宿敌",
    shortLabel: "宿敌",
    description: "业务范围高度重合、重大标段同台竞技的高危战略对手。",
    badgeCls: "bg-rose-100 text-rose-800 border-rose-200",
  },
  REGIONAL: {
    tag: "REGIONAL",
    label: "区域龙头",
    shortLabel: "地头蛇",
    description: "在特定省市深耕、具备本地化商务与人脉壁垒的区域强手。",
    badgeCls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  LOW_PRICE: {
    tag: "LOW_PRICE",
    label: "价格搅局者",
    shortLabel: "低价杀手",
    description: "习惯以极低折扣下浮率杀入、扰乱商务控标价格体系的激进企业。",
    badgeCls: "bg-red-100 text-red-800 border-red-200",
  },
  PARTNER: {
    tag: "PARTNER",
    label: "潜在联合体",
    shortLabel: "合作方",
    description: "具备特定资质或行业案例互补，可考虑组建联合体联合投标的友商。",
    badgeCls: "bg-blue-100 text-blue-800 border-blue-200",
  },
};

export interface CompetitorWatchItem {
  id: number;
  competitorName: string;
  tag: CompetitorTag;
  notes: string | null;
  alertOnWin: boolean;
  alertOnEncroachment: boolean;
  createdAt: string;
  // 动态分析统计数据
  totalWinsCount: number;
  totalWinAmount: number; // 万元
  last30DaysWinsCount: number;
  last30DaysWinAmount: number; // 万元
  threatLevel: CompetitorThreatLevel;
  encroachmentCount: number; // 渗透我方客户次数
  topIndustries: string[];
  topPurchasers: string[];
  latestWinDate: string | null;
}

export interface CompetitorFeedItem {
  id: number; // tenderId
  competitorName: string;
  tenderTitle: string;
  purchaser: string;
  awardAmount: number | null; // 万元
  budgetAmount: number | null; // 万元
  discountRate: number | null; // % 例如 85.5%
  publishDate: string;
  provinceCode: string | null;
  eventKind: CompetitorEventKind;
  eventBadgeText: string;
  eventBadgeCls: string;
  encroachmentReason?: string;
  sourceUrl: string | null;
}

export interface CompetitorRadarOverview {
  myCompanyName: string | null;
  totalWatchedCount: number;
  last30DaysCompWinAmount: number; // 万元
  last30DaysTotalWins: number;
  totalEncroachmentAlerts: number;
  watchlist: CompetitorWatchItem[];
  recentFeeds: CompetitorFeedItem[];
}

export interface HeadToHeadReport {
  myCompanyName: string;
  competitorName: string;
  myTotalWins: number;
  compTotalWins: number;
  myTotalAmount: number; // 万元
  compTotalAmount: number; // 万元
  sharedPurchasers: {
    purchaser: string;
    myWins: number;
    compWins: number;
    latestTenderTitle: string;
  }[];
  totalSharedPurchasersCount: number;
  tacticalSuggestions: string[];
}

/**
 * 获取当前用户的关注买方列表（用于后院起火/客户渗透碰撞判断）
 */
async function getUserFocalPurchasers(userId: number): Promise<Set<string>> {
  const follows = await prisma.tenderFollow.findMany({
    where: { userId },
    select: {
      tender: {
        select: { purchaser: true },
      },
    },
  });

  const purchaserSet = new Set<string>();
  for (const f of follows) {
    if (f.tender?.purchaser) {
      const p = f.tender.purchaser.trim();
      if (p.length >= 3) {
        purchaserSet.add(p);
      }
    }
  }
  return purchaserSet;
}

/**
 * 汇总竞对监控大盘
 */
export async function getCompetitorRadarOverview(
  userId: number
): Promise<CompetitorRadarOverview> {
  const [userProfile, watches, focalPurchasers] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { userId },
      select: { companyName: true },
    }),
    prisma.competitorWatch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    getUserFocalPurchasers(userId),
  ]);

  const myCompanyName = userProfile?.companyName?.trim() || null;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const watchItems: CompetitorWatchItem[] = [];
  let last30DaysCompWinAmount = 0;
  let last30DaysTotalWins = 0;
  let totalEncroachmentAlerts = 0;

  for (const w of watches) {
    const compName = w.competitorName.trim();
    // 模糊检索该竞对的中标公告
    const tenders = await prisma.tender.findMany({
      where: {
        type: "RESULT",
        winningSupplier: {
          contains: compName,
        },
      },
      select: {
        id: true,
        awardAmount: true,
        purchaser: true,
        publishDate: true,
        industryCode: true,
      },
      orderBy: { publishDate: "desc" },
      take: 100,
    });

    let totalWins = 0;
    let totalAmount = 0;
    let l30Wins = 0;
    let l30Amount = 0;
    let encroachmentCount = 0;
    const purchaserCounts: Record<string, number> = {};
    const industryCounts: Record<string, number> = {};

    for (const t of tenders) {
      totalWins++;
      const amt = t.awardAmount ? Number(t.awardAmount) : 0;
      totalAmount += amt;

      const pDate = t.publishDate ? new Date(t.publishDate) : null;
      if (pDate && pDate >= thirtyDaysAgo) {
        l30Wins++;
        l30Amount += amt;
      }

      if (t.purchaser) {
        purchaserCounts[t.purchaser] = (purchaserCounts[t.purchaser] || 0) + 1;
        // 检测是否渗透我方跟进买方
        if (focalPurchasers.has(t.purchaser.trim())) {
          encroachmentCount++;
        }
      }

      if (t.industryCode) {
        industryCounts[t.industryCode] = (industryCounts[t.industryCode] || 0) + 1;
      }
    }

    last30DaysTotalWins += l30Wins;
    last30DaysCompWinAmount += l30Amount;
    totalEncroachmentAlerts += encroachmentCount;

    // 威胁等级计算
    let threatLevel: CompetitorThreatLevel = "LOW";
    if (encroachmentCount > 0 || l30Amount >= 500 || w.tag === "CORE") {
      threatLevel = "HIGH";
    } else if (l30Wins > 0 || totalAmount >= 1000) {
      threatLevel = "MEDIUM";
    }

    const topPurchasers = Object.entries(purchaserCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    const topIndustries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    watchItems.push({
      id: w.id,
      competitorName: w.competitorName,
      tag: (w.tag as CompetitorTag) || "CORE",
      notes: w.notes,
      alertOnWin: w.alertOnWin,
      alertOnEncroachment: w.alertOnEncroachment,
      createdAt: w.createdAt.toISOString(),
      totalWinsCount: totalWins,
      totalWinAmount: Math.round(totalAmount * 100) / 100,
      last30DaysWinsCount: l30Wins,
      last30DaysWinAmount: Math.round(l30Amount * 100) / 100,
      threatLevel,
      encroachmentCount,
      topIndustries,
      topPurchasers,
      latestWinDate: tenders[0]?.publishDate
        ? new Date(tenders[0].publishDate).toISOString().split("T")[0]
        : null,
    });
  }

  // 按威胁等级和近30天中标金额降序排列
  watchItems.sort((a, b) => {
    const rankMap: Record<CompetitorThreatLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (rankMap[b.threatLevel] !== rankMap[a.threatLevel]) {
      return rankMap[b.threatLevel] - rankMap[a.threatLevel];
    }
    return b.last30DaysWinAmount - a.last30DaysWinAmount;
  });

  // 获取前 15 条全局动态情报流
  const recentFeeds = await getCompetitorActivityFeed(userId, { limit: 15 });

  return {
    myCompanyName,
    totalWatchedCount: watches.length,
    last30DaysCompWinAmount: Math.round(last30DaysCompWinAmount * 100) / 100,
    last30DaysTotalWins,
    totalEncroachmentAlerts,
    watchlist: watchItems,
    recentFeeds,
  };
}

/**
 * 获取竞对实时动态战报情报流 (Activity Feed)
 */
export async function getCompetitorActivityFeed(
  userId: number,
  options?: {
    competitorName?: string;
    limit?: number;
    offset?: number;
    onlyAlerts?: boolean;
  }
): Promise<CompetitorFeedItem[]> {
  const limit = Math.min(options?.limit || 20, 50);
  const offset = options?.offset || 0;

  const [watches, focalPurchasers] = await Promise.all([
    prisma.competitorWatch.findMany({
      where: {
        userId,
        ...(options?.competitorName
          ? { competitorName: options.competitorName }
          : {}),
      },
      select: { competitorName: true, tag: true },
    }),
    getUserFocalPurchasers(userId),
  ]);

  if (watches.length === 0) {
    return [];
  }

  const compNames = watches.map((w) => w.competitorName.trim());

  // 检索包含这些竞对名称的中标公告
  const whereClauses = compNames.map((name) => ({
    winningSupplier: { contains: name },
  }));

  const tenders = await prisma.tender.findMany({
    where: {
      type: "RESULT",
      OR: whereClauses,
    },
    select: {
      id: true,
      title: true,
      winningSupplier: true,
      purchaser: true,
      budgetAmount: true,
      awardAmount: true,
      publishDate: true,
      provinceCode: true,
      sourceUrl: true,
    },
    orderBy: { publishDate: "desc" },
    skip: offset,
    take: limit * 2, // 多取一些在内存中打标和筛选
  });

  const feeds: CompetitorFeedItem[] = [];

  for (const t of tenders) {
    const rawSupplier = t.winningSupplier || "";
    // 匹配具体是哪一家关注的竞对
    const matchedComp = compNames.find((name) => rawSupplier.includes(name)) || rawSupplier;
    const purchaser = t.purchaser || "未知采购单位";
    const award = t.awardAmount ? Number(t.awardAmount) : null;
    const budget = t.budgetAmount ? Number(t.budgetAmount) : null;

    let discountRate: number | null = null;
    if (budget && award && budget > 0 && award > 0 && award <= budget * 1.5) {
      discountRate = Math.round((award / budget) * 1000) / 10;
    }

    // 事件分类判定
    let eventKind: CompetitorEventKind = "NORMAL_WIN";
    let eventBadgeText = "中标战报";
    let eventBadgeCls = "bg-slate-100 text-slate-700 border-slate-200";
    let encroachmentReason: string | undefined = undefined;

    const isEncroachment = focalPurchasers.has(purchaser.trim());

    if (isEncroachment) {
      eventKind = "ENCROACHMENT";
      eventBadgeText = "后院起火·深耕客户被渗透";
      eventBadgeCls = "bg-rose-600 text-white border-rose-700";
      encroachmentReason = `【${purchaser}】为您跟踪/跟进的重点客户，该标段被对手拿下！`;
    } else if (award && award >= 1000) {
      eventKind = "MEGA_PROJECT";
      eventBadgeText = "千万级/亿元大标";
      eventBadgeCls = "bg-purple-100 text-purple-800 border-purple-300";
    } else if (discountRate && discountRate < 70) {
      eventKind = "DEEP_DISCOUNT";
      eventBadgeText = `低价突袭 (${discountRate}折)`;
      eventBadgeCls = "bg-amber-100 text-amber-800 border-amber-300";
    }

    if (options?.onlyAlerts && eventKind === "NORMAL_WIN") {
      continue;
    }

    feeds.push({
      id: t.id,
      competitorName: matchedComp,
      tenderTitle: t.title,
      purchaser,
      awardAmount: award,
      budgetAmount: budget,
      discountRate,
      publishDate: t.publishDate
        ? new Date(t.publishDate).toISOString().split("T")[0]
        : "近期",
      provinceCode: t.provinceCode,
      eventKind,
      eventBadgeText,
      eventBadgeCls,
      encroachmentReason,
      sourceUrl: t.sourceUrl,
    });

    if (feeds.length >= limit) break;
  }

  return feeds;
}

/**
 * 获取同场竞技与交锋攻防沙箱报告
 */
export async function getHeadToHeadAnalysis(
  userId: number,
  competitorName: string
): Promise<HeadToHeadReport> {
  const profile = await prisma.companyProfile.findUnique({
    where: { userId },
    select: { companyName: true },
  });

  const myCompanyName = profile?.companyName?.trim() || "我方企业";
  const compName = competitorName.trim();

  // 1. 查询我方的中标公告
  const myTenders = await prisma.tender.findMany({
    where: {
      type: "RESULT",
      winningSupplier: { contains: myCompanyName },
    },
    select: {
      id: true,
      purchaser: true,
      awardAmount: true,
      title: true,
      provinceCode: true,
    },
  });

  // 2. 查询竞对的中标公告
  const compTenders = await prisma.tender.findMany({
    where: {
      type: "RESULT",
      winningSupplier: { contains: compName },
    },
    select: {
      id: true,
      purchaser: true,
      awardAmount: true,
      title: true,
      provinceCode: true,
    },
  });

  // 3. 统计共同发包方（买方机构）
  const myPurchasers = new Map<string, { wins: number; amount: number; latest: string }>();
  for (const t of myTenders) {
    if (!t.purchaser) continue;
    const p = t.purchaser.trim();
    const curr = myPurchasers.get(p) || { wins: 0, amount: 0, latest: t.title };
    curr.wins++;
    curr.amount += t.awardAmount ? Number(t.awardAmount) : 0;
    myPurchasers.set(p, curr);
  }

  const compPurchasers = new Map<string, { wins: number; amount: number; latest: string }>();
  for (const t of compTenders) {
    if (!t.purchaser) continue;
    const p = t.purchaser.trim();
    const curr = compPurchasers.get(p) || { wins: 0, amount: 0, latest: t.title };
    curr.wins++;
    curr.amount += t.awardAmount ? Number(t.awardAmount) : 0;
    compPurchasers.set(p, curr);
  }

  const sharedPurchasers: {
    purchaser: string;
    myWins: number;
    compWins: number;
    latestTenderTitle: string;
  }[] = [];

  for (const [purchaser, myData] of myPurchasers.entries()) {
    const compData = compPurchasers.get(purchaser);
    if (compData) {
      sharedPurchasers.push({
        purchaser,
        myWins: myData.wins,
        compWins: compData.wins,
        latestTenderTitle: compData.latest,
      });
    }
  }

  // 按双方总角逐次数降序排列
  sharedPurchasers.sort((a, b) => b.myWins + b.compWins - (a.myWins + a.compWins));

  const myTotalAmount = myTenders.reduce(
    (sum, t) => sum + (t.awardAmount ? Number(t.awardAmount) : 0),
    0
  );
  const compTotalAmount = compTenders.reduce(
    (sum, t) => sum + (t.awardAmount ? Number(t.awardAmount) : 0),
    0
  );

  // 战术攻防建议
  const tacticalSuggestions: string[] = [];
  if (sharedPurchasers.length > 0) {
    tacticalSuggestions.push(
      `在【${sharedPurchasers[0].purchaser}】等 ${sharedPurchasers.length} 家采购单位处与对手存在直接客群重合，建议建立客户独家技术标准宣贯壁垒。`
    );
  } else {
    tacticalSuggestions.push(
      "目前双方在已开标库中尚未出现重叠采购人，属于错位竞争态势，但需高度警惕其跨战区扩张动向。"
    );
  }

  if (compTotalAmount > myTotalAmount) {
    tacticalSuggestions.push(
      `对手历史中标规模（${Math.round(compTotalAmount)}万元）高于我方（${Math.round(myTotalAmount)}万元），其在同类标段评审中可能在“企业同类业绩”评分项上占优，建议强化我方专利软著与定制化方案优势。`
    );
  } else {
    tacticalSuggestions.push(
      `我方历史总业绩（${Math.round(myTotalAmount)}万元）领先于对手，在标书商务打分中具有业绩压制优势，应保持头部案例展示力度。`
    );
  }

  return {
    myCompanyName,
    competitorName: compName,
    myTotalWins: myTenders.length,
    compTotalWins: compTenders.length,
    myTotalAmount: Math.round(myTotalAmount * 100) / 100,
    compTotalAmount: Math.round(compTotalAmount * 100) / 100,
    sharedPurchasers,
    totalSharedPurchasersCount: sharedPurchasers.length,
    tacticalSuggestions,
  };
}

/**
 * 生成公文级竞对态势周报 Markdown
 */
export function generateCompetitorBriefingMarkdown(
  overview: CompetitorRadarOverview,
  authorName?: string
): string {
  const nowStr = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const highThreatCount = overview.watchlist.filter((w) => w.threatLevel === "HIGH").length;

  return `# 核心竞对中标态势与战略攻防简报

**生成时间**：${nowStr}  
**编制主体**：${overview.myCompanyName || "标讯通企业版客户"}  
**数据来源**：全国公共资源交易与政府采购网大数据大数据穿透  
**密级评级**：内部决策参考·商业秘密  

---

## 一、宏观监控大盘与态势摘要

| 监控指标 | 数值 | 战略解读 |
| :--- | :--- | :--- |
| **重点监控对手总数** | **${overview.totalWatchedCount}** 家 | 覆盖核心宿敌、区域龙头与价格搅局者 |
| **高危威胁对手数量** | **${highThreatCount}** 家 | 发生客户渗透或近期中标超千万的高侵略性对手 |
| **近30天对手中标总额** | **¥${overview.last30DaysCompWinAmount.toLocaleString()}** 万元 | 对手近期在招投标市场的资金吸纳规模 |
| **近30天对手中标标段** | **${overview.last30DaysTotalWins}** 标 | 竞对拿单频率与扩张节奏 |
| **后院起火/客户渗透警报** | **${overview.totalEncroachmentAlerts}** 起 | 对手中标我方已跟踪/已合作买方标段次数 |

---

## 二、重点竞对战力与威胁排行榜

${
  overview.watchlist.length === 0
    ? "_暂未添加监控对手，请在【重点监控矩阵】中添加目标竞争对手。_"
    : overview.watchlist
        .map((w, idx) => {
          const tagInfo = COMPETITOR_TAG_METAS[w.tag];
          return `### ${idx + 1}. ${w.competitorName}【${tagInfo.label}】
- **威胁等级**：${w.threatLevel === "HIGH" ? "🔴 高危威胁" : w.threatLevel === "MEDIUM" ? "🟡 中度关注" : "🟢 暂处于低位"}
- **历史总中标**：${w.totalWinsCount} 标 / 累计 ¥${w.totalWinAmount.toLocaleString()} 万元
- **近30天战绩**：新增中标 ${w.last30DaysWinsCount} 标 / ¥${w.last30DaysWinAmount.toLocaleString()} 万元
- **主攻行业赛道**：${w.topIndustries.length > 0 ? w.topIndustries.join("、") : "未分类"}
- **常驻发包朋友圈**：${w.topPurchasers.length > 0 ? w.topPurchasers.join("、") : "暂无"}
- **客户渗透预警**：${w.encroachmentCount > 0 ? `⚠️ 已渗透我方目标客户 ${w.encroachmentCount} 次！` : "✅ 暂未发生正面客户冲突"}
- **内部攻防备忘**：${w.notes || "暂无备忘记录"}
`;
        })
        .join("\n")
}

---

## 三、最新异动情报流战报 (Top 10)

${
  overview.recentFeeds.length === 0
    ? "_暂未抓取到对手近期中标情报。_"
    : overview.recentFeeds
        .slice(0, 10)
        .map((f, i) => {
          return `${i + 1}. **[${f.eventBadgeText}]** ${f.publishDate}  
   - **中标企业**：${f.competitorName}  
   - **中标项目**：${f.tenderTitle}  
   - **发包单位**：${f.purchaser}  
   - **中标金额**：${f.awardAmount ? `¥${f.awardAmount} 万元` : "未公示金额"} ${f.discountRate ? `(下浮率/折扣: ${f.discountRate}%)` : ""}  
   ${f.encroachmentReason ? `   - 🚨 **攻防警报**：${f.encroachmentReason}\n` : ""}`;
        })
        .join("\n")
}

---

## 四、战略应对与攻防推演指引

1. **针对后院起火标段开展穿透复盘**：
   - 立即调阅竞对在被渗透采购人处的中标投标文件与澄清文件，对标其商务报价与技术配置方案，排查我方在前期商务公关与技术沟通中的漏洞。
2. **警惕低价倾销扰乱市场**：
   - 若发现价格搅局者以远低于行业成本价的中标（折扣 <70%），建议在后续同类项目中向招标代理及监督部门提出“异常低价合理性说明与履约能力审查”异议。
3. **在常驻战区建立客户防线**：
   - 针对近30天持续拿单的区域龙头对手，加深属地化运维与即时响应保障承诺，突出我方服务本地化与已交付样板工程案例。

---
*报告生成系统：标讯通企业版 (Toubiao Commercial Engine) · 审核员：${authorName || "系统自动生成"}*
`;
}
