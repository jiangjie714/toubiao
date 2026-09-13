import { prisma } from "@/lib/prisma";

export async function sendWebhookMessage(
  channel: string,
  target: string,
  content: string,
  title = "标讯通数据源预警"
): Promise<{ success: boolean; error?: string }> {
  try {
    let payload: unknown;
    if (channel === "wecom_webhook") {
      // 企业微信群机器人格式
      payload = {
        msgtype: "markdown",
        markdown: {
          content: `### 🚨 ${title}\n\n${content}\n\n> 来源：标讯通数据采集中心\n> 时间：${new Date().toLocaleString("zh-CN")}`,
        },
      };
    } else if (channel === "dingtalk_webhook") {
      // 钉钉群机器人格式
      payload = {
        msgtype: "markdown",
        markdown: {
          title,
          text: `### 🚨 ${title}\n\n${content}\n\n> 来源：标讯通数据采集中心\n> 时间：${new Date().toLocaleString("zh-CN")}`,
        },
      };
    } else if (channel === "feishu_webhook") {
      // 飞书自定义机器人格式
      payload = {
        msg_type: "text",
        content: {
          text: `🚨【${title}】\n\n${content}\n\n来源：标讯通数据采集中心\n时间：${new Date().toLocaleString("zh-CN")}`,
        },
      };
    } else {
      // 通用 Webhook JSON POST
      payload = {
        event: "DATA_SOURCE_ALERT",
        title,
        message: content,
        timestamp: new Date().toISOString(),
      };
    }

    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { success: false, error: `Webhook 响应异常：HTTP ${res.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook 发送异常",
    };
  }
}

export async function testSendAlert(
  channel: string,
  target: string,
  customMessage?: string
): Promise<{ success: boolean; error?: string }> {
  const content =
    customMessage ||
    `这是一条来自【标讯通管理后台】的连通性测试告警。\n当前检测通道：${channel}\n若收到此消息，说明告警通知机器人已成功配置生效！`;
  return await sendWebhookMessage(channel, target, content, "数据源告警网络连通性测试");
}

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

    const conditionDesc =
      rule.condition === "health_below"
        ? `健康分低于阈值 (当前 ${input.healthScore} < 阈值 ${rule.threshold})`
        : rule.condition === "zero_parsed"
        ? "单次抓取成功但解析结果为 0 条 (疑似站点改版)"
        : `连续抓取失败达标 (连续失败 ${input.consecutiveFailures} 次 >= 阈值 ${rule.threshold})`;

    const message = `[数据源异常预警] 数据源代号：${input.skillCode} | 触发原因：${conditionDesc} | 当前状态：${input.status} | 解析条数：${input.itemsParsed}`;
    await prisma.alertRecord.create({ data: { ruleId: rule.id, message } });

    if (
      ["wecom_webhook", "dingtalk_webhook", "feishu_webhook", "webhook"].includes(
        rule.channel
      )
    ) {
      await sendWebhookMessage(
        rule.channel,
        rule.target,
        `> **数据源代号**：${input.skillCode}\n> **预警条件**：${conditionDesc}\n> **健康评分**：${input.healthScore} 分\n> **连续失败**：${input.consecutiveFailures} 次\n\n请尽快登录管理后台检查站点结构或在线回滚修复！`,
        `数据源异常告警 - ${input.skillCode}`
      );
    } else {
      console.warn(`[告警通知] 通道 ${rule.channel}：${message}`);
    }
    fired++;
  }
  return fired;
}
