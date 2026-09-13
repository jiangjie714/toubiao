import { prisma } from "@/lib/prisma";
import { getNextRunAt, recalculateHealthScore } from "@/../crawler/health";
import { sendWebhookMessage } from "@/../crawler/alerts";

export const CIRCUIT_FAILURE_THRESHOLD = 3; // 连续失败 3 次触发熔断降级
export const CIRCUIT_DEGRADE_HOURS = 6; // 降级期间推迟 6 小时一次低频探活

export interface CircuitStatusInfo {
  isDegraded: boolean;
  consecutiveFailures: number;
  status: string;
  nextRunAt: Date | null;
  reason?: string;
}

/**
 * 处理数据源抓取失败，当连续失败达到阈值时自动触发熔断降级
 */
export async function handleFailureAndDegrade(
  sourceId: number,
  consecutiveFailures: number,
  errorMsg: string
): Promise<{ degraded: boolean; message: string }> {
  const source = await prisma.crawlSource.findUnique({ where: { id: sourceId } });
  if (!source) return { degraded: false, message: "数据源不存在" };

  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    const degradedNextRunAt = new Date(Date.now() + CIRCUIT_DEGRADE_HOURS * 3600_000);
    const reason = `连续失败 ${consecutiveFailures} 次（最新错误: ${errorMsg.slice(0, 100)}），已触发智能熔断保护，调度已自动降频至 6 小时一次。`;

    await prisma.crawlSource.update({
      where: { id: sourceId },
      data: {
        status: "CIRCUIT_DEGRADED",
        lastMessage: reason,
        nextRunAt: degradedNextRunAt,
      },
    });

    // 记录审计日志
    console.warn(`[熔断中枢] 数据源 ${source.skillCode} 已触发熔断降级: ${reason}`);

    return { degraded: true, message: reason };
  }

  return { degraded: false, message: "未达熔断阈值" };
}

/**
 * 探针或抓取成功后，尝试自动自愈已熔断或故障的数据源
 */
export async function attemptAutoHealing(
  skillCode: string
): Promise<{ healed: boolean; previousStatus?: string | null }> {
  const source = await prisma.crawlSource.findUnique({ where: { skillCode } });
  if (!source) return { healed: false };

  const isBroken =
    source.status === "CIRCUIT_DEGRADED" ||
    source.status === "FAILED" ||
    source.consecutiveFailures > 0;

  if (!isBroken) {
    return { healed: false };
  }

  const previousStatus = source.status;
  const now = new Date();
  const normalNextRunAt = getNextRunAt(source.scheduleCron, now);

  // 1. 恢复正常运行状态与连续失败归零
  await prisma.crawlSource.update({
    where: { id: source.id },
    data: {
      status: "OK",
      consecutiveFailures: 0,
      lastSuccessAt: now,
      lastMessage: `[自愈成功] 探针拨测通过，已自动解除熔断并恢复正常调度周期`,
      nextRunAt: normalNextRunAt,
    },
  });

  // 2. 重算健康分
  const newHealthScore = await recalculateHealthScore(source.id, {
    status: "OK",
    itemsParsed: 1,
  });

  // 3. 向告警规则绑定的 Webhook 发送自愈恢复通知（红转绿通知）
  const rules = await prisma.alertRule.findMany({ where: { enabled: true } });
  for (const rule of rules) {
    const scoped = rule.scope === "global" || rule.scope === `source:${skillCode}`;
    if (!scoped) continue;

    if (["wecom_webhook", "dingtalk_webhook", "feishu_webhook", "webhook"].includes(rule.channel)) {
      await sendWebhookMessage(
        rule.channel,
        rule.target,
        `> **数据源代号**：${source.skillCode} (${source.name})\n> **前置异常状态**：${previousStatus}\n> **自愈时间**：${now.toLocaleString("zh-CN")}\n> **当前健康分**：${newHealthScore} 分\n\n数据源网络通信与列表解析已全部恢复正常，系统已自动解除熔断降级保护并恢复常规定时抓取。`,
        `🎉 数据源自愈恢复通知 - ${source.skillCode}`
      );
    }
  }

  console.log(`[自愈中枢] 数据源 ${skillCode} 自愈成功，已由 ${previousStatus} 恢复为 OK (健康分: ${newHealthScore})`);
  return { healed: true, previousStatus };
}

/**
 * 管理员在后台手动解除熔断
 */
export async function manualResetCircuitBreaker(sourceId: number): Promise<{ success: boolean; message: string }> {
  const source = await prisma.crawlSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("数据源不存在");

  const now = new Date();
  const nextRunAt = getNextRunAt(source.scheduleCron, now);

  await prisma.crawlSource.update({
    where: { id: sourceId },
    data: {
      status: "OK",
      consecutiveFailures: 0,
      lastMessage: `管理员手动解除熔断，已恢复正常调度状态`,
      nextRunAt,
    },
  });

  await recalculateHealthScore(sourceId, {
    status: "OK",
    itemsParsed: 1,
  });

  return { success: true, message: `数据源「${source.name}」已成功解除熔断！` };
}
