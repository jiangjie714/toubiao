import { getAppUrl } from "./mailer";

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WechatTemplateMsgResponse {
  errcode: number;
  errmsg: string;
  msgid?: number;
}

// 内存中缓存 AccessToken
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

export function getWechatMpConfig() {
  return {
    appId: process.env.WECHAT_MP_APPID || "",
    appSecret: process.env.WECHAT_MP_SECRET || "",
    templateId: process.env.WECHAT_MP_TEMPLATE_ID || "",
    lifecycleTemplateId: process.env.WECHAT_MP_LIFECYCLE_TEMPLATE_ID || process.env.WECHAT_MP_TEMPLATE_ID || "",
    isConfigured: Boolean(process.env.WECHAT_MP_APPID && process.env.WECHAT_MP_SECRET),
  };
}

/**
 * 获取微信服务号 AccessToken（带缓存与过期续订机制）
 */
export async function getWechatAccessToken(): Promise<string | null> {
  const config = getWechatMpConfig();
  if (!config.isConfigured) {
    return null;
  }

  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 60 * 1000) {
    return cachedAccessToken;
  }

  try {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`;
    const res = await fetch(url, { method: "GET" });
    const data = (await res.json()) as WechatTokenResponse;

    if (data.access_token && data.expires_in) {
      cachedAccessToken = data.access_token;
      tokenExpiresAt = now + data.expires_in * 1000;
      return cachedAccessToken;
    }

    console.error("[WeChat Service] 获取 AccessToken 失败:", data.errcode, data.errmsg);
    return null;
  } catch (err) {
    console.error("[WeChat Service] 请求微信 AccessToken 异常:", err);
    return null;
  }
}

export interface WechatTemplateItem {
  value: string;
  color?: string;
}

export interface SendTenderNotificationParams {
  openId: string;
  tenderId: number;
  title: string;
  typeLabel: string;
  purchaser: string;
  amountStr: string;
  publishDateStr: string;
  keywordMatched?: string;
}

/**
 * 发送新标讯商机通知（服务号模板消息）
 */
export async function sendTenderTemplateMessage(
  params: SendTenderNotificationParams,
): Promise<{ success: boolean; dryRun?: boolean; error?: string; msgid?: number }> {
  const config = getWechatMpConfig();
  const appUrl = getAppUrl();
  const targetUrl = `${appUrl}/tender/${params.tenderId}?from=wechat_mp`;

  const templateData: Record<string, WechatTemplateItem> = {
    first: {
      value: `🎯 标讯通商机速递：监控规则「${params.keywordMatched || "高优项目"}」命中新标讯！`,
      color: "#1e40af",
    },
    keyword1: { value: params.title, color: "#0f172a" },
    keyword2: { value: params.purchaser || "详见正文", color: "#475569" },
    keyword3: { value: params.amountStr, color: "#d97706" },
    keyword4: { value: params.publishDateStr, color: "#64748b" },
    remark: {
      value: "💡 点击卡片直接进入标讯通手机端查阅全文、附件与联系方式。",
      color: "#2563eb",
    },
  };

  if (!config.isConfigured || !config.templateId) {
    console.log(
      `[WeChat Service - DryRun] 微信服务号未配置真实密钥，模拟发送商机模板消息给 openId=${params.openId}:`,
      { title: params.title, targetUrl },
    );
    return { success: true, dryRun: true };
  }

  const token = await getWechatAccessToken();
  if (!token) {
    return { success: false, error: "获取微信接口 Token 失败" };
  }

  try {
    const sendUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`;
    const payload = {
      touser: params.openId,
      template_id: config.templateId,
      url: targetUrl,
      data: templateData,
    };

    const res = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await res.json()) as WechatTemplateMsgResponse;
    if (result.errcode === 0) {
      return { success: true, msgid: result.msgid };
    }

    return {
      success: false,
      error: `微信返回错误 [${result.errcode}]: ${result.errmsg}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface SendLifecycleAlertParams {
  openId: string;
  tenderId: number;
  title: string;
  alertType: "DEADLINE_48H" | "DEADLINE_24H" | "CHANGE_NOTICE" | "AWARD_RESULT";
  alertTitle: string;
  deadlineStr?: string;
  changeSummary?: string;
}

/**
 * 发送全生命周期变更/倒计时紧急预警通知
 */
export async function sendLifecycleAlertTemplateMessage(
  params: SendLifecycleAlertParams,
): Promise<{ success: boolean; dryRun?: boolean; error?: string }> {
  const config = getWechatMpConfig();
  const appUrl = getAppUrl();
  const targetUrl = `${appUrl}/tender/${params.tenderId}?from=lifecycle_alert`;

  const templateData: Record<string, WechatTemplateItem> = {
    first: {
      value: `⚠️ 标讯动态预警：${params.alertTitle}`,
      color: params.alertType === "DEADLINE_24H" ? "#dc2626" : "#ea580c",
    },
    keyword1: { value: params.title, color: "#0f172a" },
    keyword2: {
      value:
        params.deadlineStr ||
        (params.changeSummary ? `答疑更正: ${params.changeSummary}` : "请即刻关注"),
      color: "#dc2626",
    },
    remark: {
      value: "⏰ 请投标团队负责人即刻核查标书编制与保证金截留状态，点击进入详情。",
      color: "#2563eb",
    },
  };

  if (!config.isConfigured) {
    console.log(
      `[WeChat Service - DryRun] 模拟发送生命周期预警给 openId=${params.openId}:`,
      { alertTitle: params.alertTitle, tender: params.title },
    );
    return { success: true, dryRun: true };
  }

  const token = await getWechatAccessToken();
  if (!token) return { success: false, error: "获取 Token 失败" };

  try {
    const sendUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`;
    const payload = {
      touser: params.openId,
      template_id: config.lifecycleTemplateId || config.templateId,
      url: targetUrl,
      data: templateData,
    };

    const res = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await res.json()) as WechatTemplateMsgResponse;
    return {
      success: result.errcode === 0,
      error: result.errcode !== 0 ? result.errmsg : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
