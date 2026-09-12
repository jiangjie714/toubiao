import cron from "node-cron";
import { prisma } from "@/lib/prisma";

type CronFields = {
  second: number[];
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
};

function matches(value: number, allowed: number[]): boolean {
  return allowed.includes(value);
}

function isAllValues(values: number[], from: number, to: number): boolean {
  const expected = Array.from({ length: to - from + 1 }, (_, index) => from + index);
  return expected.every((value) => values.includes(value));
}

export function getNextRunAt(expression: string, from = new Date()): Date {
  if (!cron.validate(expression)) return new Date(from.getTime() + 2 * 60 * 60 * 1000);
  const fields = cron.parse(expression) as unknown as CronFields;

  for (let minutes = 1; minutes <= 366 * 24 * 60; minutes++) {
    const candidate = new Date(from.getTime() + minutes * 60_000);
    const dayOfMonthRestricted = !isAllValues(fields.dayOfMonth, 1, 31);
    const dayOfWeekRestricted = !isAllValues(fields.dayOfWeek, 0, 6);
    const dayOfMonthMatch = matches(candidate.getDate(), fields.dayOfMonth);
    const dayOfWeekMatch = matches(candidate.getDay(), fields.dayOfWeek);
    const dayMatch = dayOfMonthRestricted && dayOfWeekRestricted
      ? dayOfMonthMatch || dayOfWeekMatch
      : dayOfMonthMatch && dayOfWeekMatch;

    if (
      dayMatch &&
      matches(candidate.getSeconds(), fields.second) &&
      matches(candidate.getMinutes(), fields.minute) &&
      matches(candidate.getHours(), fields.hour) &&
      matches(candidate.getMonth() + 1, fields.month)
    ) {
      return candidate;
    }
  }
  return new Date(from.getTime() + 2 * 60 * 60 * 1000);
}

export function expectedIntervalMs(expression: string): number {
  const next = getNextRunAt(expression);
  const following = getNextRunAt(expression, next);
  return Math.max(following.getTime() - next.getTime(), 60_000);
}

export async function recalculateHealthScore(
  sourceId: number,
  lastRun: { status: string; itemsParsed: number },
): Promise<number> {
  const source = await prisma.crawlSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`CrawlSource 不存在：${sourceId}`);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await prisma.crawlLog.findMany({
    where: { sourceId, startedAt: { gte: since } },
    select: { status: true },
  });
  const failures = logs.filter((log) => log.status === "FAILED").length;
  const failRate = failures / Math.max(logs.length, 5);

  let score = 100;
  score -= Math.min(source.consecutiveFailures * 15, 45);
  score -= Math.round(failRate * 40);
  if (
    source.lastSuccessAt &&
    Date.now() - source.lastSuccessAt.getTime() > 2 * expectedIntervalMs(source.scheduleCron)
  ) {
    score -= 20;
  }
  if (lastRun.status === "OK" && lastRun.itemsParsed === 0) score -= 10;

  const healthScore = Math.max(0, Math.min(100, score));
  await prisma.crawlSource.update({ where: { id: sourceId }, data: { healthScore } });
  return healthScore;
}
