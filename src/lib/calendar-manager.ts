export type CalendarEventType =
  | "SUBMISSION"
  | "CLARIFICATION"
  | "SITE_VISIT"
  | "DEPOSIT_DEADLINE"
  | "INTERNAL_REVIEW"
  | "QUALIFICATION_EXPIRY"
  | "REMIND"
  | "CUSTOM";

export interface EventTypeMeta {
  type: CalendarEventType;
  label: string;
  shortLabel: string;
  badgeColor: string;
  dotColor: string;
  textColor: string;
  bgLight: string;
  borderColor: string;
}

export const CALENDAR_EVENT_META: Record<CalendarEventType, EventTypeMeta> = {
  SUBMISSION: {
    type: "SUBMISSION",
    label: "递交截标 / 开标唱标",
    shortLabel: "截标开标",
    badgeColor: "bg-red-100 text-red-800 border-red-300",
    dotColor: "bg-red-500",
    textColor: "text-red-700",
    bgLight: "bg-red-50",
    borderColor: "border-red-200",
  },
  CLARIFICATION: {
    type: "CLARIFICATION",
    label: "答疑澄清 / 提出异议截止",
    shortLabel: "答疑截止",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    dotColor: "bg-amber-500",
    textColor: "text-amber-700",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  SITE_VISIT: {
    type: "SITE_VISIT",
    label: "现场踏勘 / 集中答疑",
    shortLabel: "现场踏勘",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
    dotColor: "bg-sky-500",
    textColor: "text-sky-700",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-200",
  },
  DEPOSIT_DEADLINE: {
    type: "DEPOSIT_DEADLINE",
    label: "保证金流转 / 退款截止",
    shortLabel: "保证金",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    dotColor: "bg-purple-500",
    textColor: "text-purple-700",
    bgLight: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  INTERNAL_REVIEW: {
    type: "INTERNAL_REVIEW",
    label: "内部封标评审 / 模拟述标",
    shortLabel: "封标评审",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    dotColor: "bg-emerald-500",
    textColor: "text-emerald-700",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  QUALIFICATION_EXPIRY: {
    type: "QUALIFICATION_EXPIRY",
    label: "企业资质证书到期日",
    shortLabel: "资质临期",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
    dotColor: "bg-rose-500",
    textColor: "text-rose-700",
    bgLight: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  REMIND: {
    type: "REMIND",
    label: "商机跟踪跟进备忘",
    shortLabel: "跟踪备忘",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    dotColor: "bg-slate-500",
    textColor: "text-slate-700",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  CUSTOM: {
    type: "CUSTOM",
    label: "自定义关键里程碑",
    shortLabel: "自定节点",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
    dotColor: "bg-indigo-500",
    textColor: "text-indigo-700",
    bgLight: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
};

export interface CalendarEventItem {
  id: string; // 唯一事件标识
  title: string;
  type: CalendarEventType;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  urgency: "NORMAL" | "WARNING" | "CRITICAL";
  followId?: number;
  tenderId?: number;
  tenderTitle?: string;
  purchaser?: string;
  assignee?: string;
  status: "PENDING" | "COMPLETED";
  isMilestoneRecord?: boolean;
  milestoneId?: number;
  notes?: string;
}

export interface CalendarConflict {
  date: string;
  level: "CRITICAL" | "WARNING";
  description: string;
  events: CalendarEventItem[];
  suggestion: string;
}

export interface CalendarMonthData {
  year: number;
  month: number; // 1-12
  events: CalendarEventItem[];
  conflicts: CalendarConflict[];
  totalPendingCount: number;
  criticalEventsCount: number;
}

/**
 * 检测排期冲突（同一天内存在 ≥2 个开标，或者同时有现场踏勘与截标）
 */
export function detectCalendarConflicts(events: CalendarEventItem[]): CalendarConflict[] {
  const dateMap: Record<string, CalendarEventItem[]> = {};

  for (const ev of events) {
    if (ev.status === "COMPLETED") continue;
    if (!dateMap[ev.date]) {
      dateMap[ev.date] = [];
    }
    dateMap[ev.date].push(ev);
  }

  const conflicts: CalendarConflict[] = [];

  for (const [date, dayEvents] of Object.entries(dateMap)) {
    const submissions = dayEvents.filter((e) => e.type === "SUBMISSION");
    const siteVisits = dayEvents.filter((e) => e.type === "SITE_VISIT");

    // 1. 同一天有 2 个及以上开标截标事件 (严重冲突)
    if (submissions.length >= 2) {
      conflicts.push({
        date,
        level: "CRITICAL",
        description: `同一日存在 ${submissions.length} 个标段截标开标，排期冲突风险极高`,
        events: submissions,
        suggestion:
          "请立即协调配置主备述标授权人、独立 CA 数字证书及保证金凭单，避免现场开标人员与设备撞车。",
      });
    } else if (submissions.length === 1 && siteVisits.length >= 1) {
      // 2. 开标日同时有现场踏勘
      conflicts.push({
        date,
        level: "WARNING",
        description: `同日存在开标唱标与现场踏勘任务，人员精力分散`,
        events: [...submissions, ...siteVisits],
        suggestion:
          "建议安排两人分别统筹开标解密与踏勘答疑，并提前完成标书电子签章封标。",
      });
    }
  }

  return conflicts.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 格式化 ISO 日期为 YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 生成符合 RFC 5545 标准的 iCalendar (.ics) 字符串
 */
export function generateICalendarString(
  events: CalendarEventItem[],
  calendarName = "标讯通-企业投标日程"
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ToubiaoTong//Bidding Calendar//CN",
    `X-WR-CALNAME:${calendarName}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const nowStr = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  for (const ev of events) {
    const [year, month, day] = ev.date.split("-").map(Number);
    if (!year || !month || !day) continue;

    const dateStr = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
    const dtStart = `VALUE=DATE:${dateStr}`;
    const dtEnd = `VALUE=DATE:${dateStr}`;

    const summary = `【${CALENDAR_EVENT_META[ev.type]?.shortLabel || "待办"}】${ev.title}`;
    const descParts = [
      `类型: ${CALENDAR_EVENT_META[ev.type]?.label}`,
      ev.tenderTitle ? `项目: ${ev.tenderTitle}` : "",
      ev.purchaser ? `采购人: ${ev.purchaser}` : "",
      ev.assignee ? `责任人: ${ev.assignee}` : "",
      ev.notes ? `说明: ${ev.notes}` : "",
    ].filter(Boolean);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:tb-${ev.id}@toubiao.com`);
    lines.push(`DTSTAMP:${nowStr}`);
    lines.push(`DTSTART;${dtStart}`);
    lines.push(`DTEND;${dtEnd}`);
    lines.push(`SUMMARY:${summary.replace(/\n/g, " ")}`);
    lines.push(`DESCRIPTION:${descParts.join("\\n")}`);
    lines.push(`STATUS:${ev.status === "COMPLETED" ? "COMPLETED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * 一键生成《投标推进与日程排期工作周报》(Markdown公文)
 */
export function generateScheduleWeeklyReportMarkdown(
  events: CalendarEventItem[],
  conflicts: CalendarConflict[],
  startDateStr: string,
  endDateStr: string
): string {
  const criticalEvents = events.filter((e) => e.urgency === "CRITICAL" || e.type === "SUBMISSION");

  return `# 企业投标推进与关键日程排期工作周报

**排期范围**: ${startDateStr} 至 ${endDateStr}  
**生成时间**: ${new Date().toLocaleString("zh-CN")}  
**待办总数**: ${events.length} 项（含开标截标 ${criticalEvents.length} 项）  
**撞车预警**: ${conflicts.length > 0 ? `🚨 发现 ${conflicts.length} 处排期冲突风险` : "✅ 无撞车冲突，节奏平稳"}  

---

## 一、排期冲突与关键预警提示

${
  conflicts.length > 0
    ? conflicts
        .map(
          (c, idx) => `### ${idx + 1}. 【${c.date}】${c.description} (${c.level === "CRITICAL" ? "🔴 严重冲突" : "🟡 关注预警"})
> **防范对策**: ${c.suggestion}
- 涉及项目：${c.events.map((e) => `**${e.title}**（${e.assignee ? `@${e.assignee}` : "待指派"}）`).join("、")}`
        )
        .join("\n\n")
    : "本项目周期内未检测到同日双标开标或现场踏勘冲突，各项工作可按节奏常规推进。"
}

---

## 二、截标与开标唱标关键节点 (重中之重)

| 开标日期 | 项目名称 | 采购单位 | 责任人 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
${
  criticalEvents.length > 0
    ? criticalEvents
        .map(
          (e) =>
            `| **${e.date}** | ${e.tenderTitle || e.title} | ${e.purchaser || "-"} | ${e.assignee ? `@${e.assignee}` : "项目组"} | ${e.status === "COMPLETED" ? "✅ 已完成" : "⏳ 待执行"} |`
        )
        .join("\n")
    : "| - | 本周期内无开标事项 | - | - | - |"
}

---

## 三、其他关键里程碑与协同待办一览

| 日期 | 类别 | 节点主题 | 关联项目 / 说明 | 责任人 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
${events
  .filter((e) => e.type !== "SUBMISSION")
  .map(
    (e) =>
      `| ${e.date} | ${CALENDAR_EVENT_META[e.type]?.shortLabel} | ${e.title} | ${e.notes || e.tenderTitle || "-"} | ${e.assignee ? `@${e.assignee}` : "-"} | ${e.status === "COMPLETED" ? "✅" : "⏳"} |`
  )
  .join("\n")}

---

*报告生成：标讯通企业级智能决策罗盘 · 协同日历排期中心*
`;
}
