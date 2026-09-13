import { prisma } from "@/lib/prisma";
import { testSendAlert } from "@/../crawler/alerts";

export interface AlertRuleItem {
  id: number;
  scope: string;
  scopeLabel: string;
  condition: string;
  conditionLabel: string;
  threshold: number;
  channel: string;
  channelLabel: string;
  target: string;
  enabled: boolean;
  cooldownMinutes: number;
  recentFiredCount: number;
}

export interface AlertRecordItem {
  id: number;
  ruleId: number;
  ruleScope: string;
  ruleChannel: string;
  message: string;
  firedAt: string;
}

export interface AlertsOverviewData {
  totalRules: number;
  activeRules: number;
  todayFiredCount: number;
  rules: AlertRuleItem[];
  recentRecords: AlertRecordItem[];
  availableSources: Array<{ skillCode: string; name: string }>;
}

export function formatConditionLabel(condition: string, threshold: number): string {
  switch (condition) {
    case "health_below":
      return `健康分低于 ${threshold} 分`;
    case "consecutive_failures":
      return `连续抓取失败 >= ${threshold} 次`;
    case "zero_parsed":
      return "单次抓取为 0 条 (疑似站点改版)";
    default:
      return condition;
  }
}

export function formatChannelLabel(channel: string): string {
  switch (channel) {
    case "wecom_webhook":
      return "企业微信机器人";
    case "dingtalk_webhook":
      return "钉钉群机器人";
    case "feishu_webhook":
      return "飞书自定义机器人";
    case "webhook":
      return "通用 Webhook (POST)";
    case "email":
      return "邮件通知";
    default:
      return channel;
  }
}

/**
 * 获取告警管理大盘全景数据
 */
export async function getAlertsOverview(): Promise<AlertsOverviewData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [rules, recentRecords, todayFiredCount, sources] = await Promise.all([
    prisma.alertRule.findMany({
      include: {
        _count: { select: { records: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.alertRecord.findMany({
      take: 40,
      orderBy: { firedAt: "desc" },
      include: { rule: true },
    }),
    prisma.alertRecord.count({
      where: { firedAt: { gte: todayStart } },
    }),
    prisma.crawlSource.findMany({
      select: { skillCode: true, name: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const sourceMap = new Map<string, string>();
  for (const s of sources) {
    sourceMap.set(`source:${s.skillCode}`, s.name);
  }

  const ruleItems: AlertRuleItem[] = rules.map((r) => {
    let scopeLabel = "全局全部数据源";
    if (r.scope.startsWith("source:")) {
      scopeLabel = `单源：${sourceMap.get(r.scope) || r.scope.replace("source:", "")}`;
    }

    return {
      id: r.id,
      scope: r.scope,
      scopeLabel,
      condition: r.condition,
      conditionLabel: formatConditionLabel(r.condition, r.threshold),
      threshold: r.threshold,
      channel: r.channel,
      channelLabel: formatChannelLabel(r.channel),
      target: r.target,
      enabled: r.enabled,
      cooldownMinutes: r.cooldownMinutes,
      recentFiredCount: r._count.records,
    };
  });

  const recordItems: AlertRecordItem[] = recentRecords.map((rec) => ({
    id: rec.id,
    ruleId: rec.ruleId,
    ruleScope: rec.rule ? rec.rule.scope : "未知",
    ruleChannel: rec.rule ? formatChannelLabel(rec.rule.channel) : "未知",
    message: rec.message,
    firedAt: rec.firedAt.toISOString(),
  }));

  return {
    totalRules: rules.length,
    activeRules: rules.filter((r) => r.enabled).length,
    todayFiredCount,
    rules: ruleItems,
    recentRecords: recordItems,
    availableSources: sources,
  };
}

/**
 * 新建告警规则
 */
export async function createAlertRule(data: {
  scope: string;
  condition: string;
  threshold: number;
  channel: string;
  target: string;
  cooldownMinutes: number;
}): Promise<{ success: boolean; ruleId?: number; error?: string }> {
  try {
    if (!data.target || !data.target.trim()) {
      return { success: false, error: "请填写 Webhook 地址或接收目标" };
    }

    const rule = await prisma.alertRule.create({
      data: {
        scope: data.scope || "global",
        condition: data.condition || "health_below",
        threshold: data.threshold || 70,
        channel: data.channel || "wecom_webhook",
        target: data.target.trim(),
        cooldownMinutes: data.cooldownMinutes || 60,
        enabled: true,
      },
    });

    return { success: true, ruleId: rule.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "新建告警规则失败",
    };
  }
}

/**
 * 切换告警规则启用状态
 */
export async function toggleAlertRule(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const rule = await prisma.alertRule.findUnique({ where: { id } });
    if (!rule) return { success: false, error: "未找到告警规则" };

    await prisma.alertRule.update({
      where: { id },
      data: { enabled: !rule.enabled },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "更新失败",
    };
  }
}

/**
 * 删除告警规则
 */
export async function deleteAlertRule(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.alertRule.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "删除失败",
    };
  }
}

/**
 * 在线测试告警通道连通性
 */
export async function testAlertChannel(
  channel: string,
  target: string
): Promise<{ success: boolean; error?: string }> {
  return await testSendAlert(channel, target);
}
