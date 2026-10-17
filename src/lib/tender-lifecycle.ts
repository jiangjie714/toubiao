export interface LifecycleMilestone {
  key: "acquisition" | "clarify" | "deposit" | "openBid";
  label: string;
  date: Date | null;
  dateStr: string;
  isPassed: boolean;
  hoursRemaining?: number;
  urgency: "EXPIRED" | "CRITICAL" | "ATTENTION" | "NORMAL" | "UNKNOWN";
}

export interface ChangeHighlight {
  category: "POSTPONE" | "SPEC_CHANGE" | "BUDGET_CHANGE" | "TERMINATION" | "OTHER";
  categoryLabel: string;
  categoryColor: string;
  originalText?: string;
  revisedText?: string;
  summary: string;
}

export interface GanttStage {
  stageKey: "INTENTION" | "NOTICE" | "CHANGE" | "EVALUATION" | "RESULT";
  stageName: string;
  status: "COMPLETED" | "CURRENT" | "PENDING";
  notices: Array<{
    id: number;
    title: string;
    type: string;
    publishDate: string;
    isCurrent: boolean;
  }>;
  milestoneDate?: string;
  milestoneDesc?: string;
}

export interface ProjectLifecycleOverview {
  currentStage: "INTENTION" | "NOTICE" | "CHANGE" | "EVALUATION" | "RESULT";
  currentStageName: string;
  bidOpenTime: Date | null;
  bidOpenTimeStr: string | null;
  countdown: {
    isPassed: boolean;
    days: number;
    hours: number;
    minutes: number;
    badgeText: string;
    badgeStyle: string;
  } | null;
  milestones: LifecycleMilestone[];
  stages: GanttStage[];
  changes: ChangeHighlight[];
  hasPostponed: boolean;
}

const DATE_REGEX =
  /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})(?:日)?(?:\s*(\d{1,2})[:：点](\d{1,2}))?/;

function parseChineseDate(raw: string): Date | null {
  const match = raw.match(DATE_REGEX);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const hour = match[4] ? parseInt(match[4], 10) : 9;
  const min = match[5] ? parseInt(match[5], 10) : 0;
  const d = new Date(year, month, day, hour, min, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 从公告正文与标题中提取关键节点时间
 */
export function extractLifecycleDates(content: string): {
  openBidTime: Date | null;
  clarifyDeadline: Date | null;
  depositDeadline: Date | null;
} {
  let openBidTime: Date | null = null;
  let clarifyDeadline: Date | null = null;
  let depositDeadline: Date | null = null;

  // 1. 开标时间 / 投标截止时间
  const openBidMatches = content.match(
    /(?:开标时间|投标截止时间|递交投标文件截止时间|开启时间)[：:\s]*([^。\n；]{8,35})/g,
  );
  if (openBidMatches && openBidMatches.length > 0) {
    for (const m of openBidMatches) {
      const parsed = parseChineseDate(m);
      if (parsed) {
        openBidTime = parsed;
        break;
      }
    }
  }

  // 2. 答疑/澄清截止时间
  const clarifyMatches = content.match(
    /(?:提出疑问截止时间|答疑截止时间|质疑截止时间|澄清截止时间)[：:\s]*([^。\n；]{8,35})/g,
  );
  if (clarifyMatches) {
    for (const m of clarifyMatches) {
      const parsed = parseChineseDate(m);
      if (parsed) {
        clarifyDeadline = parsed;
        break;
      }
    }
  }

  // 3. 保证金缴纳截止时间
  const depositMatches = content.match(
    /(?:保证金缴纳截止时间|投标保证金交纳截止时间|保证金到账截止时间)[：:\s]*([^。\n；]{8,35})/g,
  );
  if (depositMatches) {
    for (const m of depositMatches) {
      const parsed = parseChineseDate(m);
      if (parsed) {
        depositDeadline = parsed;
        break;
      }
    }
  }

  return { openBidTime, clarifyDeadline, depositDeadline };
}

/**
 * 变更公告（更正/答疑）对比点识别
 */
export function extractChangeHighlights(
  content: string,
  title: string,
): ChangeHighlight[] {
  const highlights: ChangeHighlight[] = [];
  const fullText = `${title}\n${content}`;

  // 1. 开标延期判断
  if (
    fullText.includes("延期") ||
    fullText.includes("顺延") ||
    fullText.includes("推迟") ||
    (fullText.includes("变更") && (fullText.includes("开标时间") || fullText.includes("截止时间")))
  ) {
    // 尝试提取延期段落
    const timeMatch = content.match(
      /(?:原(?:开标|投标截止)时间[^。\n]*?现(?:变更为|调整为|延期至)[^。\n]*)/,
    );
    highlights.push({
      category: "POSTPONE",
      categoryLabel: "开标时间延期",
      categoryColor: "bg-rose-50 text-rose-700 border-rose-200",
      summary: timeMatch ? timeMatch[0] : "项目开标或应答截止时间发生顺延/调整，请核对最新截止时间。",
    });
  }

  // 2. 废标 / 终止
  if (
    fullText.includes("废标") ||
    fullText.includes("终止") ||
    fullText.includes("流标") ||
    fullText.includes("撤销")
  ) {
    highlights.push({
      category: "TERMINATION",
      categoryLabel: "终止/流标",
      categoryColor: "bg-slate-100 text-slate-700 border-slate-300",
      summary: "该项目已进入流标、终止或废标状态，请停止编制或查阅重新组织招标通知。",
    });
  }

  // 3. 参数或技术要求修改
  if (
    fullText.includes("技术参数") ||
    fullText.includes("采购需求") ||
    fullText.includes("资格条件") ||
    fullText.includes("评分办法")
  ) {
    highlights.push({
      category: "SPEC_CHANGE",
      categoryLabel: "参数/条件变更",
      categoryColor: "bg-amber-50 text-amber-700 border-amber-200",
      summary: "招标方更正了部分技术规格要求、资质门槛或评分标准，请查阅更正附件。",
    });
  }

  // 4. 预算调整
  if (
    fullText.includes("最高限价") ||
    fullText.includes("预算金额变更") ||
    fullText.includes("预算调整")
  ) {
    highlights.push({
      category: "BUDGET_CHANGE",
      categoryLabel: "预算/限价调整",
      categoryColor: "bg-purple-50 text-purple-700 border-purple-200",
      summary: "项目最高限价或预算总额发生调整，投标报价需严格在最新限价范围内。",
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      category: "OTHER",
      categoryLabel: "答疑澄清",
      categoryColor: "bg-blue-50 text-blue-700 border-blue-200",
      summary: "发布综合答疑纪要或更正公告，请核实招标文件变更明细。",
    });
  }

  return highlights;
}

/**
 * 组装全景甘特阶段与里程碑倒计时
 */
export function buildProjectLifecycle(input: {
  currentTender: {
    id: number;
    title: string;
    type: string;
    publishDate: Date;
    content: string;
    openTime?: Date | null;
    clarifyDeadline?: Date | null;
    depositDeadline?: Date | null;
  };
  siblingNotices: Array<{
    id: number;
    title: string;
    type: string;
    publishDate: Date;
    content?: string;
  }>;
}): ProjectLifecycleOverview {
  const allNotices = [...input.siblingNotices];
  if (!allNotices.some((n) => n.id === input.currentTender.id)) {
    allNotices.push({
      id: input.currentTender.id,
      title: input.currentTender.title,
      type: input.currentTender.type,
      publishDate: input.currentTender.publishDate,
      content: input.currentTender.content,
    });
  }
  allNotices.sort((a, b) => a.publishDate.getTime() - b.publishDate.getTime());

  // 1. 抽取最新关键节点时间（优先从变更或招标中抽取）
  const datesFromCurrent = extractLifecycleDates(input.currentTender.content);
  let effectiveOpenBidTime = input.currentTender.openTime || datesFromCurrent.openBidTime;
  let effectiveClarify = input.currentTender.clarifyDeadline || datesFromCurrent.clarifyDeadline;
  let effectiveDeposit = input.currentTender.depositDeadline || datesFromCurrent.depositDeadline;

  // 2. 检查是否有更正公告推迟了开标时间
  const changes: ChangeHighlight[] = [];
  let hasPostponed = false;

  for (const n of allNotices) {
    if (n.type === "CHANGE") {
      const h = extractChangeHighlights(n.content || n.title, n.title);
      changes.push(...h);
      if (h.some((x) => x.category === "POSTPONE")) {
        hasPostponed = true;
      }
      if (n.content) {
        const revised = extractLifecycleDates(n.content);
        if (revised.openBidTime) effectiveOpenBidTime = revised.openBidTime;
        if (revised.clarifyDeadline) effectiveClarify = revised.clarifyDeadline;
        if (revised.depositDeadline) effectiveDeposit = revised.depositDeadline;
      }
    }
  }

  // 3. 计算开标倒计时
  const now = new Date();
  let countdown: ProjectLifecycleOverview["countdown"] = null;

  if (effectiveOpenBidTime) {
    const diffMs = effectiveOpenBidTime.getTime() - now.getTime();
    const isPassed = diffMs <= 0;
    const absDiffMs = Math.abs(diffMs);
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    const totalHours = Math.floor(absDiffMs / (1000 * 60 * 60));

    let badgeText = "";
    let badgeStyle = "";

    if (isPassed) {
      badgeText = `已于 ${effectiveOpenBidTime.toLocaleDateString("zh-CN")} 截止`;
      badgeStyle = "bg-slate-100 text-slate-600 border-slate-300";
    } else if (totalHours <= 48) {
      badgeText =
        totalHours < 24
          ? `🚨 截标紧急冲刺：仅剩 ${hours} 小时 ${minutes} 分`
          : `🚨 截标紧急冲刺：仅剩 ${days} 天 ${hours} 小时`;
      badgeStyle = "bg-rose-500 text-white animate-pulse shadow-xs font-bold";
    } else if (days <= 7) {
      badgeText = `⚡️ 临近截止：还剩 ${days} 天 ${hours} 小时`;
      badgeStyle = "bg-amber-100 text-amber-800 border border-amber-300 font-semibold";
    } else {
      badgeText = `距离开标还有 ${days} 天 ${hours} 小时`;
      badgeStyle = "bg-blue-50 text-blue-700 border border-blue-200 font-medium";
    }

    countdown = { isPassed, days, hours, minutes, badgeText, badgeStyle };
  }

  // 4. 组装里程碑
  const milestones: LifecycleMilestone[] = [
    {
      key: "clarify",
      label: "提疑/答疑截止",
      date: effectiveClarify,
      dateStr: effectiveClarify ? effectiveClarify.toLocaleString("zh-CN") : "详见公告",
      isPassed: Boolean(effectiveClarify && effectiveClarify.getTime() < now.getTime()),
      urgency: effectiveClarify
        ? effectiveClarify.getTime() < now.getTime()
          ? "EXPIRED"
          : effectiveClarify.getTime() - now.getTime() < 48 * 3600 * 1000
          ? "CRITICAL"
          : "NORMAL"
        : "UNKNOWN",
    },
    {
      key: "deposit",
      label: "保证金截止",
      date: effectiveDeposit,
      dateStr: effectiveDeposit ? effectiveDeposit.toLocaleString("zh-CN") : "开标前缴纳",
      isPassed: Boolean(effectiveDeposit && effectiveDeposit.getTime() < now.getTime()),
      urgency: effectiveDeposit
        ? effectiveDeposit.getTime() < now.getTime()
          ? "EXPIRED"
          : effectiveDeposit.getTime() - now.getTime() < 48 * 3600 * 1000
          ? "CRITICAL"
          : "NORMAL"
        : "UNKNOWN",
    },
    {
      key: "openBid",
      label: "开标/递交截止",
      date: effectiveOpenBidTime,
      dateStr: effectiveOpenBidTime ? effectiveOpenBidTime.toLocaleString("zh-CN") : "详见正文",
      isPassed: Boolean(effectiveOpenBidTime && effectiveOpenBidTime.getTime() < now.getTime()),
      urgency: effectiveOpenBidTime
        ? effectiveOpenBidTime.getTime() < now.getTime()
          ? "EXPIRED"
          : effectiveOpenBidTime.getTime() - now.getTime() < 48 * 3600 * 1000
          ? "CRITICAL"
          : effectiveOpenBidTime.getTime() - now.getTime() < 7 * 24 * 3600 * 1000
          ? "ATTENTION"
          : "NORMAL"
        : "UNKNOWN",
    },
  ];

  // 5. 组装 5 阶段甘特状态
  const hasIntention = allNotices.some((n) => n.type === "INTENTION");
  const hasNotice = allNotices.some((n) => n.type === "NOTICE" || n.type === "INQUIRY");
  const hasChange = allNotices.some((n) => n.type === "CHANGE");
  const hasResult = allNotices.some((n) => n.type === "RESULT");
  const isPostOpenBid = Boolean(effectiveOpenBidTime && effectiveOpenBidTime.getTime() <= now.getTime());

  let currentStage: ProjectLifecycleOverview["currentStage"] = "NOTICE";
  let currentStageName = "招标公告发布";

  if (hasResult) {
    currentStage = "RESULT";
    currentStageName = "中标结果公示";
  } else if (isPostOpenBid) {
    currentStage = "EVALUATION";
    currentStageName = "开标与专家评审";
  } else if (hasChange) {
    currentStage = "CHANGE";
    currentStageName = "答疑澄清与更正";
  } else if (hasNotice) {
    currentStage = "NOTICE";
    currentStageName = "招标中 (接受报名投标)";
  } else if (hasIntention) {
    currentStage = "INTENTION";
    currentStageName = "采购意向前瞻";
  }

  const mapNoticesToStage = (types: string[]) =>
    allNotices
      .filter((n) => types.includes(n.type))
      .map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        publishDate: n.publishDate.toISOString().slice(0, 10),
        isCurrent: n.id === input.currentTender.id,
      }));

  const stages: GanttStage[] = [
    {
      stageKey: "INTENTION",
      stageName: "采购意向",
      status: hasNotice || hasResult || isPostOpenBid ? "COMPLETED" : hasIntention ? "CURRENT" : "PENDING",
      notices: mapNoticesToStage(["INTENTION"]),
      milestoneDesc: "预算披露与预告",
    },
    {
      stageKey: "NOTICE",
      stageName: "招标公告",
      status: hasResult || isPostOpenBid ? "COMPLETED" : currentStage === "NOTICE" ? "CURRENT" : hasNotice ? "COMPLETED" : "PENDING",
      notices: mapNoticesToStage(["NOTICE", "INQUIRY"]),
      milestoneDesc: "正式发标与申领文件",
    },
    {
      stageKey: "CHANGE",
      stageName: "答疑更正",
      status: hasResult || isPostOpenBid ? (hasChange ? "COMPLETED" : "PENDING") : currentStage === "CHANGE" ? "CURRENT" : hasChange ? "COMPLETED" : "PENDING",
      notices: mapNoticesToStage(["CHANGE"]),
      milestoneDesc: hasChange ? `${changes.length} 项关键变更/答疑` : "若有澄清在此更新",
    },
    {
      stageKey: "EVALUATION",
      stageName: "开标评审",
      status: hasResult ? "COMPLETED" : currentStage === "EVALUATION" ? "CURRENT" : "PENDING",
      notices: [],
      milestoneDate: effectiveOpenBidTime ? effectiveOpenBidTime.toLocaleDateString("zh-CN") : undefined,
      milestoneDesc: "解密封标与专家打分",
    },
    {
      stageKey: "RESULT",
      stageName: "中标公示",
      status: hasResult ? "CURRENT" : "PENDING",
      notices: mapNoticesToStage(["RESULT"]),
      milestoneDesc: hasResult ? "定标与公示完成" : "等待评审结果出炉",
    },
  ];

  return {
    currentStage,
    currentStageName,
    bidOpenTime: effectiveOpenBidTime,
    bidOpenTimeStr: effectiveOpenBidTime ? effectiveOpenBidTime.toLocaleString("zh-CN") : null,
    countdown,
    milestones,
    stages,
    changes,
    hasPostponed,
  };
}
