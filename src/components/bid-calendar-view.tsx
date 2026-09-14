"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarIcon,
  ClockIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ClipboardIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
} from "@/components/icons";
import {
  getCalendarEventsAction,
  saveBidMilestoneAction,
  toggleMilestoneStatusAction,
  deleteBidMilestoneAction,
  exportCalendarIcsAction,
  exportCalendarWeeklyReportAction,
  type SaveMilestoneInput,
} from "@/app/actions/calendar";
import {
  CALENDAR_EVENT_META,
  type CalendarEventItem,
  type CalendarEventType,
  type CalendarMonthData,
} from "@/lib/calendar-manager";

interface Props {
  initialData: CalendarMonthData;
  initialTeamMembers: Array<{ username: string; name: string }>;
  hasTeam: boolean;
  followsList: Array<{ id: number; title: string }>;
}

export default function BidCalendarView({
  initialData,
  initialTeamMembers,
  hasTeam,
  followsList,
}: Props) {
  const [data, setData] = useState<CalendarMonthData>(initialData);
  const [teamMembers] = useState(initialTeamMembers);
  const [year, setYear] = useState(initialData.year);
  const [month, setMonth] = useState(initialData.month);
  const [viewType, setViewType] = useState<"month" | "agenda">("month");
  const [mode, setMode] = useState<"personal" | "team">(hasTeam ? "team" : "personal");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);

  // 选中的日期
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 新增/编辑里程碑弹窗
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<SaveMilestoneInput | null>(null);
  const [formFollowId, setFormFollowId] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<string>("INTERNAL_REVIEW");
  const [formDate, setFormDate] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [modalError, setModalError] = useState("");

  // 周报预览与复制
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [copiedReport, setCopiedReport] = useState(false);

  const [, startTransition] = useTransition();

  const reloadData = async (
    targetYear = year,
    targetMonth = month,
    targetMode = mode,
    targetType = typeFilter,
    targetAssignee = assigneeFilter
  ) => {
    setLoading(true);
    const res = await getCalendarEventsAction({
      year: targetYear,
      month: targetMonth,
      mode: targetMode,
      typeFilter: targetType,
      assigneeFilter: targetAssignee,
    });
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  const handlePrevMonth = () => {
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setYear(newYear);
    setMonth(newMonth);
    startTransition(() => {
      reloadData(newYear, newMonth, mode, typeFilter, assigneeFilter);
    });
  };

  const handleNextMonth = () => {
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setYear(newYear);
    setMonth(newMonth);
    startTransition(() => {
      reloadData(newYear, newMonth, mode, typeFilter, assigneeFilter);
    });
  };

  const handleToday = () => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    setYear(curY);
    setMonth(curM);
    startTransition(() => {
      reloadData(curY, curM, mode, typeFilter, assigneeFilter);
    });
  };

  const handleModeChange = (newMode: "personal" | "team") => {
    setMode(newMode);
    startTransition(() => {
      reloadData(year, month, newMode, typeFilter, assigneeFilter);
    });
  };

  const handleTypeChange = (newType: string) => {
    setTypeFilter(newType);
    startTransition(() => {
      reloadData(year, month, mode, newType, assigneeFilter);
    });
  };

  const handleAssigneeChange = (newAssignee: string) => {
    setAssigneeFilter(newAssignee);
    startTransition(() => {
      reloadData(year, month, mode, typeFilter, newAssignee);
    });
  };

  const handleToggleStatus = async (item: CalendarEventItem) => {
    if (!item.isMilestoneRecord || !item.milestoneId) return;
    const nextStatus = item.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    await toggleMilestoneStatusAction(item.milestoneId, nextStatus);
    reloadData();
  };

  const handleDeleteMilestone = async (milestoneId: number) => {
    if (!confirm("确定要删除该里程碑节点吗？")) return;
    await deleteBidMilestoneAction(milestoneId);
    reloadData();
  };

  const handleExportIcs = async () => {
    const res = await exportCalendarIcsAction({ year, month, mode });
    if (res.success && res.icsContent) {
      const blob = new Blob([res.icsContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `投标排期日历_${year}年${month}月.ics`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenReportModal = async () => {
    setIsReportModalOpen(true);
    setReportMarkdown("");
    const res = await exportCalendarWeeklyReportAction({ year, month, mode });
    if (res.success && res.markdown) {
      setReportMarkdown(res.markdown);
    }
  };

  const handleOpenAddModal = (defaultDate?: string) => {
    setEditingMilestone(null);
    setFormFollowId("");
    setFormTitle("");
    setFormType("INTERNAL_REVIEW");
    setFormDate(defaultDate || new Date().toISOString().slice(0, 10));
    setFormAssignee("");
    setFormNotes("");
    setModalError("");
    setIsAddModalOpen(true);
  };

  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMilestone(true);
    setModalError("");

    const res = await saveBidMilestoneAction({
      id: editingMilestone?.id,
      followId: formFollowId ? parseInt(formFollowId, 10) : undefined,
      title: formTitle,
      type: formType,
      targetDate: formDate,
      assignee: formAssignee || undefined,
      notes: formNotes || undefined,
    });

    setSavingMilestone(false);
    if (!res.success) {
      setModalError(res.error || "保存失败");
    } else {
      setIsAddModalOpen(false);
      reloadData();
    }
  };

  // 生成月历天数矩阵 (42格或35格)
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0(周日)-6(周六)
  // 我们采用周一作为第一天 (0:一, 1:二, ..., 6:日)
  const offset = (startingDayOfWeek + 6) % 7;
  const daysInCurrentMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const calendarDays: Array<{
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CalendarEventItem[];
    hasConflict: boolean;
  }> = [];

  const todayStr = new Date().toISOString().slice(0, 10);

  // 上月填充
  for (let i = offset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = data.events.filter((e) => e.date === dateStr);
    const hasConflict = data.conflicts.some((c) => c.date === dateStr);
    calendarDays.push({
      dateStr,
      dayNum: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: dayEvents,
      hasConflict,
    });
  }

  // 当月填充
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const dayEvents = data.events.filter((e) => e.date === dateStr);
    const hasConflict = data.conflicts.some((c) => c.date === dateStr);
    calendarDays.push({
      dateStr,
      dayNum: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      events: dayEvents,
      hasConflict,
    });
  }

  // 下月填充至 35 或 42
  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const dateStr = `${nextY}-${String(nextM).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const dayEvents = data.events.filter((e) => e.date === dateStr);
    const hasConflict = data.conflicts.some((c) => c.date === dateStr);
    calendarDays.push({
      dateStr,
      dayNum: i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: dayEvents,
      hasConflict,
    });
  }

  const selectedDateEvents = selectedDate
    ? data.events.filter((e) => e.date === selectedDate)
    : [];

  return (
    <div className="space-y-6">
      {/* 顶部标题与协同切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="size-6 text-primary" />
              企业招投标协同日历与排期大盘
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              M2 协同中心
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            全景聚合截标开标倒计时、答疑澄清、现场踏勘、保证金流转与内部封标节点，实时排查多标开标冲突。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasTeam && (
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleModeChange("team")}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === "team"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                企业团队日程
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("personal")}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === "personal"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                我的待办排期
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleExportIcs}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
            title="导出 .ics 日历文件，可直接同步至手机/飞书/钉钉日历"
          >
            <ArrowDownTrayIcon className="size-3.5 text-primary" />
            <span>导出手机日历 (.ics)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenReportModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <DocumentTextIcon className="size-3.5 text-primary" />
            <span>排期周报公文</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition"
          >
            <PlusIcon className="size-3.5" />
            <span>新增关键节点</span>
          </button>
        </div>
      </div>

      {/* 排期冲突警告横幅 (如果存在冲突) */}
      {data.conflicts.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-200/60">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <AlertCircleIcon className="size-5 text-rose-600 shrink-0" />
              <span>检测到 {data.conflicts.length} 处排期冲突风险 (开标撞车 / 现场冲突)</span>
            </div>
            <span className="text-xs text-rose-700 font-medium">请关注协同资源配置</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.conflicts.map((c, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-rose-200 bg-white p-3 text-xs space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-500" />
                    【{c.date}】{c.description}
                  </span>
                  <span className="rounded-md bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[10px] font-bold">
                    {c.level === "CRITICAL" ? "🔴 严重冲突" : "🟡 注意"}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">{c.suggestion}</p>
                <div className="pt-1 text-[11px] text-slate-500 flex flex-wrap gap-1">
                  {c.events.map((e) => (
                    <span
                      key={e.id}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 font-medium"
                    >
                      {e.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日历导航工具栏与视图切换 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 年月控制器 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 transition"
              title="上一月"
            >
              ◀
            </button>
            <span className="text-base font-bold text-slate-900 px-2 min-w-[120px] text-center tnum">
              {year} 年 {month} 月
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 transition"
              title="下一月"
            >
              ▶
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            回到今天
          </button>

          <span className="text-xs text-slate-400 hidden sm:inline">
            共 {data.events.length} 个日程事项（待完成 {data.totalPendingCount} 项）
          </span>
        </div>

        {/* 筛选与视图切换 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 事件类别筛选 */}
          <div className="relative inline-block">
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
            >
              <option value="ALL">全部日程类别</option>
              {(Object.keys(CALENDAR_EVENT_META) as CalendarEventType[]).map((t) => (
                <option key={t} value={t}>
                  {CALENDAR_EVENT_META[t].shortLabel} ({CALENDAR_EVENT_META[t].label})
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-2.5 size-3 text-slate-400" />
          </div>

          {/* 责任人筛选 */}
          {teamMembers.length > 0 && (
            <div className="relative inline-block">
              <select
                value={assigneeFilter}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
              >
                <option value="ALL">全部成员排期</option>
                {teamMembers.map((m) => (
                  <option key={m.username} value={m.username}>
                    {m.name || m.username}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-2.5 size-3 text-slate-400" />
            </div>
          )}

          {/* 月历 vs 流水切换 */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewType("month")}
              className={`rounded-md px-3 py-1 transition ${
                viewType === "month"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              月历大盘
            </button>
            <button
              type="button"
              onClick={() => setViewType("agenda")}
              className={`rounded-md px-3 py-1 transition ${
                viewType === "agenda"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              排期清单
            </button>
          </div>
        </div>
      </div>

      {/* 主视图区 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3 rounded-2xl border border-slate-200 bg-white">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs">加载日历排期中...</p>
        </div>
      ) : viewType === "month" ? (
        /* 月历网格视图 */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* 星期头部 */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-600 py-2.5">
            <div>周一</div>
            <div>周二</div>
            <div>周三</div>
            <div>周四</div>
            <div>周五</div>
            <div className="text-rose-600">周六</div>
            <div className="text-rose-600">周日</div>
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-100">
            {calendarDays.map((cell, idx) => {
              const isSelected = selectedDate === cell.dateStr;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`min-h-[110px] p-1.5 transition cursor-pointer flex flex-col justify-between ${
                    cell.isCurrentMonth ? "bg-white" : "bg-slate-50/60 text-slate-300"
                  } ${cell.isToday ? "ring-2 ring-inset ring-primary/40" : ""} ${
                    isSelected ? "bg-blue-50/30 ring-2 ring-primary" : "hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold tnum ${
                        cell.isToday
                          ? "bg-primary text-white"
                          : cell.isCurrentMonth
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {cell.hasConflict && (
                      <span
                        className="inline-block size-2 rounded-full bg-rose-500 animate-ping"
                        title="该日存在排期撞车风险！"
                      />
                    )}
                  </div>

                  {/* 事件胶囊列表 */}
                  <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                    {cell.events.slice(0, 3).map((ev) => {
                      const meta = CALENDAR_EVENT_META[ev.type] || CALENDAR_EVENT_META.CUSTOM;
                      const isCompleted = ev.status === "COMPLETED";
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(ev.date);
                          }}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate flex items-center gap-1 transition ${
                            isCompleted
                              ? "bg-slate-100 text-slate-400 line-through"
                              : `${meta.bgLight} ${meta.textColor} border ${meta.borderColor}`
                          }`}
                          title={`${meta.shortLabel}: ${ev.title}`}
                        >
                          <span className={`inline-block size-1.5 rounded-full shrink-0 ${meta.dotColor}`} />
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}

                    {cell.events.length > 3 && (
                      <span className="text-[10px] font-semibold text-slate-400 block text-right">
                        +{cell.events.length - 3} 项
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 排期清单视图 (Agenda View) */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden divide-y divide-slate-100">
          {data.events.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              该时间范围内暂无日程排期事项。
            </div>
          ) : (
            data.events.map((ev) => {
              const meta = CALENDAR_EVENT_META[ev.type] || CALENDAR_EVENT_META.CUSTOM;
              const isCompleted = ev.status === "COMPLETED";

              return (
                <div
                  key={ev.id}
                  className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 flex-1">
                    {/* 完成勾选 (仅支持自定义里程碑) */}
                    {ev.isMilestoneRecord ? (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(ev)}
                        className={`mt-0.5 size-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                          isCompleted
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 bg-white hover:border-slate-400 text-transparent"
                        }`}
                        title={isCompleted ? "标为未完成" : "标为已完成"}
                      >
                        <CheckIcon className="size-3.5 stroke-2" />
                      </button>
                    ) : (
                      <span
                        className={`mt-0.5 inline-block size-2 rounded-full shrink-0 ${meta.dotColor}`}
                      />
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${meta.badgeColor}`}
                        >
                          {meta.shortLabel}
                        </span>

                        <span className="text-xs font-mono font-bold text-slate-700">
                          {ev.date} {ev.time || ""}
                        </span>

                        {ev.assignee && (
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            @{ev.assignee}
                          </span>
                        )}

                        {isCompleted && (
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            (已完成)
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-sm font-bold text-slate-900 ${
                          isCompleted ? "line-through text-slate-400" : ""
                        }`}
                      >
                        {ev.title}
                      </h4>

                      {ev.tenderTitle && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          关联项目: {ev.tenderTitle} {ev.purchaser ? `(${ev.purchaser})` : ""}
                        </p>
                      )}

                      {ev.notes && (
                        <p className="text-[11px] text-slate-400">{ev.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {ev.tenderId && (
                      <Link
                        href={`/tender/${ev.tenderId}`}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        查看标讯 →
                      </Link>
                    )}

                    {ev.isMilestoneRecord && ev.milestoneId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMilestone(ev.milestoneId!)}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="删除该里程碑"
                      >
                        <XMarkIcon className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 底部浮动当日面板 (点击日历格子后展示) */}
      {selectedDate && (
        <div className="rounded-2xl border border-primary/30 bg-blue-50/30 p-5 shadow-xs animate-in fade-in">
          <div className="flex items-center justify-between border-b border-primary/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="size-5 text-primary" />
              <h3 className="text-sm font-bold text-slate-900">
                【{selectedDate}】当日待办与关键日程 ({selectedDateEvents.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenAddModal(selectedDate)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-xs"
              >
                <PlusIcon className="size-3" />
                <span>在此日添加节点</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 transition"
              >
                <XMarkIcon className="size-4" />
              </button>
            </div>
          </div>

          {selectedDateEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">该日无安排事项，团队可专注方案编写与业务拓展。</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedDateEvents.map((ev) => {
                const meta = CALENDAR_EVENT_META[ev.type] || CALENDAR_EVENT_META.CUSTOM;
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${meta.badgeColor}`}>
                        {meta.shortLabel}
                      </span>
                      {ev.assignee && (
                        <span className="text-[10px] text-slate-500">@{ev.assignee}</span>
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 leading-snug">{ev.title}</h5>
                    {ev.tenderTitle && (
                      <p className="text-[11px] text-slate-500 truncate">{ev.tenderTitle}</p>
                    )}
                    {ev.notes && (
                      <p className="text-[10px] text-slate-400 line-clamp-2">{ev.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 新增/编辑自定义里程碑 Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PlusIcon className="size-4 text-primary" />
                新增投标关键里程碑
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMilestone} className="space-y-4 text-xs">
              {/* 关联项目 */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  关联跟进项目 (选填)
                </label>
                <select
                  value={formFollowId}
                  onChange={(e) => setFormFollowId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-primary focus:outline-hidden"
                >
                  <option value="">不关联特定项目 (公司级排期)</option>
                  {followsList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 标题 */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  里程碑标题 / 节点主题 *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="例如: 智慧应急项目内部封标模拟评审、现场踏勘答疑"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-primary focus:outline-hidden"
                />
              </div>

              {/* 类别与时间 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    事项类型
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-primary focus:outline-hidden"
                  >
                    <option value="INTERNAL_REVIEW">内部封标评审</option>
                    <option value="SITE_VISIT">现场踏勘答疑</option>
                    <option value="CLARIFICATION">答疑提出截止</option>
                    <option value="SUBMISSION">截标开标唱标</option>
                    <option value="DEPOSIT_PAY">保证金到账核验</option>
                    <option value="OTHER">其他关键备忘</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    发生/截止日期 *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 责任人 */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  指定责任人
                </label>
                <input
                  type="text"
                  value={formAssignee}
                  onChange={(e) => setFormAssignee(e.target.value)}
                  placeholder="例如: 张工 / 商务部 / 解决方案组"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-primary focus:outline-hidden"
                />
              </div>

              {/* 备注说明 */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  关键要求与备忘说明
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="例如: 提前准备双人背对背核验清单、协调法人授权委托书与CA锁..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-primary focus:outline-hidden"
                />
              </div>

              {modalError && <p className="text-rose-600 text-xs">{modalError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={savingMilestone}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {savingMilestone ? "保存中..." : "保存节点"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 周报公文 Modal */}
      {isReportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setIsReportModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  《企业投标推进与日程排期工作周报》
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  公文级 Markdown 格式，含排期冲突防范与开标唱标重点清单
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(reportMarkdown);
                    setCopiedReport(true);
                    setTimeout(() => setCopiedReport(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <ClipboardIcon className="size-3.5" />
                  <span>{copiedReport ? "已复制" : "复制报告"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
                >
                  <XMarkIcon className="size-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {reportMarkdown || "正在生成周报..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
