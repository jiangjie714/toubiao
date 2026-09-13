import { prisma } from "@/lib/prisma";
import { enqueueCrawlTask } from "@/../crawler/queue";
import { scheduleDueSources } from "@/../crawler/scheduler";

export interface CrawlTaskItem {
  id: number;
  skillCode: string;
  sourceName: string;
  trigger: string;
  triggerLabel: string;
  status: "queued" | "running" | "done" | "failed" | string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  payload: { maxPages?: number } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  error: string | null;
}

export interface TasksOverviewData {
  queuedCount: number;
  runningCount: number;
  doneTodayCount: number;
  failedCount: number;
  totalTasks: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  tasks: CrawlTaskItem[];
  availableSources: Array<{ skillCode: string; name: string }>;
}

function formatTriggerLabel(trigger: string): string {
  switch (trigger) {
    case "cron":
      return "定时调度 (Cron)";
    case "manual":
      return "手动触发 (Manual)";
    case "retry":
      return "退避重试 (Retry)";
    case "api":
      return "系统接口 (API)";
    default:
      return trigger;
  }
}

/**
 * 获取任务池与队列监控全景数据
 */
export async function getTasksOverview(options: {
  status?: string;
  skillCode?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<TasksOverviewData> {
  const { status = "all", skillCode, page = 1, pageSize = 25 } = options;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const whereClause: Record<string, unknown> = {};
  if (status && status !== "all") {
    whereClause.status = status;
  }
  if (skillCode) {
    whereClause.skillCode = skillCode;
  }

  const [
    queuedCount,
    runningCount,
    doneTodayCount,
    failedCount,
    totalTasks,
    tasksRaw,
    sources,
  ] = await Promise.all([
    prisma.crawlTask.count({ where: { status: "queued" } }),
    prisma.crawlTask.count({ where: { status: "running" } }),
    prisma.crawlTask.count({
      where: {
        status: "done",
        finishedAt: { gte: todayStart },
      },
    }),
    prisma.crawlTask.count({ where: { status: "failed" } }),
    prisma.crawlTask.count({ where: whereClause }),
    prisma.crawlTask.findMany({
      where: whereClause,
      orderBy: [{ id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.crawlSource.findMany({
      select: { skillCode: true, name: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const sourceMap = new Map<string, string>();
  for (const s of sources) {
    sourceMap.set(s.skillCode, s.name);
  }

  const tasks: CrawlTaskItem[] = tasksRaw.map((t) => {
    let durationSeconds: number | null = null;
    if (t.startedAt && t.finishedAt) {
      durationSeconds = Math.max(
        1,
        Math.round((t.finishedAt.getTime() - t.startedAt.getTime()) / 1000)
      );
    }

    return {
      id: t.id,
      skillCode: t.skillCode,
      sourceName: sourceMap.get(t.skillCode) || t.skillCode,
      trigger: t.trigger,
      triggerLabel: formatTriggerLabel(t.trigger),
      status: t.status,
      attempts: t.attempts,
      maxAttempts: t.maxAttempts,
      nextRetryAt: t.nextRetryAt ? t.nextRetryAt.toISOString() : null,
      payload: (t.payload as { maxPages?: number }) || null,
      createdAt: t.createdAt.toISOString(),
      startedAt: t.startedAt ? t.startedAt.toISOString() : null,
      finishedAt: t.finishedAt ? t.finishedAt.toISOString() : null,
      durationSeconds,
      error: t.error,
    };
  });

  return {
    queuedCount,
    runningCount,
    doneTodayCount,
    failedCount,
    totalTasks,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil(totalTasks / pageSize) || 1,
    tasks,
    availableSources: sources,
  };
}

/**
 * 手动派发抓取任务入队
 */
export async function dispatchSourceTask(input: {
  skillCode: string;
  maxPages?: number;
  trigger?: string;
}): Promise<{ success: boolean; taskId?: number; error?: string }> {
  try {
    const source = await prisma.crawlSource.findUnique({
      where: { skillCode: input.skillCode },
    });
    if (!source) {
      return { success: false, error: "未找到该数据源" };
    }

    const taskId = await enqueueCrawlTask({
      skillCode: input.skillCode,
      trigger: input.trigger || "manual",
      payload: input.maxPages ? { maxPages: input.maxPages } : undefined,
    });

    return { success: true, taskId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "派发任务失败",
    };
  }
}

/**
 * 一键重试失败或挂起任务
 */
export async function retryCrawlTask(taskId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const task = await prisma.crawlTask.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, error: "任务不存在" };

    await prisma.crawlTask.update({
      where: { id: taskId },
      data: {
        status: "queued",
        nextRetryAt: new Date(),
        startedAt: null,
        finishedAt: null,
        error: null,
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "重试任务失败",
    };
  }
}

/**
 * 取消排队中的任务
 */
export async function cancelCrawlTask(taskId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const task = await prisma.crawlTask.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, error: "任务不存在" };

    if (task.status === "running") {
      return { success: false, error: "正在抓取中的任务无法直接取消，请等待完成" };
    }

    await prisma.crawlTask.delete({ where: { id: taskId } });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "取消任务失败",
    };
  }
}

/**
 * 清理历史已完成/失败的任务
 */
export async function clearCompletedTasks(
  statusToClear: "done" | "all_finished" = "all_finished"
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const statuses =
      statusToClear === "done" ? ["done"] : ["done", "failed"];

    const res = await prisma.crawlTask.deleteMany({
      where: {
        status: { in: statuses },
      },
    });

    return { success: true, deletedCount: res.count };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "清理失败",
    };
  }
}

/**
 * 立即触发到期源的调度入队扫描与消费
 */
export async function triggerSchedulerNow(): Promise<{
  success: boolean;
  enqueuedCount: number;
  error?: string;
}> {
  try {
    const enqueuedCount = await scheduleDueSources();
    return { success: true, enqueuedCount };
  } catch (err) {
    return {
      success: false,
      enqueuedCount: 0,
      error: err instanceof Error ? err.message : "调度扫描执行失败",
    };
  }
}
