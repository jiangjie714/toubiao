import assert from "node:assert";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseJeepayNotification } from "../src/lib/payments";
import { generateJeepaySign, verifyJeepaySign } from "../src/lib/jeepay";
import { POST } from "../src/app/api/payment/jeepay/notify/route";

console.log("=== Testing Jeepay Notification & Order Activation ===");

type MockOrder = {
  id: number;
  orderNo: string;
  userId: number;
  planId: number;
  billingCycle: string;
  amount: Prisma.Decimal;
  status: string;
  channel: string;
  paidAt?: Date;
  auditStatus?: string;
  auditAt?: Date;
  auditByUserId?: number;
  auditNote?: string;
  transactionNo?: string;
  plan?: { id: number; name: string };
};

type MockPaymentEvent = {
  id: number;
  provider: string;
  providerEventId: string;
  eventType: string;
  orderNo: string;
  status: string;
  payload: unknown;
  error?: string | null;
  processedAt?: Date | null;
  createdAt: Date;
};

type MockSubscription = {
  id: number;
  userId: number;
  planId: number;
  status: string;
  billingCycle: string;
  startsAt: Date;
  endsAt: Date;
  autoRenew: boolean;
};

async function main() {
  const testApiKey = "TEST_API_KEY_NOTIFICATION_123456";
  process.env.JEEPAY_PAY_URL = "http://127.0.0.1:9217";
  process.env.JEEPAY_MCH_NO = "M1623984572";
  process.env.JEEPAY_APP_ID = "60cc09bce4b0f1c0b83761c9";
  process.env.JEEPAY_API_KEY = testApiKey;

  // ----------------------------------------------------------------
  // Test 1: parseJeepayNotification 解析参数验证
  // ----------------------------------------------------------------
  console.log("\n[Test 1] 验证 parseJeepayNotification 参数解析...");
  const validParams = {
    mchOrderNo: "TB202610010001",
    payOrderId: "P202610019999",
    amount: "19900", // 单位：分
    state: 2, // 2: 支付成功
    currency: "cny",
    successTime: "1727712000000",
  };

  const parsed = parseJeepayNotification(validParams);
  assert(parsed !== null, "有效参数应成功解析为 PaymentNotification");
  assert.strictEqual(parsed.provider, "jeepay", "provider 应为 jeepay");
  assert.strictEqual(parsed.orderNo, "TB202610010001", "orderNo 解析正确");
  assert.strictEqual(parsed.transactionNo, "P202610019999", "transactionNo 解析正确");
  assert.strictEqual(parsed.providerEventId, "P202610019999", "providerEventId 解析正确");
  assert.strictEqual(parsed.paidAmount, 19900, "paidAmount 解析为分（数字）");
  assert.strictEqual(parsed.success, true, "state=2 时 success 必须为 true");
  assert(parsed.paidAt instanceof Date, "successTime 需解析为 Date 对象");

  // 测试 state: "2" 字符串兼容
  const parsedStringState = parseJeepayNotification({
    ...validParams,
    state: "2",
  });
  assert(parsedStringState !== null, "state 为字符串 '2' 时应成功解析");
  assert.strictEqual(parsedStringState.success, true, "state='2' 时 success 应为 true");

  // 测试支付失败状态 state: 3
  const parsedFailedState = parseJeepayNotification({
    ...validParams,
    state: 3,
  });
  assert(parsedFailedState !== null, "state 为 3 时依然能解析");
  assert.strictEqual(parsedFailedState.success, false, "state=3 时 success 应为 false");

  // 测试缺失必要字段
  const parsedInvalid = parseJeepayNotification({
    amount: "19900",
    state: 2,
  });
  assert.strictEqual(parsedInvalid, null, "缺失 mchOrderNo 时解析应返回 null");

  console.log("✓ Test 1: parseJeepayNotification 功能正常");

  // ----------------------------------------------------------------
  // Test 2: verifyJeepaySign 签名验证
  // ----------------------------------------------------------------
  console.log("\n[Test 2] 验证 verifyJeepaySign 签名验证...");
  const rawParams: Record<string, unknown> = {
    mchOrderNo: "TB202610010002",
    payOrderId: "P202610018888",
    amount: 29900,
    state: 2,
  };
  const validSign = generateJeepaySign(rawParams, testApiKey);
  assert.strictEqual(
    verifyJeepaySign({ ...rawParams, sign: validSign }, testApiKey),
    true,
    "正确签名应验证通过"
  );
  assert.strictEqual(
    verifyJeepaySign({ ...rawParams, sign: "INVALID_SIGN_1234567890ABCDEF" }, testApiKey),
    false,
    "错误签名应验证失败"
  );
  assert.strictEqual(
    verifyJeepaySign(rawParams, testApiKey),
    false,
    "缺少 sign 参数应验证失败"
  );
  console.log("✓ Test 2: verifyJeepaySign 验签功能正常");

  // ----------------------------------------------------------------
  // Test 3: 路由 POST Handler - 验签失败测试
  // ----------------------------------------------------------------
  console.log("\n[Test 3] 验证 Notify 路由在验签失败时返回 HTTP 400...");
  const invalidSignReq = new Request("http://localhost:3000/api/payment/jeepay/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mchOrderNo: "TB202610010003",
      amount: 19900,
      state: 2,
      sign: "BAD_SIGN_BAD_SIGN_BAD_SIGN_BAD_",
    }),
  });
  const invalidSignRes = await POST(invalidSignReq as unknown as NextRequest);
  assert.strictEqual(invalidSignRes.status, 400, "验签失败应返回 HTTP 400");
  const invalidSignBody = await invalidSignRes.text();
  assert.strictEqual(invalidSignBody, "FAIL", "验签失败应返回 FAIL");
  console.log("✓ Test 3: 验签失败处理正常 (HTTP 400 FAIL)");

  // ----------------------------------------------------------------
  // Test 4: 路由 POST Handler - 无效载荷测试
  // ----------------------------------------------------------------
  console.log("\n[Test 4] 验证 Notify 路由在载荷无效时返回 HTTP 400...");
  const emptyPayload: Record<string, unknown> = {
    randomField: "abc",
  };
  emptyPayload.sign = generateJeepaySign(emptyPayload, testApiKey);
  const invalidPayloadReq = new Request("http://localhost:3000/api/payment/jeepay/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(emptyPayload),
  });
  const invalidPayloadRes = await POST(invalidPayloadReq as unknown as NextRequest);
  assert.strictEqual(invalidPayloadRes.status, 400, "载荷缺失订单字段应返回 HTTP 400");
  const invalidPayloadBody = await invalidPayloadRes.text();
  assert.strictEqual(invalidPayloadBody, "INVALID_PAYLOAD", "载荷无效应返回 INVALID_PAYLOAD");
  console.log("✓ Test 4: 无效载荷处理正常 (HTTP 400 INVALID_PAYLOAD)");

  // ----------------------------------------------------------------
  // 准备内存模拟 Prisma 数据库支持 Test 5 和 Test 6
  // ----------------------------------------------------------------
  const orders = new Map<number, MockOrder>();
  const paymentEvents = new Map<string, MockPaymentEvent>();
  const subscriptions = new Map<number, MockSubscription>();
  let nextOrderId = 1;
  let nextEventId = 1;

  const mockPrisma = prisma as unknown as {
    order: {
      findUnique: (args: { where: { id?: number; orderNo?: string } }) => Promise<MockOrder | null>;
      update: (args: { where: { id: number }; data: Partial<MockOrder> }) => Promise<MockOrder>;
      create: (args: { data: Omit<MockOrder, "id"> }) => Promise<MockOrder>;
      deleteMany: () => Promise<{ count: number }>;
    };
    paymentEvent: {
      upsert: (args: {
        where: { provider_providerEventId: { provider: string; providerEventId: string } };
        update: Partial<MockPaymentEvent>;
        create: Omit<MockPaymentEvent, "id" | "createdAt">;
      }) => Promise<MockPaymentEvent>;
      update: (args: { where: { id: number }; data: Partial<MockPaymentEvent> }) => Promise<MockPaymentEvent>;
    };
    subscription: {
      findUnique: (args: { where: { userId: number } }) => Promise<MockSubscription | null>;
      upsert: (args: {
        where: { userId: number };
        update: Partial<MockSubscription>;
        create: Omit<MockSubscription, "id">;
      }) => Promise<MockSubscription>;
    };
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };

  mockPrisma.order.findUnique = async ({ where }) => {
    if (where.id) return orders.get(where.id) || null;
    if (where.orderNo) {
      for (const o of orders.values()) {
        if (o.orderNo === where.orderNo) return o;
      }
    }
    return null;
  };

  mockPrisma.order.update = async ({ where, data }) => {
    const existing = orders.get(where.id);
    if (!existing) throw new Error("Order not found: " + where.id);
    const updated: MockOrder = { ...existing, ...data };
    orders.set(where.id, updated);
    return updated;
  };

  mockPrisma.order.create = async ({ data }) => {
    const id = nextOrderId++;
    const created: MockOrder = {
      ...data,
      id,
      plan: { id: data.planId, name: "专业版月付" },
    };
    orders.set(id, created);
    return created;
  };

  mockPrisma.order.deleteMany = async () => ({ count: 0 });

  mockPrisma.paymentEvent.upsert = async ({ where, update, create }) => {
    const key = `${where.provider_providerEventId.provider}:${where.provider_providerEventId.providerEventId}`;
    const existing = paymentEvents.get(key);
    if (existing) {
      const updated: MockPaymentEvent = { ...existing, ...update };
      paymentEvents.set(key, updated);
      return updated;
    }
    const id = nextEventId++;
    const created: MockPaymentEvent = { ...create, id, createdAt: new Date() };
    paymentEvents.set(key, created);
    return created;
  };

  mockPrisma.paymentEvent.update = async ({ where, data }) => {
    for (const [k, v] of paymentEvents.entries()) {
      if (v.id === where.id) {
        const updated: MockPaymentEvent = { ...v, ...data };
        paymentEvents.set(k, updated);
        return updated;
      }
    }
    throw new Error("PaymentEvent not found: " + where.id);
  };

  mockPrisma.subscription.findUnique = async ({ where }) => {
    return subscriptions.get(where.userId) || null;
  };

  mockPrisma.subscription.upsert = async ({ where, update, create }) => {
    const existing = subscriptions.get(where.userId);
    const result: MockSubscription = existing
      ? { ...existing, ...update }
      : { id: 1, ...create };
    subscriptions.set(where.userId, result);
    return result;
  };

  mockPrisma.$transaction = async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    return fn(mockPrisma);
  };

  // ----------------------------------------------------------------
  // Test 5: 路由 POST Handler - 成功回调与订单激活 (JSON)
  // ----------------------------------------------------------------
  console.log("\n[Test 5] 验证 JSON 格式成功回调与订单自动核销激活...");
  const orderNo1 = `TB_JP_TEST_${Date.now()}_1`;
  const order1 = await mockPrisma.order.create({
    data: {
      orderNo: orderNo1,
      userId: 1,
      planId: 1,
      billingCycle: "monthly",
      amount: new Prisma.Decimal(199),
      status: "PENDING",
      channel: "jeepay",
    },
  });

  const notifyJsonData: Record<string, unknown> = {
    mchOrderNo: order1.orderNo,
    payOrderId: `P${Date.now()}001`,
    amount: 19900, // 199元 * 100分
    state: 2,
    currency: "cny",
    successTime: Date.now().toString(),
  };
  notifyJsonData.sign = generateJeepaySign(notifyJsonData, testApiKey);

  const successReqJson = new Request("http://localhost:3000/api/payment/jeepay/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notifyJsonData),
  });
  const successResJson = await POST(successReqJson as unknown as NextRequest);
  assert.strictEqual(successResJson.status, 200, "支付成功回调应返回 HTTP 200");
  const successBodyJson = await successResJson.text();
  assert.strictEqual(successBodyJson, "success", "支付成功回调应返回 success");

  // 验证订单状态已流转为 PAID
  const updatedOrder1 = await mockPrisma.order.findUnique({ where: { id: order1.id } });
  assert.strictEqual(updatedOrder1?.status, "PAID", "订单状态应流转为 PAID");

  // 验证幂等性：重复通知应再次返回 HTTP 200 success
  const duplicateReq = new Request("http://localhost:3000/api/payment/jeepay/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notifyJsonData),
  });
  const duplicateRes = await POST(duplicateReq as unknown as NextRequest);
  assert.strictEqual(duplicateRes.status, 200, "重复通知应幂等返回 HTTP 200");
  const duplicateBody = await duplicateRes.text();
  assert.strictEqual(duplicateBody, "success", "重复通知应返回 success");
  console.log("✓ Test 5: JSON 格式通知与订单自动核销 (含幂等) 成功");

  // ----------------------------------------------------------------
  // Test 6: 路由 POST Handler - 表单格式 (x-www-form-urlencoded) & 跨渠道匹配
  // ----------------------------------------------------------------
  console.log("\n[Test 6] 验证 application/x-www-form-urlencoded 表单通知及 channel=wechat 渠道匹配...");
  const orderNo2 = `TB_JP_TEST_${Date.now()}_2`;
  // 测试 order.channel 为 wechat，而回调 provider 为 jeepay 的场景兼容
  const order2 = await mockPrisma.order.create({
    data: {
      orderNo: orderNo2,
      userId: 1,
      planId: 1,
      billingCycle: "monthly",
      amount: new Prisma.Decimal(299),
      status: "PENDING",
      channel: "wechat",
    },
  });

  const notifyFormData: Record<string, unknown> = {
    mchOrderNo: order2.orderNo,
    payOrderId: `P${Date.now()}002`,
    amount: "29900", // 表单中常为字符串
    state: "2",
    currency: "cny",
    successTime: Date.now().toString(),
  };
  notifyFormData.sign = generateJeepaySign(notifyFormData, testApiKey);

  const formBody = new URLSearchParams();
  for (const [k, v] of Object.entries(notifyFormData)) {
    formBody.set(k, String(v));
  }

  const successReqForm = new Request("http://localhost:3000/api/payment/jeepay/notify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });
  const successResForm = await POST(successReqForm as unknown as NextRequest);
  assert.strictEqual(successResForm.status, 200, "表单格式通知应返回 HTTP 200");
  const successBodyForm = await successResForm.text();
  assert.strictEqual(successBodyForm, "success", "表单格式通知应返回 success");

  const updatedOrder2 = await mockPrisma.order.findUnique({ where: { id: order2.id } });
  assert.strictEqual(updatedOrder2?.status, "PAID", "渠道为 wechat 的订单由 jeepay 支付后状态应为 PAID");
  console.log("✓ Test 6: 表单格式通知及跨渠道匹配激活成功");

  console.log("\n=========================================");
  console.log("🎉 全部 6 项 Jeepay 通知测试均通过！");
  console.log("=========================================\n");
}

main().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
