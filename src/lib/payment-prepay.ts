import crypto from "node:crypto";
import type { Order } from "@prisma/client";

export type PaymentChannel = "wechat" | "alipay";

export type PrepayResult = {
  code: string;
  expiresAt: Date;
};

export class PaymentPrepayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentPrepayError";
  }
}

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;
  return `-----BEGIN PRIVATE KEY-----\n${trimmed.replace(/\s+/g, "")}\n-----END PRIVATE KEY-----\n`;
}

function privateKey(value: string | undefined): crypto.KeyObject {
  if (!value?.trim()) throw new PaymentPrepayError("支付商户私钥未配置");
  try {
    return crypto.createPrivateKey(normalizePrivateKey(value));
  } catch {
    throw new PaymentPrepayError("支付商户私钥格式无效");
  }
}

function cents(amount: Order["amount"]): number {
  return Math.round(Number(amount) * 100);
}

function twoHoursFromNow(): Date {
  return new Date(Date.now() + 2 * 60 * 60 * 1000);
}

function shanghaiTime(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(new Date()).replace(",", "");
}

async function createWechatNativePrepay(
  order: Pick<Order, "orderNo" | "amount">,
  description: string,
): Promise<PrepayResult> {
  const appId = process.env.WECHAT_PAY_APP_ID;
  const mchId = process.env.WECHAT_PAY_MCH_ID;
  const serial = process.env.WECHAT_PAY_MERCHANT_CERT_SERIAL;
  const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;
  if (!appId || !mchId || !serial || !notifyUrl) {
    throw new PaymentPrepayError("微信支付配置不完整");
  }

  const path = "/v3/pay/transactions/native";
  const body = JSON.stringify({
    appid: appId,
    mchid: mchId,
    description,
    out_trade_no: order.orderNo,
    notify_url: notifyUrl,
    amount: { total: cents(order.amount) },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .sign(
      "RSA-SHA256",
      Buffer.from(`POST\n${path}\n${timestamp}\n${nonce}\n${body}\n`, "utf8"),
      privateKey(process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY),
    )
    .toString("base64");
  const authorization =
    `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonce}",` +
    `signature="${signature}",timestamp="${timestamp}",serial_no="${serial}"`;

  const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "toubiao/1.0",
    },
    body,
  });
  const result = (await response.json().catch(() => null)) as { code_url?: unknown; message?: unknown } | null;
  if (!response.ok || typeof result?.code_url !== "string") {
    const detail = typeof result?.message === "string" ? `：${result.message}` : "";
    throw new PaymentPrepayError(`微信预下单失败${detail}`);
  }
  return { code: result.code_url, expiresAt: twoHoursFromNow() };
}

async function createAlipayPrecreate(
  order: Pick<Order, "orderNo" | "amount">,
  description: string,
): Promise<PrepayResult> {
  const appId = process.env.ALIPAY_APP_ID;
  const notifyUrl = process.env.ALIPAY_NOTIFY_URL;
  if (!appId || !notifyUrl) throw new PaymentPrepayError("支付宝配置不完整");

  const params: Record<string, string> = {
    app_id: appId,
    method: "alipay.trade.precreate",
    charset: "utf-8",
    timestamp: shanghaiTime(),
    version: "1.0",
    notify_url: notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: order.orderNo,
      total_amount: Number(order.amount).toFixed(2),
      subject: description,
    }),
  };
  const message = Object.keys(params)
    .filter((key) => params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  params.sign = crypto
    .sign("RSA-SHA256", Buffer.from(message, "utf8"), privateKey(process.env.ALIPAY_PRIVATE_KEY))
    .toString("base64");
  params.sign_type = "RSA2";

  const response = await fetch("https://openapi.alipay.com/gateway.do", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
  });
  const payload = (await response.json().catch(() => null)) as {
    alipay_trade_precreate_response?: {
      code?: unknown;
      msg?: unknown;
      qr_code?: unknown;
      sub_msg?: unknown;
    };
  } | null;
  const business = payload?.alipay_trade_precreate_response;
  if (!response.ok || business?.code !== "10000" || typeof business?.qr_code !== "string") {
    const detail =
      typeof business?.sub_msg === "string"
        ? `：${business.sub_msg}`
        : typeof business?.msg === "string"
          ? `：${business.msg}`
          : "";
    throw new PaymentPrepayError(`支付宝预下单失败${detail}`);
  }
  return { code: business.qr_code, expiresAt: twoHoursFromNow() };
}

export async function createPrepay(
  channel: PaymentChannel,
  order: Pick<Order, "orderNo" | "amount">,
  description: string,
): Promise<PrepayResult> {
  try {
    if (channel === "wechat") return await createWechatNativePrepay(order, description);
    return await createAlipayPrecreate(order, description);
  } catch (error) {
    if (error instanceof PaymentPrepayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PaymentPrepayError("支付渠道请求超时");
    }
    throw new PaymentPrepayError("支付渠道请求失败");
  }
}

export function isPrepayUsable(order: Pick<Order, "prepayCode" | "prepayExpiresAt">): boolean {
  return Boolean(order.prepayCode && order.prepayExpiresAt && order.prepayExpiresAt > new Date());
}
