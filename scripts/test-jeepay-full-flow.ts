import Module from "node:module";
import assert from "node:assert";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// 拦截 server-only 与 next/cache 避免在脚本独立执行时报错
const origLoad = (
  Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;

(
  Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  if (request === "next/cache") {
    return {
      revalidatePath: () => {},
      revalidateTag: () => {},
    };
  }
  return origLoad.apply(this, [request, parent, isMain]);
};

import { prisma } from "../src/lib/prisma";
import { createPrepay } from "../src/lib/payment-prepay";
import { generateJeepaySign, verifyJeepaySign } from "../src/lib/jeepay";
import { POST } from "../src/app/api/payment/jeepay/notify/route";

console.log("==================================================================");
console.log("  Task 7: Jeepay 全链路端到端自动化测试 (E2E Full Flow Test)");
console.log("==================================================================\n");

// -----------------------------------------------------------------------------
// 类型定义与 Mock 数据库支持（支持真实 PG 连接，并在离线/沙箱环境无缝回退内存模拟）
// -----------------------------------------------------------------------------
type MockUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  passwordHash: string;
};

type MockPlan = {
  id: number;
  code: string;
  name: string;
  priceMonthly: Prisma.Decimal;
  priceYearly: Prisma.Decimal;
  active: boolean;
};

type MockOrder = {
  id: number;
  orderNo: string;
  userId: number;
  planId: number;
  billingCycle: string;
  amount: Prisma.Decimal;
  status: string;
  channel: string;
  transactionNo?: string | null;
  prepayCode?: string | null;
  prepayExpiresAt?: Date | null;
  paidAt?: Date | null;
  auditStatus?: string;
  auditAt?: Date | null;
  auditByUserId?: number | null;
  auditNote?: string | null;
  matchingCode?: string | null;
  plan?: MockPlan;
};

type MockSubscription = {
  id: number;
  userId: number;
  planId: number;
  status: string;
  billingCycle: string;
  startsAt: Date;
  endsAt: Date | null;
  autoRenew: boolean;
  plan?: MockPlan;
};

type MockPaymentEvent = {
  id: number;
  provider: string;
  providerEventId: string;
  eventType?: string | null;
  orderNo?: string | null;
  status: string;
  payload: unknown;
  receivedAt: Date;
  processedAt?: Date | null;
  error?: string | null;
};

async function main() {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  const testApiKey = "TEST_API_KEY_E2E_FULL_FLOW_123456";
  const mchNo = "M1623984572";
  const appId = "60cc09bce4b0f1c0b83761c9";
  const mockPayUrl = "http://127.0.0.1:9217";

  // 配置环境变量指向本地模拟网关
  process.env.JEEPAY_PAY_URL = mockPayUrl;
  process.env.JEEPAY_MCH_NO = mchNo;
  process.env.JEEPAY_APP_ID = appId;
  process.env.JEEPAY_API_KEY = testApiKey;
  process.env.JEEPAY_NOTIFY_URL = "http://127.0.0.1:3000/api/payment/jeepay/notify";
  process.env.JEEPAY_RETURN_URL = "http://127.0.0.1:3000/pricing";

  // ---------------------------------------------------------------------------
  // 步骤 1: 模拟本地 Jeepay 网关响应 (统一统一下单与查单逻辑，校验 MD5 签名)
  // ---------------------------------------------------------------------------
  console.log("[Step 1] 启动本地 Jeepay 模拟网关 (HTTP Gateway Simulator)...");

  const mockGatewayOrders = new Map<
    string,
    {
      mchOrderNo: string;
      payOrderId: string;
      amount: number;
      orderState: number; // 1: 支付中, 2: 支付成功
      wayCode?: string;
      paidAt?: Date;
    }
  >();

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    // 统一下单接口
    if (urlStr.includes("/api/pay/unifiedOrder")) {
      const payload = JSON.parse(String(init?.body || "{}"));
      const mchOrderNo = String(payload.mchOrderNo || "");
      const amount = Number(payload.amount || 0);
      const wayCode = String(payload.wayCode || "WX_NATIVE");
      const payOrderId = `P_E2E_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // 验证网关收到请求的 MD5 签名
      assert(
        verifyJeepaySign(payload, testApiKey),
        "网关收到的统一下单请求签名必须通过验签",
      );

      mockGatewayOrders.set(mchOrderNo, {
        mchOrderNo,
        payOrderId,
        amount,
        orderState: 1, // 初始为待支付状态
        wayCode,
      });

      const payData =
        wayCode === "ALI_QR"
          ? `https://qr.alipay.com/bax_${mchOrderNo}`
          : wayCode === "QR_CASHIER"
          ? `http://127.0.0.1:9217/cashier/pay?id=${payOrderId}`
          : `weixin://wxpay/bizpayurl?pr=${mchOrderNo}`;

      return new Response(
        JSON.stringify({
          code: 0,
          msg: "SUCCESS",
          data: {
            payOrderId,
            mchOrderNo,
            orderState: 1,
            payDataType: wayCode === "ALI_QR" ? "payUrl" : "codeUrl",
            payData,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 查单接口
    if (urlStr.includes("/api/pay/query")) {
      const payload = JSON.parse(String(init?.body || "{}"));
      const mchOrderNo = String(payload.mchOrderNo || "");

      // 验证网关收到查单请求的 MD5 签名
      assert(
        verifyJeepaySign(payload, testApiKey),
        "网关收到的查单请求签名必须通过验签",
      );

      const found = mockGatewayOrders.get(mchOrderNo);
      if (!found) {
        return new Response(
          JSON.stringify({ code: 5013, msg: "订单不存在" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          code: 0,
          msg: "SUCCESS",
          data: {
            payOrderId: found.payOrderId,
            mchOrderNo: found.mchOrderNo,
            orderState: found.orderState,
            amount: found.amount,
            currency: "cny",
            ...(found.orderState === 2
              ? { successTime: String((found.paidAt ?? new Date()).getTime()) }
              : {}),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return originalFetch(url, init);
  }) as typeof fetch;

  console.log(`✓ Jeepay Mock 网关已成功就绪: ${mockPayUrl}`);

  // ---------------------------------------------------------------------------
  // 步骤 2: 数据库准备（检查真实 PG 连通性，若未启动则自适应搭载高拟真内存模拟）
  // ---------------------------------------------------------------------------
  console.log("\n[Step 2] 初始化数据库连接并创建测试用户与套餐...");

  let isConnectedToLiveDb = false;
  try {
    await prisma.$connect();
    await prisma.user.count();
    isConnectedToLiveDb = true;
    console.log("✓ 检测到真实 PostgreSQL 数据库正在运行，使用真实数据库执行测试");
  } catch {
    console.log("ℹ 本地 PostgreSQL 未启动，自动启用与 Prisma 规范严格一致的高拟真内存存储");
    isConnectedToLiveDb = false;
  }

  // 内存存储集合
  const memUsers = new Map<number, MockUser>();
  const memPlans = new Map<number, MockPlan>();
  const memOrders = new Map<number, MockOrder>();
  const memSubscriptions = new Map<number, MockSubscription>();
  const memPaymentEvents = new Map<string, MockPaymentEvent>();

  let nextUserId = 1001;
  let nextPlanId = 1;
  let nextOrderId = 5001;
  let nextSubId = 2001;
  let nextEventId = 3001;

  const defaultPlan: MockPlan = {
    id: nextPlanId++,
    code: "PRO",
    name: "专业版月付",
    priceMonthly: new Prisma.Decimal("199.00"),
    priceYearly: new Prisma.Decimal("1990.00"),
    active: true,
  };
  memPlans.set(defaultPlan.id, defaultPlan);

  if (!isConnectedToLiveDb) {
    const mockPrisma = prisma as unknown as {
      user: {
        create: (args: { data: Omit<MockUser, "id"> }) => Promise<MockUser>;
        findFirst: (args?: { where?: Partial<MockUser> }) => Promise<MockUser | null>;
        findUnique: (args: { where: { id?: number; username?: string } }) => Promise<MockUser | null>;
        deleteMany: (args?: { where?: { id?: { in?: number[] } | number } }) => Promise<{ count: number }>;
      };
      plan: {
        findFirst: () => Promise<MockPlan | null>;
        findUnique: (args: { where: { id?: number; code?: string } }) => Promise<MockPlan | null>;
        create: (args: { data: Omit<MockPlan, "id"> }) => Promise<MockPlan>;
      };
      order: {
        create: (args: { data: Omit<MockOrder, "id"> }) => Promise<MockOrder>;
        findUnique: (args: { where: { id?: number; orderNo?: string }; include?: Record<string, boolean> }) => Promise<MockOrder | null>;
        findFirst: (args: { where: Partial<MockOrder> }) => Promise<MockOrder | null>;
        update: (args: { where: { id: number }; data: Partial<MockOrder> }) => Promise<MockOrder>;
        deleteMany: (args?: { where?: { id?: { in?: number[] } | number } }) => Promise<{ count: number }>;
      };
      subscription: {
        findUnique: (args: { where: { userId: number }; include?: Record<string, boolean> }) => Promise<MockSubscription | null>;
        upsert: (args: {
          where: { userId: number };
          update: Partial<MockSubscription>;
          create: Omit<MockSubscription, "id">;
        }) => Promise<MockSubscription>;
        deleteMany: (args?: { where?: { userId?: { in?: number[] } | number } }) => Promise<{ count: number }>;
      };
      paymentEvent: {
        upsert: (args: {
          where: { provider_providerEventId: { provider: string; providerEventId: string } };
          update: Partial<MockPaymentEvent>;
          create: Omit<MockPaymentEvent, "id" | "receivedAt">;
        }) => Promise<MockPaymentEvent>;
        update: (args: { where: { id: number }; data: Partial<MockPaymentEvent> }) => Promise<MockPaymentEvent>;
        deleteMany: (args?: { where?: { orderNo?: { in?: string[] } | string } }) => Promise<{ count: number }>;
      };
      $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
    };

    mockPrisma.user.create = async ({ data }) => {
      const user: MockUser = { ...data, id: nextUserId++ };
      memUsers.set(user.id, user);
      return user;
    };
    mockPrisma.user.findFirst = async () => memUsers.values().next().value || null;
    mockPrisma.user.findUnique = async ({ where }) => {
      if (where.id) return memUsers.get(where.id) || null;
      if (where.username) {
        for (const u of memUsers.values()) {
          if (u.username === where.username) return u;
        }
      }
      return null;
    };
    mockPrisma.user.deleteMany = async ({ where } = {}) => {
      let count = 0;
      if (where?.id && typeof where.id === "object" && "in" in where.id && Array.isArray(where.id.in)) {
        for (const id of where.id.in) {
          if (memUsers.delete(id)) count++;
        }
      } else if (typeof where?.id === "number") {
        if (memUsers.delete(where.id)) count++;
      }
      return { count };
    };

    mockPrisma.plan.findFirst = async () => defaultPlan;
    mockPrisma.plan.findUnique = async ({ where }) => {
      if (where.id) return memPlans.get(where.id) || null;
      if (where.code) {
        for (const p of memPlans.values()) {
          if (p.code === where.code) return p;
        }
      }
      return null;
    };

    mockPrisma.order.create = async ({ data }) => {
      const order: MockOrder = {
        ...data,
        id: nextOrderId++,
        plan: memPlans.get(data.planId) || defaultPlan,
      };
      memOrders.set(order.id, order);
      return order;
    };
    mockPrisma.order.findUnique = async ({ where }) => {
      if (where.id) return memOrders.get(where.id) || null;
      if (where.orderNo) {
        for (const o of memOrders.values()) {
          if (o.orderNo === where.orderNo) {
            return { ...o, plan: memPlans.get(o.planId) || defaultPlan };
          }
        }
      }
      return null;
    };
    mockPrisma.order.update = async ({ where, data }) => {
      const existing = memOrders.get(where.id);
      if (!existing) throw new Error("Order not found: " + where.id);
      const updated: MockOrder = { ...existing, ...data };
      memOrders.set(where.id, updated);
      return updated;
    };
    mockPrisma.order.deleteMany = async ({ where } = {}) => {
      let count = 0;
      if (where?.id && typeof where.id === "object" && "in" in where.id && Array.isArray(where.id.in)) {
        for (const id of where.id.in) {
          if (memOrders.delete(id)) count++;
        }
      } else if (typeof where?.id === "number") {
        if (memOrders.delete(where.id)) count++;
      }
      return { count };
    };

    mockPrisma.subscription.findUnique = async ({ where }) => {
      const sub = memSubscriptions.get(where.userId);
      if (!sub) return null;
      return { ...sub, plan: memPlans.get(sub.planId) || defaultPlan };
    };
    mockPrisma.subscription.upsert = async ({ where, update, create }) => {
      const existing = memSubscriptions.get(where.userId);
      const saved: MockSubscription = existing
        ? { ...existing, ...update }
        : { id: nextSubId++, ...create };
      memSubscriptions.set(where.userId, saved);
      return saved;
    };
    mockPrisma.subscription.deleteMany = async ({ where } = {}) => {
      let count = 0;
      if (typeof where?.userId === "number") {
        if (memSubscriptions.delete(where.userId)) count++;
      }
      return { count };
    };

    mockPrisma.paymentEvent.upsert = async ({ where, update, create }) => {
      const key = `${where.provider_providerEventId.provider}:${where.provider_providerEventId.providerEventId}`;
      const existing = memPaymentEvents.get(key);
      if (existing) {
        const updated: MockPaymentEvent = { ...existing, ...update };
        memPaymentEvents.set(key, updated);
        return updated;
      }
      const createdEvent: MockPaymentEvent = {
        ...create,
        id: nextEventId++,
        receivedAt: new Date(),
      };
      memPaymentEvents.set(key, createdEvent);
      return createdEvent;
    };
    mockPrisma.paymentEvent.update = async ({ where, data }) => {
      for (const [k, v] of memPaymentEvents.entries()) {
        if (v.id === where.id) {
          const updated: MockPaymentEvent = { ...v, ...data };
          memPaymentEvents.set(k, updated);
          return updated;
        }
      }
      throw new Error("PaymentEvent not found: " + where.id);
    };
    mockPrisma.paymentEvent.deleteMany = async ({ where } = {}) => {
      let count = 0;
      if (where?.orderNo && typeof where.orderNo === "object" && "in" in where.orderNo && Array.isArray(where.orderNo.in)) {
        for (const [k, v] of Array.from(memPaymentEvents.entries())) {
          if (v.orderNo && where.orderNo.in.includes(v.orderNo)) {
            memPaymentEvents.delete(k);
            count++;
          }
        }
      }
      return { count };
    };

    mockPrisma.$transaction = async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return fn(mockPrisma);
    };
  }

  // 获取或创建测试套餐
  let targetPlan = await prisma.plan.findFirst();
  if (!targetPlan) {
    targetPlan = await prisma.plan.create({
      data: {
        code: "PRO",
        name: "专业版月付",
        priceMonthly: new Prisma.Decimal("199.00"),
        priceYearly: new Prisma.Decimal("1990.00"),
        features: {},
        active: true,
      },
    });
  }

  // 创建测试用户与测试订单
  const testUsername = `e2e_user_${Date.now()}`;
  const testUser = await prisma.user.create({
    data: {
      username: testUsername,
      name: "Jeepay全链路测试用户",
      role: "USER",
      passwordHash: "mock_password_hash_123456",
    },
  });

  const testOrderNo1 = `TB_E2E_${Date.now()}_1`;
  const testOrder1 = await prisma.order.create({
    data: {
      orderNo: testOrderNo1,
      userId: testUser.id,
      planId: targetPlan.id,
      billingCycle: "monthly",
      amount: new Prisma.Decimal("199.00"),
      status: "PENDING",
      channel: "wechat",
    },
  });

  console.log(`✓ 测试实体已就绪: 用户ID=${testUser.id} (${testUser.username}), 订单1=${testOrder1.orderNo}, 金额=¥${testOrder1.amount}`);

  try {
    // -------------------------------------------------------------------------
    // 步骤 3: 验证 createPrepay 预下单微信与支付宝渠道
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] 验证 createPrepay 适配层统一下单 (微信 WX_NATIVE / 支付宝 ALI_QR)...");

    // 3.1 微信支付预下单
    const prepayWechat = await createPrepay("wechat", testOrder1, "标讯通会员月付");
    assert(
      prepayWechat.code.startsWith("weixin://wxpay/bizpayurl?pr="),
      `微信预下单返回码应为 weixin 协议二维码串，实际为: ${prepayWechat.code}`,
    );
    assert(
      prepayWechat.expiresAt > new Date(),
      "微信预下单二维码过期时间必须大于当前时间",
    );

    const gatewayOrderWx = mockGatewayOrders.get(testOrder1.orderNo);
    assert(gatewayOrderWx !== undefined, "Mock 网关应收到微信下单记录");
    assert.strictEqual(gatewayOrderWx?.wayCode, "WX_NATIVE", "微信下单 wayCode 必须为 WX_NATIVE");
    assert.strictEqual(gatewayOrderWx?.amount, 19900, "订单金额必须换算为分 (19900)");
    console.log("✓ 3.1: 微信 (WX_NATIVE) 预下单接口交互与二维码获取验证通过");

    // 3.2 支付宝预下单
    const prepayAlipay = await createPrepay("alipay", testOrder1, "标讯通会员月付");
    assert(
      prepayAlipay.code.startsWith("https://qr.alipay.com/bax_"),
      `支付宝预下单返回码应为支付宝 payUrl 链接，实际为: ${prepayAlipay.code}`,
    );
    const gatewayOrderAli = mockGatewayOrders.get(testOrder1.orderNo);
    assert.strictEqual(gatewayOrderAli?.wayCode, "ALI_QR", "支付宝下单 wayCode 必须为 ALI_QR");
    console.log("✓ 3.2: 支付宝 (ALI_QR) 预下单接口交互与支付链接获取验证通过");

    // -------------------------------------------------------------------------
    // 步骤 4: 验证主动查单双保险同步 (syncOrderStatusFromJeepay)
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] 验证主动查单状态同步机制 (syncOrderStatusFromJeepay)...");
    const { syncOrderStatusFromJeepay } = await import("../src/app/actions/payments");

    // 4.1 此时网关订单状态为 1 (支付中)，查单应返回 false，且数据库状态保持 PENDING
    const syncResPending = await syncOrderStatusFromJeepay(testOrder1.orderNo);
    assert.strictEqual(syncResPending, false, "网关未支付时主动查单应返回 false");

    const order1Pending = await prisma.order.findUnique({ where: { id: testOrder1.id } });
    assert.strictEqual(order1Pending?.status, "PENDING", "订单状态在未完成支付前应保持 PENDING");

    // 4.2 模拟用户在网关端完成支付 (orderState=2, 录入 paidAt)
    const paidTime = new Date();
    const mockOrderRecord = mockGatewayOrders.get(testOrder1.orderNo)!;
    mockOrderRecord.orderState = 2;
    mockOrderRecord.paidAt = paidTime;

    // 执行查单同步
    const syncResPaid = await syncOrderStatusFromJeepay(testOrder1.orderNo);
    assert.strictEqual(syncResPaid, true, "网关支付成功后主动查单应返回 true");

    // 校验订单状态流转与事务核销
    const order1Paid = await prisma.order.findUnique({ where: { id: testOrder1.id } });
    assert.strictEqual(order1Paid?.status, "PAID", "订单状态应成功流转为 PAID");
    assert.strictEqual(order1Paid?.auditStatus, "APPROVED", "订单核销状态应为 APPROVED");
    assert.strictEqual(order1Paid?.transactionNo, mockOrderRecord.payOrderId, "订单交易单号应正确回填");
    assert(order1Paid?.paidAt instanceof Date, "支付完成时间应记录为有效 Date");

    // 校验会员订阅开通
    const subUser1 = await prisma.subscription.findUnique({ where: { userId: testUser.id } });
    assert.strictEqual(subUser1?.status, "ACTIVE", "用户订阅应成功激活为 ACTIVE");
    assert(subUser1?.endsAt && subUser1.endsAt > new Date(), "用户订阅结束时间应有效延长");
    console.log(`✓ 4.1 & 4.2: 主动查单双保险机制验证成功，订单核销完成，会员权益已开通至: ${subUser1?.endsAt?.toLocaleDateString("zh-CN")}`);

    // -------------------------------------------------------------------------
    // 步骤 5: 验证 Webhook 回调 (/api/payment/jeepay/notify)
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] 验证 Webhook 异步回调通知与订单核销闭环...");

    // 创建订单 2 用于 Webhook 回调测试
    const testOrderNo2 = `TB_E2E_WEBHOOK_${Date.now()}_2`;
    const testOrder2 = await prisma.order.create({
      data: {
        orderNo: testOrderNo2,
        userId: testUser.id,
        planId: targetPlan.id,
        billingCycle: "monthly",
        amount: new Prisma.Decimal("199.00"),
        status: "PENDING",
        channel: "alipay",
      },
    });

    // 记录核销前的订阅到期时间基线（用户此前已有月付订阅）
    const baselineSub = await prisma.subscription.findUnique({ where: { userId: testUser.id } });
    assert(baselineSub?.endsAt, "前序步骤后订阅结束时间应存在");
    const baselineEndsAtTime = new Date(baselineSub.endsAt).getTime();

    const webhookPayOrderId = `P_WEBHOOK_${Date.now()}_999`;
    const notifyPayload: Record<string, unknown> = {
      mchOrderNo: testOrder2.orderNo,
      payOrderId: webhookPayOrderId,
      amount: 19900,
      state: 2, // 支付成功
      currency: "cny",
      successTime: String(Date.now()),
    };
    notifyPayload.sign = generateJeepaySign(notifyPayload, testApiKey);

    // 验证签名正确
    assert.strictEqual(
      verifyJeepaySign(notifyPayload, testApiKey),
      true,
      "测试通知载荷自身验签应为 true",
    );

    // 发起模拟 Webhook 请求
    const webhookReq = new Request("http://localhost:3000/api/payment/jeepay/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notifyPayload),
    });

    const webhookRes = await POST(webhookReq as unknown as NextRequest);
    assert.strictEqual(webhookRes.status, 200, "Webhook 应响应 HTTP 200");
    const webhookResText = await webhookRes.text();
    assert.strictEqual(webhookResText, "success", "Webhook 响应正文必须为 'success'");

    // 检查订单 2 状态
    const order2Paid = await prisma.order.findUnique({ where: { id: testOrder2.id } });
    assert.strictEqual(order2Paid?.status, "PAID", "订单2状态应流转为 PAID");
    assert.strictEqual(order2Paid?.auditStatus, "APPROVED", "订单2核销状态应为 APPROVED");
    assert.strictEqual(order2Paid?.transactionNo, webhookPayOrderId, "订单2交易单号应正确记录");
    assert(order2Paid?.paidAt instanceof Date, "订单2 paidAt 时间记录有效");

    // 检查会员订阅在原有基础上顺延
    const extendedSub = await prisma.subscription.findUnique({ where: { userId: testUser.id } });
    assert(extendedSub?.endsAt, "续期后结束时间不为空");
    const extendedEndsAtTime = new Date(extendedSub.endsAt).getTime();
    assert(
      extendedEndsAtTime > baselineEndsAtTime,
      `订阅时间应在原基线基础上顺延，基线=${new Date(baselineEndsAtTime).toISOString()}, 新到期=${extendedSub.endsAt.toISOString()}`,
    );
    console.log(`✓ 5.1: Webhook 签名通知处理正常，返回 HTTP 200 'success'，权益顺延至: ${extendedSub.endsAt.toLocaleDateString("zh-CN")}`);

    // -------------------------------------------------------------------------
    // 步骤 6: 验证 Webhook 幂等性 (重复投递不重复续期)
    // -------------------------------------------------------------------------
    console.log("\n[Step 6] 验证 Webhook 重复投递幂等性 (Idempotency Guard)...");
    const recordedEndsAt = extendedSub.endsAt.toISOString();

    const duplicateWebhookReq = new Request("http://localhost:3000/api/payment/jeepay/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notifyPayload),
    });

    const duplicateWebhookRes = await POST(duplicateWebhookReq as unknown as NextRequest);
    assert.strictEqual(duplicateWebhookRes.status, 200, "重复 Webhook 投递仍需返回 HTTP 200");
    const duplicateResText = await duplicateWebhookRes.text();
    assert.strictEqual(duplicateResText, "success", "重复 Webhook 投递仍需响应 'success'");

    // 检查订阅结束时间保持完全一致，绝不可重复叠加
    const subAfterDuplicate = await prisma.subscription.findUnique({ where: { userId: testUser.id } });
    assert.strictEqual(
      subAfterDuplicate?.endsAt?.toISOString(),
      recordedEndsAt,
      "Webhook 重复到达时，订阅到期时间必须保持完全一致，禁止重复叠加权益",
    );
    console.log("✓ 6.1: Webhook 重复投递幂等防重保障有效，响应 success 且无脏数据叠加");

    // -------------------------------------------------------------------------
    // 步骤 7: 清理测试数据 (Order, Subscription, PaymentEvent, User)
    // -------------------------------------------------------------------------
    console.log("\n[Step 7] 清理测试记录 (Clean up test artifacts)...");
    await prisma.paymentEvent.deleteMany({
      where: { orderNo: { in: [testOrder1.orderNo, testOrder2.orderNo] } },
    });
    await prisma.order.deleteMany({
      where: { id: { in: [testOrder1.id, testOrder2.id] } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.deleteMany({
      where: { id: testUser.id },
    });
    console.log("✓ 7.1: 测试生成的订单、订阅、流水事件与测试用户已彻底清理");

    console.log("\n==================================================================");
    console.log("🎉 Task 7: Jeepay 全链路自动化端到端测试全部通过！");
    console.log("==================================================================\n");
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
}

main().catch((err) => {
  console.error("\n❌ E2E 测试失败:", err);
  process.exit(1);
});
