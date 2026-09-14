import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  WEBHOOK_EVENT_METAS,
  type WebhookEventPayload,
} from "./webhook-types";

export * from "./webhook-types";

function getBaseAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

/**
 * 计算钉钉加签签名与 URL
 */
function buildDingtalkUrl(webhookUrl: string, secret?: string | null): string {
  if (!secret?.trim()) return webhookUrl;
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret.trim()}`;
  const sign = crypto
    .createHmac("sha256", secret.trim())
    .update(stringToSign)
    .digest("base64");
  const sep = webhookUrl.includes("?") ? "&" : "?";
  return `${webhookUrl}${sep}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
}

/**
 * 计算飞书加签签名
 */
function buildFeishuSign(secret?: string | null): { timestamp: string; sign: string } | null {
  if (!secret?.trim()) return null;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `${timestamp}\n${secret.trim()}`;
  const sign = crypto
    .createHmac("sha256", stringToSign)
    .update("")
    .digest("base64");
  return { timestamp, sign };
}

/**
 * 格式化企微 Markdown 消息体
 */
function formatWecomPayload(payload: WebhookEventPayload) {
  const meta = WEBHOOK_EVENT_METAS[payload.eventType];
  const appUrl = getBaseAppUrl();
  const targetUrl = payload.actionUrl?.startsWith("http")
    ? payload.actionUrl
    : `${appUrl}${payload.actionUrl || "/tracker"}`;

  const detailsText = payload.details
    .map((d) => `> **${d.label}**：<font color="comment">${d.value}</font>`)
    .join("\n");

  const headerEmoji = payload.urgent ? "🚨" : "🔔";
  const headerColor = payload.urgent ? "warning" : "info";

  const content = `### ${headerEmoji} <font color="${headerColor}">【标讯通·${meta.shortLabel}】</font>\n**${payload.title}**\n\n> 📋 **态势要点**：<font color="comment">${payload.summary}</font>\n${detailsText}\n\n---\n[👉 点击在标讯通中立即处置](${targetUrl}) · [⚙️ 推送配置中枢](${appUrl}/webhooks)`;

  return {
    msgtype: "markdown",
    markdown: { content },
  };
}

/**
 * 格式化钉钉 Markdown 消息体
 */
function formatDingtalkPayload(payload: WebhookEventPayload) {
  const meta = WEBHOOK_EVENT_METAS[payload.eventType];
  const appUrl = getBaseAppUrl();
  const targetUrl = payload.actionUrl?.startsWith("http")
    ? payload.actionUrl
    : `${appUrl}${payload.actionUrl || "/tracker"}`;

  const detailsText = payload.details
    .map((d) => `- **${d.label}**：${d.value}`)
    .join("\n");

  const headerEmoji = payload.urgent ? "🚨" : "🔔";
  const text = `### ${headerEmoji} 【标讯通·${meta.shortLabel}】${payload.title}\n\n**态势要点**：${payload.summary}\n\n${detailsText}\n\n---\n[👉 立即在标讯通中查看处置](${targetUrl})  |  [⚙️ 预警推送中枢](${appUrl}/webhooks)`;

  return {
    msgtype: "markdown",
    markdown: {
      title: `【标讯通·${meta.shortLabel}】${payload.title}`,
      text,
    },
  };
}

/**
 * 格式化飞书富文本卡片消息体
 */
function formatFeishuPayload(payload: WebhookEventPayload, secret?: string | null) {
  const meta = WEBHOOK_EVENT_METAS[payload.eventType];
  const appUrl = getBaseAppUrl();
  const targetUrl = payload.actionUrl?.startsWith("http")
    ? payload.actionUrl
    : `${appUrl}${payload.actionUrl || "/tracker"}`;

  const signInfo = buildFeishuSign(secret);

  const fields = payload.details.map((d) => ({
    is_short: true,
    text: {
      tag: "lark_md",
      content: `**${d.label}**\n${d.value}`,
    },
  }));

  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: payload.urgent ? "red" : "blue",
      title: {
        tag: "plain_text",
        content: `【标讯通·${meta.shortLabel}】${payload.title}`,
      },
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**📋 态势要点**：${payload.summary}`,
        },
      },
      {
        tag: "div",
        fields,
      },
      {
        tag: "hr",
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "在标讯通中立即处置",
            },
            type: payload.urgent ? "danger" : "primary",
            url: targetUrl,
          },
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "推送配置中枢",
            },
            type: "default",
            url: `${appUrl}/webhooks`,
          },
        ],
      },
    ],
  };

  return {
    ...(signInfo ? { timestamp: signInfo.timestamp, sign: signInfo.sign } : {}),
    msg_type: "interactive",
    card,
  };
}

/**
 * 格式化通用 Webhook JSON 消息体
 */
function formatGenericPayload(payload: WebhookEventPayload) {
  return {
    platform: "toubiao",
    version: "2.0",
    timestamp: new Date().toISOString(),
    event: payload.eventType,
    data: {
      title: payload.title,
      summary: payload.summary,
      urgent: Boolean(payload.urgent),
      details: payload.details,
      actionUrl: payload.actionUrl,
    },
  };
}

/**
 * 向单一 Webhook 终端执行投递，并测算网络耗时
 */
export async function sendToWebhookEndpoint(
  endpoint: {
    id: number;
    channel: string;
    webhookUrl: string;
    secret: string | null;
  },
  payload: WebhookEventPayload
): Promise<{ statusCode: number; latencyMs: number; success: boolean; error?: string }> {
  const start = Date.now();
  try {
    let targetUrl = endpoint.webhookUrl;
    let bodyObj: unknown;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Toubiao-Webhook-Dispatcher/2.0",
    };

    switch (endpoint.channel) {
      case "WECOM":
        bodyObj = formatWecomPayload(payload);
        break;
      case "DINGTALK":
        targetUrl = buildDingtalkUrl(endpoint.webhookUrl, endpoint.secret);
        bodyObj = formatDingtalkPayload(payload);
        break;
      case "FEISHU":
        bodyObj = formatFeishuPayload(payload, endpoint.secret);
        break;
      case "GENERIC":
      default: {
        bodyObj = formatGenericPayload(payload);
        if (endpoint.secret?.trim()) {
          const bodyStr = JSON.stringify(bodyObj);
          const hmac = crypto
            .createHmac("sha256", endpoint.secret.trim())
            .update(bodyStr)
            .digest("hex");
          headers["X-Hub-Signature-256"] = `sha256=${hmac}`;
        }
        break;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;
    const statusCode = res.status;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        statusCode,
        latencyMs,
        success: false,
        error: `HTTP ${statusCode}: ${errText.slice(0, 150)}`,
      };
    }

    // 解析平台返回的业务 errcode
    const json = (await res.json().catch(() => null)) as {
      errcode?: number;
      code?: number;
      StatusCode?: number;
      errmsg?: string;
      msg?: string;
    } | null;

    if (json) {
      const isErr =
        (json.errcode !== undefined && json.errcode !== 0) ||
        (json.code !== undefined && json.code !== 0) ||
        (json.StatusCode !== undefined && json.StatusCode !== 0);

      if (isErr) {
        return {
          statusCode,
          latencyMs,
          success: false,
          error: json.errmsg || json.msg || `返回业务错误代码: ${json.errcode || json.code}`,
        };
      }
    }

    return { statusCode, latencyMs, success: true };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 0,
      latencyMs,
      success: false,
      error: errorMsg.includes("abort") ? "请求超时(>8s)" : errorMsg.slice(0, 150),
    };
  }
}

/**
 * 业务事件智能路由分发总控
 * 自动查找该用户下所有启用了该事件类型的 WebhookEndpoint 并行投递并记录日志
 */
export async function dispatchBusinessWebhookEvent(
  userId: number,
  payload: WebhookEventPayload
): Promise<{ dispatchedCount: number; successCount: number }> {
  // 查询用户所有启用且订阅了该事件的终端
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      userId,
      enabled: true,
    },
  });

  const matchingEndpoints = endpoints.filter((ep) => {
    try {
      const evs = Array.isArray(ep.events)
        ? ep.events
        : typeof ep.events === "string"
        ? JSON.parse(ep.events)
        : [];
      return evs.includes(payload.eventType);
    } catch {
      return false;
    }
  });

  if (matchingEndpoints.length === 0) {
    return { dispatchedCount: 0, successCount: 0 };
  }

  let successCount = 0;

  // 并行投递
  await Promise.all(
    matchingEndpoints.map(async (ep) => {
      const res = await sendToWebhookEndpoint(ep, payload);
      if (res.success) successCount++;

      // 写入投递审计日志
      await prisma.webhookDeliveryLog.create({
        data: {
          endpointId: ep.id,
          eventType: payload.eventType,
          payloadSummary: `【${WEBHOOK_EVENT_METAS[payload.eventType].shortLabel}】${payload.title}`.slice(
            0,
            120
          ),
          statusCode: res.statusCode,
          latencyMs: res.latencyMs,
          success: res.success,
          error: res.error || null,
        },
      });
    })
  );

  return { dispatchedCount: matchingEndpoints.length, successCount };
}
