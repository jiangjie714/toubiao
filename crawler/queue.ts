import { prisma } from "@/lib/prisma";
import { runSourceWithLogging } from "./runner";

export type CrawlTaskPayload = {
  maxPages?: number;
};

export async function enqueueCrawlTask(input: {
  skillCode: string;
  trigger: string;
  payload?: CrawlTaskPayload;
}): Promise<number> {
  const existing = await prisma.crawlTask.findFirst({
    where: {
      skillCode: input.skillCode,
      status: { in: ["queued", "running"] },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const task = await prisma.crawlTask.create({
    data: {
      skillCode: input.skillCode,
      trigger: input.trigger,
      payload: input.payload ?? undefined,
    },
  });
  return task.id;
}

export async function claimNextCrawlTask() {
  const candidates = await prisma.crawlTask.findMany({
    where: {
      status: "queued",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: [{ id: "asc" }],
    take: 20,
  });

  for (const task of candidates) {
    const claimed = await prisma.crawlTask.updateMany({
      where: { id: task.id, status: "queued" },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 1) return task;
  }
  return null;
}

export async function completeCrawlTask(taskId: number): Promise<void> {
  await prisma.crawlTask.update({
    where: { id: taskId },
    data: { status: "done", finishedAt: new Date(), error: null },
  });
}

export async function failCrawlTask(taskId: number, error: unknown): Promise<"queued" | "failed"> {
  const task = await prisma.crawlTask.findUnique({ where: { id: taskId } });
  if (!task) return "failed";

  const message = error instanceof Error ? error.message : String(error);
  if (task.attempts < task.maxAttempts) {
    const backoffMs = Math.min(2 ** task.attempts * 60_000, 30 * 60_000);
    await prisma.crawlTask.update({
      where: { id: taskId },
      data: {
        status: "queued",
        nextRetryAt: new Date(Date.now() + backoffMs),
        error: message.slice(0, 500),
        startedAt: null,
      },
    });
    return "queued";
  }

  await prisma.crawlTask.update({
    where: { id: taskId },
    data: { status: "failed", finishedAt: new Date(), error: message.slice(0, 500) },
  });
  return "failed";
}

export async function processTaskQueue(options: { once?: boolean; pollMs?: number } = {}) {
  let processed = 0;

  while (true) {
    const task = await claimNextCrawlTask();
    if (!task) {
      if (options.once) break;
      await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 5_000));
      continue;
    }

    try {
      const payload = task.payload as CrawlTaskPayload | null;
      await runSourceWithLogging(task.skillCode, {
        maxPages: payload?.maxPages,
        trigger: task.trigger as "cron" | "manual" | "api" | "retry",
      });
      await completeCrawlTask(task.id);
      processed++;
    } catch (error) {
      const result = await failCrawlTask(task.id, error);
      if (result === "failed") processed++;
    }
    if (options.once) break;
  }
  return processed;
}
