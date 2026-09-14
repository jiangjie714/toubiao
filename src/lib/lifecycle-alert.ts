export type DeadlineUrgency = "OVERDUE" | "CRITICAL" | "WARNING" | "NORMAL";

export interface DeadlineCountdown {
  targetDate: Date;
  diffHours: number;
  diffDays: number;
  urgency: DeadlineUrgency;
  badgeLabel: string;
  badgeColor: string;
  isDeadlinePassed: boolean;
}

export interface LifecycleUpdateAlert {
  hasUpdate: boolean;
  updateType?: "CHANGE" | "RESULT" | "CONVERTED_NOTICE" | "OTHER";
  updateLabel?: string;
  updateBadgeColor?: string;
  latestNoticeId?: number;
  latestNoticeTitle?: string;
  latestNoticeDate?: string;
  allProjectNoticesCount?: number;
}

export interface TrackerAlertSummary {
  criticalDeadlinesCount: number; // <= 48h
  warningDeadlinesCount: number; // <= 7d
  newClarificationsCount: number; // CHANGE
  convertedIntentionsCount: number; // INTENTION -> NOTICE
  newResultsCount: number; // RESULT
}

/**
 * 计算投标截止时间或自定义提醒时间的倒计时状态
 */
export function calculateDeadlineCountdown(
  expireDate?: Date | string | null,
  remindDate?: Date | string | null,
  now: Date = new Date()
): DeadlineCountdown | null {
  // 优先取用户的自定义投标提醒时间，否则取官方标讯 expireDate
  const rawTarget = remindDate ?? expireDate;
  if (!rawTarget) return null;

  const target = typeof rawTarget === "string" ? new Date(rawTarget) : rawTarget;
  if (isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return {
      targetDate: target,
      diffHours: 0,
      diffDays: 0,
      urgency: "OVERDUE",
      badgeLabel: "已截止截标",
      badgeColor: "bg-slate-100 text-slate-500 border-slate-200",
      isDeadlinePassed: true,
    };
  }

  // 48 小时内紧急倒计时
  if (diffHours <= 48) {
    const hoursText = diffHours <= 1 ? "1小时内" : `${diffHours}小时`;
    return {
      targetDate: target,
      diffHours,
      diffDays,
      urgency: "CRITICAL",
      badgeLabel: `🚨 截标冲刺: 剩${hoursText}`,
      badgeColor: "bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200 animate-pulse",
      isDeadlinePassed: false,
    };
  }

  // 7 天内临期预警
  if (diffDays <= 7) {
    return {
      targetDate: target,
      diffHours,
      diffDays,
      urgency: "WARNING",
      badgeLabel: `⏳ 临期预警: 剩${diffDays}天`,
      badgeColor: "bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200",
      isDeadlinePassed: false,
    };
  }

  // 正常推进
  return {
    targetDate: target,
    diffHours,
    diffDays,
    urgency: "NORMAL",
    badgeLabel: `截止递交: 剩${diffDays}天`,
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    isDeadlinePassed: false,
  };
}

/**
 * 识别项目全生命周期后续公告（更正答疑、开标结果、意向转正式招标）
 */
export function detectProjectLifecycleUpdates(
  currentTender: {
    id: number;
    type: string;
    publishDate: Date | string;
  },
  projectNotices?: Array<{
    id: number;
    title: string;
    type: string;
    publishDate: Date | string;
  }> | null
): LifecycleUpdateAlert {
  if (!projectNotices || projectNotices.length <= 1) {
    return { hasUpdate: false, allProjectNoticesCount: projectNotices?.length || 1 };
  }

  const currentPubDate =
    typeof currentTender.publishDate === "string"
      ? new Date(currentTender.publishDate)
      : currentTender.publishDate;

  // 过滤出该项目中其他公告（优先排查晚于当前公告发布时间的后续事件）
  const otherNotices = projectNotices
    .filter((n) => n.id !== currentTender.id)
    .sort((a, b) => {
      const dateA = new Date(a.publishDate).getTime();
      const dateB = new Date(b.publishDate).getTime();
      return dateB - dateA;
    });

  if (otherNotices.length === 0) {
    return { hasUpdate: false, allProjectNoticesCount: projectNotices.length };
  }

  // 1. 若当前标讯是采购意向 (INTENTION)，检测是否有转正正式招标公告 (NOTICE)
  if (currentTender.type === "INTENTION") {
    const notice = otherNotices.find((n) => n.type === "NOTICE" || n.type === "INQUIRY");
    if (notice) {
      const pubStr = new Date(notice.publishDate).toISOString().slice(5, 10);
      return {
        hasUpdate: true,
        updateType: "CONVERTED_NOTICE",
        updateLabel: `⚡ 意向已启动招标 (${pubStr})`,
        updateBadgeColor: "bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200",
        latestNoticeId: notice.id,
        latestNoticeTitle: notice.title,
        latestNoticeDate: pubStr,
        allProjectNoticesCount: projectNotices.length,
      };
    }
  }

  // 2. 检查是否有在当前公告之后发布的更正/澄清答疑公告 (CHANGE)
  const changeNotice = otherNotices.find((n) => {
    const pub = new Date(n.publishDate);
    return n.type === "CHANGE" && pub >= currentPubDate;
  });

  if (changeNotice) {
    const pubStr = new Date(changeNotice.publishDate).toISOString().slice(5, 10);
    return {
      hasUpdate: true,
      updateType: "CHANGE",
      updateLabel: `🚨 最新更正澄清 (${pubStr})`,
      updateBadgeColor: "bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200",
      latestNoticeId: changeNotice.id,
      latestNoticeTitle: changeNotice.title,
      latestNoticeDate: pubStr,
      allProjectNoticesCount: projectNotices.length,
    };
  }

  // 3. 检查是否有中标结果公示 (RESULT)
  const resultNotice = otherNotices.find((n) => n.type === "RESULT");
  if (resultNotice) {
    const pubStr = new Date(resultNotice.publishDate).toISOString().slice(5, 10);
    return {
      hasUpdate: true,
      updateType: "RESULT",
      updateLabel: `🟢 已出中标结果 (${pubStr})`,
      updateBadgeColor: "bg-emerald-50 text-emerald-700 border-emerald-300",
      latestNoticeId: resultNotice.id,
      latestNoticeTitle: resultNotice.title,
      latestNoticeDate: pubStr,
      allProjectNoticesCount: projectNotices.length,
    };
  }

  // 4. 其他类型后续更新
  const latestOther = otherNotices[0];
  const latestDate = new Date(latestOther.publishDate);
  if (latestDate >= currentPubDate) {
    const pubStr = latestDate.toISOString().slice(5, 10);
    return {
      hasUpdate: true,
      updateType: "OTHER",
      updateLabel: `📢 同项目新公告 (${pubStr})`,
      updateBadgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      latestNoticeId: latestOther.id,
      latestNoticeTitle: latestOther.title,
      latestNoticeDate: pubStr,
      allProjectNoticesCount: projectNotices.length,
    };
  }

  return {
    hasUpdate: false,
    allProjectNoticesCount: projectNotices.length,
  };
}
