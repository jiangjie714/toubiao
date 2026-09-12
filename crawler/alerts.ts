import { prisma } from "@/lib/prisma";

export async function dispatchAlerts(input: {
  sourceId: number;
  skillCode: string;
  healthScore: number;
  status: string;
  itemsParsed: number;
  consecutiveFailures: number;
}): Promise<number> {
  const rules = await prisma.alertRule.findMany({ where: { enabled: true } });
  let fired = 0;

  for (const rule of rules) {
    const scoped = rule.scope === "global" || rule.scope === `source:${input.skillCode}`;
    if (!scoped) continue;

    const triggered =
      (rule.condition === "health_below" && input.healthScore < rule.threshold) ||
      (rule.condition === "zero_parsed" && input.status === "OK" && input.itemsParsed === 0) ||
      (rule.condition === "consecutive_failures" && input.consecutiveFailures >= rule.threshold);
    if (!triggered) continue;

    const cooldownStart = new Date(Date.now() - rule.cooldownMinutes * 60_000);
    const recent = await prisma.alertRecord.findFirst({
      where: { ruleId: rule.id, firedAt: { gte: cooldownStart } },
    });
    if (recent) continue;

    const message = `[${input.skillCode}] health=${input.healthScore}, status=${input.status}, parsed=${input.itemsParsed}, failures=${input.consecutiveFailures}`;
    await prisma.alertRecord.create({ data: { ruleId: rule.id, message } });

    if (rule.channel === "wecom_webhook") {
      try {
        await fetch(rule.target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msgtype: "text", text: { content: message } }),
        });
      } catch (error) {
        console.error("企业微信告警发送失败", error);
      }
    } else {
      console.warn(`邮件告警待配置：${message}`);
    }
    fired++;
  }
  return fired;
}
