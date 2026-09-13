"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BoltIcon,
  ClockIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckCircleIcon,
} from "@/components/icons";
import TaskDispatchModal from "./task-dispatch-modal";
import type { TasksOverviewData, CrawlTaskItem } from "@/lib/crawler/task-manager";
import {
  retryCrawlTaskAction,
  cancelCrawlTaskAction,
  clearCompletedTasksAction,
  triggerSchedulerNowAction,
} from "@/app/admin/sources/actions";

interface Props {
  data: TasksOverviewData;
  currentStatus: string;
}

export default function TasksManagerView({ data, currentStatus }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<CrawlTaskItem[]>(data.tasks);
  const [isPending, startTransition] = useTransition();
  const [schedulerMessage, setSchedulerMessage] = useState<string | null>(null);

  // 一键触发到期调度扫描
  const handleTriggerScheduler = () => {
    setSchedulerMessage(null);
    startTransition(async () => {
      const res = await triggerSchedulerNowAction();
      if (res.success) {
        setSchedulerMessage(`调度扫描完成！已成功将 ${res.enqueuedCount} 个到期数据源推入排队队列。`);
        router.refresh();
      } else {
        alert(res.error || "触发调度扫描失败");
      }
    });
  };

  // 重试任务
  const handleRetry = (taskId: number) => {
    startTransition(async () => {
      const res = await retryCrawlTaskAction(taskId);
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "queued", error: null } : t))
        );
        router.refresh();
      } else {
        alert(res.error || "重试任务失败");
      }
    });
  };

  // 取消任务
  const handleCancel = (taskId: number) => {
    if (!confirm("确定要取消这条排队中的抓取任务吗？")) return;
    startTransition(async () => {
      const res = await cancelCrawlTaskAction(taskId);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        router.refresh();
      } else {
        alert(res.error || "取消任务失败");
      }
    });
  };

  // 清空历史任务
  const handleClearHistory = () => {
    if (!confirm("确定要清理已完成或已失败的历史任务流水吗？正在排队和运行的任务将保留。")) return;
    startTransition(async () => {
      const res = await clearCompletedTasksAction("all_finished");
      if (res.success) {
        alert(`成功清理 ${res.deletedCount || 0} 条历史已完成任务！`);
        router.refresh();
      } else {
        alert(res.error || "清理历史任务失败");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 顶部面包屑与标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/admin/sources" className="hover:text-primary transition-colors">
              数据源调度中枢
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">任务池与队列监控</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BoltIcon className="h-6 w-6 text-primary" />
            <span>分布式采集任务队列与调度中枢</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            全局 CrawlTask 异步队列消费、并发控制、指数退避重试机制与按源精准派发
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isPending}
            onClick={handleTriggerScheduler}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isPending ? "animate-spin text-primary" : ""}`} />
            <span>{isPending ? "扫描调度中..." : "⚡ 立即触发调度扫描"}</span>
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={handleClearHistory}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="清理已完成的历史任务流水"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            <span>清空已完成</span>
          </button>

          <TaskDispatchModal availableSources={data.availableSources} />
        </div>
      </div>

      {/* 调度反馈横幅 */}
      {schedulerMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{schedulerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSchedulerMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 大队列状态指标卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">排队待消费 (Queued)</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <ClockIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-600 tnum">{data.queuedCount}</span>
            <span className="text-xs text-slate-400">个任务</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Worker 任务池有序消费中
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">并发抓取中 (Running)</span>
            <span className="p-1.5 bg-blue-50 text-primary rounded-lg">
              <BoltIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-primary tnum">{data.runningCount}</span>
            <span className="text-xs text-slate-400">个并发节点</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            受全局并发保护与站点限速
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">今日成功完成 (Done)</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheckIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-600 tnum">{data.doneTodayCount}</span>
            <span className="text-xs text-slate-400">批次完成</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            数据已清洗抽取入库
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">失败待重试 (Failed)</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <ShieldAlertIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-600 tnum">{data.failedCount}</span>
            <span className="text-xs text-slate-400">次异常</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            支持指数退避重试或人工重试
          </div>
        </div>
      </div>

      {/* 筛选与列表 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* 工具栏 Tabs */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            {[
              { key: "all", label: `全部 (${data.totalTasks})` },
              { key: "queued", label: `排队中 (${data.queuedCount})` },
              { key: "running", label: `执行中 (${data.runningCount})` },
              { key: "done", label: "已完成" },
              { key: "failed", label: `失败 (${data.failedCount})` },
            ].map((tab) => {
              const active = currentStatus === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={`/admin/sources/tasks?status=${tab.key}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-white shadow-2xs font-semibold"
                      : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="text-xs text-slate-400">
            第 {data.currentPage} / {data.totalPages} 页 · 共 {data.totalTasks} 条记录
          </div>
        </div>

        {/* 任务表格 */}
        {tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <BoltIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs">暂无匹配的采集任务记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30 text-slate-500">
                  <th className="py-3 px-4 font-semibold">任务 ID</th>
                  <th className="py-3 px-4 font-semibold">目标数据源</th>
                  <th className="py-3 px-4 font-semibold">触发来源</th>
                  <th className="py-3 px-4 font-semibold">队列状态</th>
                  <th className="py-3 px-4 font-semibold">尝试次数</th>
                  <th className="py-3 px-4 font-semibold">时间与耗时</th>
                  <th className="py-3 px-4 font-semibold">错误信息 / 诊断</th>
                  <th className="py-3 px-4 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const isQueued = task.status === "queued";
                  const isRunning = task.status === "running";
                  const isDone = task.status === "done";
                  const isFailed = task.status === "failed";

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* ID */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 tnum">
                        #{task.id}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {task.sourceName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {task.skillCode}
                        </div>
                      </td>

                      {/* Trigger */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-medium">
                          {task.triggerLabel}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isQueued && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            排队待取
                          </span>
                        )}
                        {isRunning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-primary font-medium border border-blue-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                            正在抓取
                          </span>
                        )}
                        {isDone && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            执行成功
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            执行失败
                          </span>
                        )}
                      </td>

                      {/* Attempts */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <span className={task.attempts > 1 ? "text-amber-600 font-bold" : "text-slate-600"}>
                          {task.attempts}
                        </span>
                        <span className="text-slate-400"> / {task.maxAttempts} 次</span>
                      </td>

                      {/* Timing */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono tnum">
                        <div>
                          创：{new Date(task.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        {task.durationSeconds ? (
                          <div className="text-[11px] text-slate-400">
                            耗时 {task.durationSeconds} 秒
                          </div>
                        ) : task.nextRetryAt ? (
                          <div className="text-[11px] text-amber-600">
                            重试于 {new Date(task.nextRetryAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        ) : null}
                      </td>

                      {/* Error details */}
                      <td className="py-3 px-4 max-w-xs">
                        {task.error ? (
                          <div
                            className="text-rose-600 font-mono text-[11px] truncate"
                            title={task.error}
                          >
                            {task.error}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {(isFailed || isDone) && (
                            <button
                              type="button"
                              onClick={() => handleRetry(task.id)}
                              disabled={isPending}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                            >
                              重新入队
                            </button>
                          )}

                          {isQueued && (
                            <button
                              type="button"
                              onClick={() => handleCancel(task.id)}
                              disabled={isPending}
                              className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              取消
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
