import { prisma } from "@/lib/prisma";
import { getNextRunAt } from "./health";
import { enqueueCrawlTask } from "./queue";

export async function scheduleDueSources(now = new Date()): Promise<number> {
  const sources = await prisma.crawlSource.findMany({
    where: {
      enabled: true,
      status: { not: "RUNNING" },
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    orderBy: [{ priority: "asc" }, { nextRunAt: "asc" }],
  });

  let enqueued = 0;
  for (const source of sources) {
    const existing = await prisma.crawlTask.findFirst({
      where: { skillCode: source.skillCode, status: { in: ["queued", "running"] } },
      select: { id: true },
    });
    if (existing) {
      await prisma.crawlSource.update({
        where: { id: source.id },
        data: { nextRunAt: getNextRunAt(source.scheduleCron, now) },
      });
      continue;
    }

    await enqueueCrawlTask({ skillCode: source.skillCode, trigger: "cron" });
    await prisma.crawlSource.update({
      where: { id: source.id },
      data: { nextRunAt: getNextRunAt(source.scheduleCron, now) },
    });
    enqueued++;
  }
  return enqueued;
}
