"use client";

import React, { useState } from "react";
import Link from "next/link";
import { type ProjectLifecycleOverview } from "@/lib/tender-lifecycle";
import {
  ClockIcon,
  CheckCircleIcon,
  CalendarIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  ShieldAlertIcon,
  ArrowDownTrayIcon,
} from "@/components/icons";

interface Props {
  lifecycle: ProjectLifecycleOverview;
  projectNo?: string | null;
  projectName: string;
  projectId?: number | null;
}

export default function ProjectGanttView({
  lifecycle,
  projectNo,
  projectName,
  projectId,
}: Props) {
  const [selectedStageKey, setSelectedStageKey] = useState<string>(
    lifecycle.currentStage || "NOTICE",
  );

  // 导出标准 iCalendar (.ics) 日历提醒
  const handleExportIcs = () => {
    if (!lifecycle.bidOpenTime) {
      alert("该项目尚未解析到明确的开标/递交时间，请参考正文或手动添加提醒。");
      return;
    }

    const start = new Date(lifecycle.bidOpenTime);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 默认 2 小时

    const formatDateForIcs = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//标讯通//招投标日程中心//CN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:toubiao-bid-${Date.now()}@biaoxuntong.cn`,
      `DTSTAMP:${formatDateForIcs(new Date())}`,
      `DTSTART:${formatDateForIcs(start)}`,
      `DTEND:${formatDateForIcs(end)}`,
      `SUMMARY:【标讯通投标截止提醒】${projectName.slice(0, 40)}`,
      `DESCRIPTION:项目名称：${projectName}\\n项目编号：${projectNo || "详见平台"}\\n开标截止时间：${lifecycle.bidOpenTimeStr || ""}\\n提醒来源：标讯通大数据服务平台`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-PT24H",
      "ACTION:DISPLAY",
      "DESCRIPTION:投标倒计时24小时预警",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `投标提醒_${(projectNo || projectName).slice(0, 15)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const selectedStage =
    lifecycle.stages.find((s) => s.stageKey === selectedStageKey) ||
    lifecycle.stages[0];

  return (
    <section
      aria-label="项目全生命周期与甘特进度总线"
      className="overflow-hidden rounded-xl border border-blue-200/80 bg-linear-to-b from-blue-50/40 via-white to-slate-50/30 p-5 shadow-xs transition-all hover:shadow-sm"
    >
      {/* 1. 顶部控制栏与阶段徽章 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-blue-100/70 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
              <ClockIcon className="h-4 w-4" />
              <span>全生命周期总线</span>
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-primary">
              {lifecycle.currentStageName}
            </span>
            {lifecycle.hasPostponed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                <ShieldAlertIcon className="h-3.5 w-3.5" />
                <span>开标已顺延</span>
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {projectNo ? (
              <span>项目编号：<strong className="text-slate-800 font-mono">{projectNo}</strong></span>
            ) : (
              <span>追踪多阶段公告聚合关联</span>
            )}
          </div>
        </div>

        {/* 倒计时与日历导出 */}
        <div className="flex flex-wrap items-center gap-2">
          {lifecycle.countdown && (
            <div
              className={`rounded-lg px-3 py-1.5 text-xs tnum ${lifecycle.countdown.badgeStyle}`}
            >
              {lifecycle.countdown.badgeText}
            </div>
          )}

          {lifecycle.bidOpenTime && (
            <button
              onClick={handleExportIcs}
              type="button"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary shadow-2xs"
              title="下载 .ics 日历文件，同步至 iPhone/Mac/Outlook 投标日程"
            >
              <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
              <span>存入手机日历</span>
              <ArrowDownTrayIcon className="h-3 w-3 text-slate-400" />
            </button>
          )}

          {projectId && (
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-strong shadow-2xs"
            >
              <span>360° 项目全景</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* 2. 5 阶段可视化甘特流 (Gantt Stages Stream) */}
      <div className="mt-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {lifecycle.stages.map((stage, idx) => {
            const isSelected = stage.stageKey === selectedStageKey;
            const isCompleted = stage.status === "COMPLETED";
            const isCurrent = stage.status === "CURRENT";

            return (
              <button
                key={stage.stageKey}
                type="button"
                onClick={() => setSelectedStageKey(stage.stageKey)}
                className={`group cursor-pointer relative flex flex-col rounded-xl p-3 text-left transition-all ${
                  isSelected
                    ? "bg-white ring-2 ring-primary shadow-sm"
                    : isCurrent
                    ? "bg-blue-50/70 border border-blue-300"
                    : isCompleted
                    ? "bg-slate-50/60 border border-slate-200/80 hover:bg-white"
                    : "bg-slate-50/40 border border-dashed border-slate-200 opacity-70 hover:opacity-100"
                }`}
              >
                {/* 状态徽标与步骤号 */}
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCompleted
                        ? "bg-emerald-100 text-emerald-700"
                        : isCurrent
                        ? "bg-primary text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {isCompleted ? <CheckCircleIcon className="h-3.5 w-3.5" /> : idx + 1}
                  </span>

                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                      isCompleted
                        ? "text-emerald-700 bg-emerald-50"
                        : isCurrent
                        ? "text-primary font-bold bg-blue-100"
                        : "text-slate-400"
                    }`}
                  >
                    {isCompleted ? "已完成" : isCurrent ? "进行中" : "未启动"}
                  </span>
                </div>

                <div className="mt-2 text-xs font-bold text-slate-900 group-hover:text-primary transition">
                  {stage.stageName}
                </div>

                <div className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                  {stage.milestoneDesc || "阶段跟进中"}
                </div>

                {stage.notices.length > 0 && (
                  <div className="mt-1 text-[10px] text-blue-600 font-semibold">
                    {stage.notices.length} 条关联公告 →
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 选中阶段明细卡片与关联公告 */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              【{selectedStage.stageName}】阶段关联标讯
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
              共 {selectedStage.notices.length} 条
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            点击公告条目可直接穿透查看详情
          </span>
        </div>

        {selectedStage.notices.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            该阶段暂无独立公告发布，可能仍在评审推进或合并于主招标文件中。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {selectedStage.notices.map((n) => (
              <div
                key={n.id}
                className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80 px-2 rounded-lg transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                      {n.type}
                    </span>
                    <Link
                      href={`/tender/${n.id}`}
                      className={`text-xs hover:underline truncate ${
                        n.isCurrent
                          ? "font-bold text-primary"
                          : "text-slate-800 hover:text-primary"
                      }`}
                    >
                      {n.title}
                    </Link>
                    {n.isCurrent && (
                      <span className="rounded bg-blue-600 text-white text-[10px] px-1.5 py-0.2 font-bold">
                        当前公告
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400 tnum">
                  <span>发布时间：{n.publishDate}</span>
                  {!n.isCurrent && (
                    <Link
                      href={`/tender/${n.id}`}
                      className="text-primary hover:underline text-xs font-medium"
                    >
                      查看 →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 关键里程碑时间矩阵 (3 大关键时间节点卡片) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {lifecycle.milestones.map((m) => {
          const isCrit = m.urgency === "CRITICAL";
          const isExp = m.urgency === "EXPIRED";

          return (
            <div
              key={m.key}
              className={`rounded-xl border p-3 ${
                isCrit
                  ? "border-rose-300 bg-rose-50/40"
                  : isExp
                  ? "border-slate-200 bg-slate-50/50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{m.label}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    isCrit
                      ? "bg-rose-500 text-white animate-pulse"
                      : isExp
                      ? "bg-slate-200 text-slate-600"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {isExp ? "已截止" : isCrit ? "紧急冲刺" : "正常递交"}
                </span>
              </div>
              <div className="mt-1.5 text-xs font-bold text-slate-900 font-mono tnum">
                {m.dateStr}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. 变更答疑更正提炼重点 (Diff Highlights) */}
      {lifecycle.changes.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 border-b border-amber-200/60 pb-2">
            <AlertCircleIcon className="h-4 w-4 text-amber-600" />
            <span>项目答疑澄清与更正重点差异提取 (Diff Radar)</span>
          </div>
          <div className="mt-2 space-y-2">
            {lifecycle.changes.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-xs border border-amber-200/80 shadow-2xs"
              >
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold border ${c.categoryColor}`}
                >
                  {c.categoryLabel}
                </span>
                <p className="min-w-0 flex-1 text-slate-700 leading-relaxed">
                  {c.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
