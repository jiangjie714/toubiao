"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import {
  sendToWebhookEndpoint,
  dispatchBusinessWebhookEvent,
  type WebhookChannel,
  type WebhookEventType,
  type WebhookEventPayload,
} from "@/lib/webhook-dispatcher";

export interface WebhookEndpointItem {
  id: number;
  name: string;
  channel: WebhookChannel;
  webhookUrl: string;
  secret: string | null;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: string;
  lastLog?: {
    statusCode: number;
    latencyMs: number;
    success: boolean;
    createdAt: string;
  } | null;
}

export interface WebhookDeliveryLogItem {
  id: number;
  endpointId: number;
  endpointName: string;
  channel: string;
  eventType: WebhookEventType;
  payloadSummary: string;
  statusCode: number;
  latencyMs: number;
  success: boolean;
  error: string | null;
  createdAt: string;
}

export interface WebhookCenterData {
  endpoints: WebhookEndpointItem[];
  stats: {
    totalEndpoints: number;
    activeEndpoints: number;
    todaySuccessCount: number;
    avgLatencyMs: number;
  };
  recentLogs: WebhookDeliveryLogItem[];
}

export async function getWebhookCenterDataAction(): Promise<{
  success: boolean;
  data?: WebhookCenterData;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [endpoints, recentLogs, todaySuccessCount, allLogs] = await Promise.all([
      prisma.webhookEndpoint.findMany({
        where: { userId: user.uid },
        include: {
          logs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              statusCode: true,
              latencyMs: true,
              success: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.webhookDeliveryLog.findMany({
        where: { endpoint: { userId: user.uid } },
        include: {
          endpoint: {
            select: { name: true, channel: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.webhookDeliveryLog.count({
        where: {
          endpoint: { userId: user.uid },
          success: true,
          createdAt: { gte: todayStart },
        },
      }),
      prisma.webhookDeliveryLog.findMany({
        where: {
          endpoint: { userId: user.uid },
          success: true,
        },
        select: { latencyMs: true },
        take: 100,
      }),
    ]);

    const activeEndpoints = endpoints.filter((e) => e.enabled).length;
    const avgLatencyMs =
      allLogs.length > 0
        ? Math.round(allLogs.reduce((sum, l) => sum + l.latencyMs, 0) / allLogs.length)
        : 0;

    const formattedEndpoints: WebhookEndpointItem[] = endpoints.map((e) => {
      let eventsArr: WebhookEventType[] = [];
      try {
        eventsArr = Array.isArray(e.events)
          ? (e.events as WebhookEventType[])
          : JSON.parse(e.events as string);
      } catch {
        eventsArr = [];
      }

      return {
        id: e.id,
        name: e.name,
        channel: e.channel as WebhookChannel,
        webhookUrl: e.webhookUrl,
        secret: e.secret,
        events: eventsArr,
        enabled: e.enabled,
        createdAt: e.createdAt.toISOString(),
        lastLog: e.logs[0]
          ? {
              ...e.logs[0],
              createdAt: e.logs[0].createdAt.toISOString(),
            }
          : null,
      };
    });

    const formattedLogs: WebhookDeliveryLogItem[] = recentLogs.map((l) => ({
      id: l.id,
      endpointId: l.endpointId,
      endpointName: l.endpoint.name,
      channel: l.endpoint.channel,
      eventType: l.eventType as WebhookEventType,
      payloadSummary: l.payloadSummary,
      statusCode: l.statusCode,
      latencyMs: l.latencyMs,
      success: l.success,
      error: l.error,
      createdAt: l.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        endpoints: formattedEndpoints,
        stats: {
          totalEndpoints: endpoints.length,
          activeEndpoints,
          todaySuccessCount,
          avgLatencyMs,
        },
        recentLogs: formattedLogs,
      },
    };
  } catch (err) {
    console.error("Failed to load webhook center data:", err);
    return { success: false, error: "加载预警路由中枢数据失败" };
  }
}

export async function createWebhookEndpointAction(data: {
  name: string;
  channel: WebhookChannel;
  webhookUrl: string;
  secret?: string;
  events: WebhookEventType[];
}): Promise<{ success: boolean; endpointId?: number; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const trimmedName = data.name?.trim();
    const trimmedUrl = data.webhookUrl?.trim();
    if (!trimmedName) return { success: false, error: "请输入机器人终端名称" };
    if (!trimmedUrl || !trimmedUrl.startsWith("http")) {
      return { success: false, error: "请输入有效的 Webhook 完整 URL（以 http:// 或 https:// 开头）" };
    }
    if (!data.events || data.events.length === 0) {
      return { success: false, error: "请至少勾选一项订阅的业务预警事件" };
    }

    const entitlement = await getEntitlement(user.uid);
    const maxEndpoints = entitlement.features.pushGroups > 0 ? entitlement.features.pushGroups * 2 : 3;
    const currentCount = await prisma.webhookEndpoint.count({
      where: { userId: user.uid },
    });

    if (currentCount >= maxEndpoints) {
      return {
        success: false,
        error: `您当前套餐最多可配置 ${maxEndpoints} 个 Webhook 机器人终端，请升级套餐或清理无用终端`,
      };
    }

    const ep = await prisma.webhookEndpoint.create({
      data: {
        userId: user.uid,
        name: trimmedName,
        channel: data.channel,
        webhookUrl: trimmedUrl,
        secret: data.secret?.trim() || null,
        events: data.events,
        enabled: true,
      },
    });

    revalidatePath("/webhooks");
    return { success: true, endpointId: ep.id };
  } catch (err) {
    console.error("Failed to create webhook endpoint:", err);
    return { success: false, error: "创建 Webhook 终端失败" };
  }
}

export async function updateWebhookEndpointAction(
  id: number,
  data: {
    name?: string;
    channel?: WebhookChannel;
    webhookUrl?: string;
    secret?: string;
    events?: WebhookEventType[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const ep = await prisma.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!ep || ep.userId !== user.uid) {
      return { success: false, error: "终端记录不存在或无权操作" };
    }

    await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        channel: data.channel,
        webhookUrl: data.webhookUrl?.trim(),
        secret: data.secret !== undefined ? data.secret.trim() || null : undefined,
        events: data.events,
      },
    });

    revalidatePath("/webhooks");
    return { success: true };
  } catch (err) {
    console.error("Failed to update webhook endpoint:", err);
    return { success: false, error: "更新 Webhook 终端失败" };
  }
}

export async function deleteWebhookEndpointAction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const ep = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!ep || ep.userId !== user.uid) {
      return { success: false, error: "终端记录不存在或无权操作" };
    }

    await prisma.webhookEndpoint.delete({ where: { id } });
    revalidatePath("/webhooks");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete webhook endpoint:", err);
    return { success: false, error: "删除终端失败" };
  }
}

export async function toggleWebhookEndpointAction(
  id: number,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const ep = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!ep || ep.userId !== user.uid) {
      return { success: false, error: "终端记录不存在或无权操作" };
    }

    await prisma.webhookEndpoint.update({
      where: { id },
      data: { enabled },
    });

    revalidatePath("/webhooks");
    return { success: true };
  } catch (err) {
    console.error("Failed to toggle webhook endpoint:", err);
    return { success: false, error: "切换终端状态失败" };
  }
}

export async function testWebhookEndpointAction(
  id: number
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const ep = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!ep || ep.userId !== user.uid) {
      return { success: false, error: "终端记录不存在或无权操作" };
    }

    const testPayload: WebhookEventPayload = {
      eventType: "TEST",
      title: "【在线连通性测试】标讯通业务预警路由中枢",
      summary: "机器人终端连通性验证成功，系统后续将根据订阅矩阵自动推发高危业务事件卡片。",
      details: [
        { label: "目标终端", value: ep.name },
        { label: "渠道协议", value: ep.channel },
        { label: "加签鉴权", value: ep.secret ? "已启用加签 HMAC 校验" : "未启用密钥" },
        { label: "测试时间", value: new Date().toLocaleTimeString("zh-CN") },
      ],
      actionUrl: "/webhooks",
      urgent: false,
    };

    const res = await sendToWebhookEndpoint(ep, testPayload);

    // 记录测试日志
    await prisma.webhookDeliveryLog.create({
      data: {
        endpointId: ep.id,
        eventType: "TEST",
        payloadSummary: "【连通测试】机器人在线验证",
        statusCode: res.statusCode,
        latencyMs: res.latencyMs,
        success: res.success,
        error: res.error || null,
      },
    });

    revalidatePath("/webhooks");

    if (res.success) {
      return { success: true, latencyMs: res.latencyMs };
    } else {
      return {
        success: false,
        latencyMs: res.latencyMs,
        error: res.error || `HTTP 错误代码: ${res.statusCode}`,
      };
    }
  } catch (err) {
    console.error("Test webhook failed:", err);
    return { success: false, error: "网络通信失败，无法触达目标地址" };
  }
}

/**
 * 模拟触发 5 大高危业务事件推送（供用户在控制台一键实测试发真实卡片）
 */
export async function simulateEventDispatchAction(
  eventType: WebhookEventType
): Promise<{
  success: boolean;
  dispatchedCount?: number;
  successCount?: number;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "请先登录" };

    const samplePayloads: Record<WebhookEventType, WebhookEventPayload> = {
      DEADLINE: {
        eventType: "DEADLINE",
        title: "【截标紧急警报】市自然资源局三维实景中国标段距封标仅剩 24 小时",
        summary: "请项目负责人与编制小组立即核对 CA 签章、纸质胶装密封与商务报价，务必在截标前 2 小时完成递交！",
        details: [
          { label: "项目编号", value: "ZJ-2026-ZB-0891" },
          { label: "采购单位", value: "某某市自然资源和规划局" },
          { label: "最高限价", value: "¥480.00 万元" },
          { label: "截标倒计时", value: "23小时 45分钟 (明日 09:30)" },
          { label: "投递地点", value: "市公共资源交易中心第 3 开标室" },
        ],
        actionUrl: "/calendar",
        urgent: true,
      },
      COMPETITOR: {
        eventType: "COMPETITOR",
        title: "【后院起火·渗透警报】核心竞对「东软集团」拿下我方重点跟进项目",
        summary: "目标竞对以 78.5% 折扣率中标您重点跟进的发包单位标段，涉足我方核心优势战区！",
        details: [
          { label: "中标对手", value: "东软集团股份有限公司" },
          { label: "中标标段", value: "省智慧医疗影像云中枢服务项目" },
          { label: "发包单位", value: "某省卫生健康委员会" },
          { label: "中标金额", value: "¥1,280.00 万元 (7.8折低价突袭)" },
        ],
        actionUrl: "/competitors",
        urgent: true,
      },
      DEPOSIT: {
        eventType: "DEPOSIT",
        title: "【保证金超期催讨】市公安局交警支队标段 10 万元保证金超期 18 天未退",
        summary: "该标段已于 18 天前发布中标结果公告，已超过《政府采购法实施条例》法定 5 个工作日退还时限！",
        details: [
          { label: "应退金额", value: "¥100,000.00 元" },
          { label: "收款机构", value: "某某市政府采购代理中心" },
          { label: "开标时间", value: "2026-08-28" },
          { label: "维权依据", value: "财库〔2019〕38号文规范保函与退保时限" },
        ],
        actionUrl: "/deposits",
        urgent: false,
      },
      AUDIT: {
        eventType: "AUDIT",
        title: "【标书质检高危废标】市大数据标段送检文本检出 2 处一票否决致命隐患",
        summary: "投标文件智能清标引擎检测到「大写金额与小写矛盾」及「错写以往项目业主单位名称」，封标前必须修正！",
        details: [
          { label: "健康评分", value: "28分 (🔴 HIGH 极高风险)" },
          { label: "致命隐患 1", value: "大写壹佰贰拾万元与小写 1,250,000 元不一致" },
          { label: "致命隐患 2", value: "残留非本项目业主「市应急管理局」" },
          { label: "送检人", value: user.name || user.username },
        ],
        actionUrl: "/audit",
        urgent: true,
      },
      TENDER: {
        eventType: "TENDER",
        title: "【优质商机速递】某国家级综合保税区数字化卡口系统建设项目招标公告",
        summary: "高契合度新标讯推荐，预算规模匹配我方同类业绩，满足电子与智能化一级资质要求！",
        details: [
          { label: "采购单位", value: "综合保税区规划建设局" },
          { label: "控制价上限", value: "¥2,150.00 万元" },
          { label: "截标日期", value: "2026-10-08 10:00" },
          { label: "所属赛道", value: "系统集成 / 安防工程" },
        ],
        actionUrl: "/list",
        urgent: false,
      },
      TEST: {
        eventType: "TEST",
        title: "【测试消息】标讯通",
        summary: "测试验证",
        details: [],
        urgent: false,
      },
    };

    const payload = samplePayloads[eventType];
    const res = await dispatchBusinessWebhookEvent(user.uid, payload);
    revalidatePath("/webhooks");

    return {
      success: true,
      dispatchedCount: res.dispatchedCount,
      successCount: res.successCount,
    };
  } catch (err) {
    console.error("Failed to simulate event dispatch:", err);
    return { success: false, error: "模拟触发失败" };
  }
}
