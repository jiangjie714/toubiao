import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { activatePaidOrder } from "./commerce";

export type PaymentProvider = "alipay" | "wechat" | "jeepay";

export type PaymentNotification = {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  orderNo: string;
  transactionNo: string;
  paidAmount: number;
  paidAt: Date | null;
  success: boolean;
  payload: Record<string, unknown>;
};

export type ProcessPaymentResult = {
  accepted: boolean;
  duplicate: boolean;
  reason?: string;
};

function normalizePem(value: string, label: "PUBLIC KEY" | "CERTIFICATE"): string {
  const trimmed = value.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

function publicKeyOrCertificate(
  value: string | undefined,
  label: "PUBLIC KEY" | "CERTIFICATE",
): crypto.KeyObject | null {
  if (!value?.trim()) return null;
  try {
    return crypto.createPublicKey(normalizePem(value, label));
  } catch {
    return null;
  }
}

export function verifyAlipayNotification(params: Record<string, string>): boolean {
  const signature = params.sign;
  const publicKey = publicKeyOrCertificate(
    process.env.ALIPAY_PUBLIC_KEY ?? process.env.ALIPAY_PUBLIC_CERT,
    "PUBLIC KEY",
  );
  if (!signature || !publicKey) return false;

  const message = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.verify(
    "RSA-SHA256",
    Buffer.from(message, "utf8"),
    publicKey,
    Buffer.from(signature, "base64"),
  );
}

export function verifyWechatNotification(
  headers: Record<string, string | null>,
  rawBody: string,
): boolean {
  const signature = headers["wechatpay-signature"];
  const timestamp = headers["wechatpay-timestamp"];
  const nonce = headers["wechatpay-nonce"];
  const serial = headers["wechatpay-serial"];
  const expectedSerial = process.env.WECHAT_PAY_PLATFORM_CERT_SERIAL;
  if (!signature || !timestamp || !nonce) return false;
  if (expectedSerial && serial !== expectedSerial) return false;

  const publicKey = publicKeyOrCertificate(
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY ?? process.env.WECHAT_PAY_PLATFORM_CERT,
    "CERTIFICATE",
  );
  if (!publicKey) return false;

  const message = Buffer.from(`${timestamp}\n${nonce}\n${rawBody}\n`, "utf8");
  return crypto.verify(
    "RSA-SHA256",
    message,
    publicKey,
    Buffer.from(signature, "base64"),
  );
}

export function parseAlipayNotification(params: Record<string, string>): PaymentNotification | null {
  const orderNo = params.out_trade_no;
  const transactionNo = params.trade_no;
  const providerEventId = params.notify_id;
  if (!orderNo || !transactionNo || !providerEventId) return null;

  const amount = Number(params.total_amount);
  if (!Number.isFinite(amount)) return null;
  const tradeStatus = params.trade_status ?? "";
  const paidAt = params.gmt_payment ? new Date(params.gmt_payment) : null;
  return {
    provider: "alipay",
    providerEventId,
    eventType: tradeStatus,
    orderNo,
    transactionNo,
    paidAmount: Math.round(amount * 100),
    paidAt: paidAt && !isNaN(paidAt.getTime()) ? paidAt : null,
    success: tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED",
    payload: params,
  };
}

export function parseWechatNotification(
  rawBody: string,
  decryptedResource: Record<string, unknown>,
): PaymentNotification | null {
  let envelope: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    envelope = parsed;
  } catch {
    return null;
  }

  const providerEventId = envelope.id;
  const eventType = envelope.event_type;
  if (typeof providerEventId !== "string" || typeof eventType !== "string") return null;

  const orderNo = decryptedResource.out_trade_no;
  const transactionNo = decryptedResource.transaction_id;
  const tradeState = decryptedResource.trade_state;
  const amountValue = (decryptedResource.amount as { total?: unknown } | undefined)?.total;
  if (
    typeof orderNo !== "string" ||
    typeof transactionNo !== "string" ||
    typeof tradeState !== "string" ||
    typeof amountValue !== "number"
  ) {
    return null;
  }

  const successTime = decryptedResource.success_time;
  const paidAt = typeof successTime === "string" ? new Date(successTime) : null;
  return {
    provider: "wechat",
    providerEventId,
    eventType,
    orderNo,
    transactionNo,
    paidAmount: amountValue,
    paidAt: paidAt && !isNaN(paidAt.getTime()) ? paidAt : null,
    success: eventType === "TRANSACTION.SUCCESS" && tradeState === "SUCCESS",
    payload: { envelope, resource: decryptedResource },
  };
}

export function parseJeepayNotification(
  params: Record<string, unknown>,
): PaymentNotification | null {
  const orderNo = String(params.mchOrderNo ?? "").trim();
  const transactionNo = String(params.payOrderId ?? "").trim();
  const providerEventId = String(params.payOrderId || params.mchOrderNo || "").trim();
  if (!orderNo || !providerEventId) return null;

  const state = Number(params.state);
  const amount = Number(params.amount);
  if (!Number.isFinite(amount)) return null;

  const success = state === 2;
  let paidAt: Date | null = null;
  if (params.successTime) {
    const parsedDate = new Date(Number(params.successTime) || String(params.successTime));
    paidAt = !isNaN(parsedDate.getTime()) ? parsedDate : null;
  }

  return {
    provider: "jeepay",
    providerEventId,
    eventType: String(params.state ?? ""),
    orderNo,
    transactionNo,
    paidAmount: Math.round(amount),
    paidAt,
    success,
    payload: params,
  };
}

export function decryptWechatResource(rawBody: string): Record<string, unknown> | null {
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
  if (!apiV3Key || apiV3Key.length !== 32) return null;

  let resource: { ciphertext?: unknown; nonce?: unknown; associated_data?: unknown };
  try {
    const body = JSON.parse(rawBody) as { resource?: unknown };
    if (!body.resource || typeof body.resource !== "object") return null;
    resource = body.resource as typeof resource;
  } catch {
    return null;
  }
  if (typeof resource.ciphertext !== "string" || typeof resource.nonce !== "string") return null;

  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  if (ciphertext.length <= 28) return null;
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(apiV3Key, "utf8"),
      Buffer.from(resource.nonce, "utf8"),
    );
    decipher.setAuthTag(authTag);
    if (typeof resource.associated_data === "string") {
      decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
    }
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

export async function processPaymentNotification(
  notification: PaymentNotification,
): Promise<ProcessPaymentResult> {
  const payload = notification.payload as Prisma.InputJsonValue;
  const event = await prisma.paymentEvent.upsert({
    where: {
      provider_providerEventId: {
        provider: notification.provider,
        providerEventId: notification.providerEventId,
      },
    },
    update: {
      eventType: notification.eventType,
      orderNo: notification.orderNo,
      status: "RECEIVED",
      payload,
      error: null,
    },
    create: {
      provider: notification.provider,
      providerEventId: notification.providerEventId,
      eventType: notification.eventType,
      orderNo: notification.orderNo,
      status: "RECEIVED",
      payload,
    },
  });

  if (event.processedAt) {
    return { accepted: true, duplicate: true };
  }

  const order = await prisma.order.findUnique({ where: { orderNo: notification.orderNo } });
  if (!order) {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: "订单不存在" },
    });
    return { accepted: false, duplicate: false, reason: "ORDER_NOT_FOUND" };
  }
  const channelMatched =
    notification.provider === "jeepay"
      ? order.channel === "jeepay" || order.channel === "wechat" || order.channel === "alipay"
      : order.channel === notification.provider;
  if (!channelMatched) {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: "支付渠道不匹配" },
    });
    return { accepted: false, duplicate: false, reason: "CHANNEL_MISMATCH" };
  }
  if (order.status === "PAID") {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date(), error: null },
    });
    return { accepted: true, duplicate: true };
  }
  if (order.status !== "PENDING") {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: `订单状态不可支付：${order.status}` },
    });
    return { accepted: false, duplicate: false, reason: "ORDER_NOT_PAYABLE" };
  }
  if (!notification.success) {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: `支付状态未成功：${notification.eventType}` },
    });
    return { accepted: false, duplicate: false, reason: "PAYMENT_NOT_SUCCESS" };
  }
  const expectedAmount = Math.round(Number(order.amount) * 100);
  if (notification.paidAmount !== expectedAmount) {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        error: `支付金额不匹配：${notification.paidAmount} / ${expectedAmount}`,
      },
    });
    return { accepted: false, duplicate: false, reason: "AMOUNT_MISMATCH" };
  }

  const activated = await activatePaidOrder(order.id, {
    transactionNo: notification.transactionNo,
    paidAt: notification.paidAt ?? undefined,
  });
  if (!activated) {
    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: "订单激活失败" },
    });
    return { accepted: false, duplicate: false, reason: "ACTIVATION_FAILED" };
  }

  await prisma.paymentEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSED", processedAt: new Date(), error: null },
  });
  return { accepted: true, duplicate: false };
}

/** 为订单分配 4 位数字附言识别码（1000-9999），避免未支付订单之间碰撞 */
export async function allocateMatchingCode(orderNo: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < orderNo.length; i++) {
    hash = (hash * 31 + orderNo.charCodeAt(i)) % 9000;
  }
  let candidate = String(1000 + Math.abs(hash));
  let attempts = 0;
  while (attempts < 15) {
    const existing = await prisma.order.findFirst({
      where: {
        matchingCode: candidate,
        status: { in: ["PENDING", "WAIT_VERIFY"] },
        NOT: { orderNo },
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = String(1000 + ((Number(candidate) - 1000 + 37) % 9000));
    attempts++;
  }
  return candidate;
}

const AUDIT_SECRET = process.env.AUTH_SECRET || "toubiao_audit_token_secret_key_2026";

/** 生成管理员移动端免密一键审核放行的 HMAC-SHA256 Token（默认 24 小时有效） */
export function generateAuditToken(orderNo: string, expiresInSeconds: number = 86400): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${orderNo}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", AUDIT_SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${hmac}`;
}

/** 校验管理员移动端免密一键审核放行的 Token */
export function verifyAuditToken(token: string, expectedOrderNo: string): boolean {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const [orderNo, expiresAtStr] = payload.split(":");
    if (orderNo !== expectedOrderNo) return false;
    const expiresAt = Number(expiresAtStr);
    if (!expiresAt || expiresAt < Math.floor(Date.now() / 1000)) return false;
    const expectedHmac = crypto.createHmac("sha256", AUDIT_SECRET).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}

