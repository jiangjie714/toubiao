import Module from "node:module";
import assert from "node:assert";
import { Prisma } from "@prisma/client";

// 拦截 server-only 与 next/cache 避免在脚本环境中报错
const origLoad = (Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown })._load;
const mockSessionUser: { uid: number; username: string; name: string; role: string; emailVerified: boolean } | null = {
  uid: 1,
  username: "testuser",
  name: "测试用户",
  role: "USER",
  emailVerified: true,
};

(Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  if (request === "next/cache") {
    return {
      revalidatePath: () => {},
      revalidateTag: () => {},
    };
  }
  const loaded = origLoad.apply(this, [request, parent, isMain]);
  if (request.endsWith("/auth") || request === "@/lib/auth") {
    return {
      ...(loaded as Record<string, unknown>),
      getSession: async () => mockSessionUser,
    };
  }
  return loaded;
};

// 引入模块
import { prisma } from "../src/lib/prisma";

console.log("=== Testing Jeepay Query Sync & Dual Protection ===");

type MockOrder = {
  id: number;
  orderNo: string;
  userId: number;
  planId: number;
  billingCycle: string;
  amount: Prisma.Decimal;
  status: string;
  channel: string;
  paidAt?: Date | null;
  auditStatus?: string;
  auditAt?: Date | null;
  auditByUserId?: number | null;
  auditNote?: string | null;
  transactionNo?: string | null;
  matchingCode?: string | null;
  note?: string | null;
  paidNoticeAt?: Date | null;
  proofUrl?: string | null;
  plan?: { id: number; name: string; priceMonthly: Prisma.Decimal; priceYearly: Prisma.Decimal };
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
  const {
    syncOrderStatusFromJeepay,
    pollOrderStatusAction,
    notifyOrderPaidAction,
  } = await import("../src/app/actions/payments");

  const testApiKey = "TEST_API_KEY_QUERY_SYNC_123456";
  process.env.JEEPAY_PAY_URL = "http://127.0.0.1:9217";
  process.env.JEEPAY_MCH_NO = "M1623984572";
  process.env.JEEPAY_APP_ID = "60cc09bce4b0f1c0b83761c9";
  process.env.JEEPAY_API_KEY = testApiKey;

  // ----------------------------------------------------------------
  // 内存模拟 Prisma 数据库
  // ----------------------------------------------------------------
  const orders = new Map<number, MockOrder>();
  const paymentEvents = new Map<string, MockPaymentEvent>();
  const subscriptions = new Map<number, MockSubscription>();
  let nextOrderId = 1;
  let nextEventId = 1;

  const mockPrisma = prisma as unknown as {
    order: {
      findUnique: (args: { where: { id?: number; orderNo?: string }; select?: Record<string, boolean> }) => Promise<MockOrder | null>;
      findFirst: (args: { where: { id?: number; orderNo?: string; userId?: number }; include?: Record<string, boolean> }) => Promise<MockOrder | null>;
      update: (args: { where: { id: number }; data: Partial<MockOrder> }) => Promise<MockOrder>;
      create: (args: { data: Omit<MockOrder, "id"> }) => Promise<MockOrder>;
    };
    paymentEvent: {
      upsert: (args: {
        where: { provider_providerEventId: { provider: string; providerEventId: string } };
        update: Partial<MockPaymentEvent>;
        create: Omit<MockPaymentEvent, "id" | "receivedAt">;
      }) => Promise<MockPaymentEvent>;
    };
    subscription: {
      findUnique: (args: { where: { userId: number } }) => Promise<MockSubscription | null>;
      upsert: (args: {
        where: { userId: number };
        update: Partial<MockSubscription>;
        create: Omit<MockSubscription, "id">;
      }) => Promise<MockSubscription>;
    };
    plan: {
      findUnique: (args: { where: { id?: number; code?: string } }) => Promise<{ id: number; name: string; priceMonthly: Prisma.Decimal; priceYearly: Prisma.Decimal } | null>;
    };
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };

  mockPrisma.order.findUnique = async ({ where }) => {
    if (where.id) return orders.get(where.id) || null;
    if (where.orderNo) {
      for (const o of orders.values()) {
        if (o.orderNo === where.orderNo) return { ...o };
      }
    }
    return null;
  };

  mockPrisma.order.findFirst = async ({ where }) => {
    for (const o of orders.values()) {
      if (where.orderNo && o.orderNo !== where.orderNo) continue;
      if (where.userId && o.userId !== where.userId) continue;
      return {
        ...o,
        plan: { id: o.planId, name: "专业版", priceMonthly: new Prisma.Decimal(199), priceYearly: new Prisma.Decimal(1990) },
      };
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
      plan: { id: data.planId, name: "专业版", priceMonthly: new Prisma.Decimal(199), priceYearly: new Prisma.Decimal(1990) },
    };
    orders.set(id, created);
    return created;
  };

  mockPrisma.paymentEvent.upsert = async ({ where, update, create }) => {
    const key = `${where.provider_providerEventId.provider}:${where.provider_providerEventId.providerEventId}`;
    const existing = paymentEvents.get(key);
    if (existing) {
      const updated: MockPaymentEvent = { ...existing, ...update };
      paymentEvents.set(key, updated);
      return updated;
    }
    const id = nextEventId++;
    const created: MockPaymentEvent = { ...create, id, receivedAt: new Date() };
    paymentEvents.set(key, created);
    return created;
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

  mockPrisma.plan.findUnique = async () => {
    return { id: 1, name: "专业版", priceMonthly: new Prisma.Decimal(199), priceYearly: new Prisma.Decimal(1990) };
  };

  mockPrisma.$transaction = async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    return fn(mockPrisma);
  };

  // ----------------------------------------------------------------
  // Mock fetch 响应模拟 Jeepay /api/pay/query
  // ----------------------------------------------------------------
  let mockQueryResponse: {
    code: number;
    msg: string;
    data?: {
      payOrderId: string;
      mchOrderNo: string;
      orderState: number;
      amount: number;
      currency: string;
      successTime?: string;
    };
  } = {
    code: 0,
    msg: "SUCCESS",
    data: {
      payOrderId: "P_TEST_DEFAULT",
      mchOrderNo: "TB_TEST_DEFAULT",
      orderState: 1, // 支付中
      amount: 19900,
      currency: "cny",
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("/api/pay/query")) {
      return new Response(JSON.stringify(mockQueryResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    // ----------------------------------------------------------------
    // Test 1: syncOrderStatusFromJeepay 状态主动同步
    // ----------------------------------------------------------------
    console.log("\n[Test 1] 验证 syncOrderStatusFromJeepay...");

    // 1.1 订单不存在时返回 false
    const resNotFound = await syncOrderStatusFromJeepay("TB_NON_EXISTENT_ORDER");
    assert.strictEqual(resNotFound, false, "不存在的订单应返回 false");

    // 1.2 创建待支付订单，Jeepay 查单返回 orderState = 1 (未支付)
    const orderNo1 = `TB_SYNC_TEST_${Date.now()}_1`;
    const order1 = await mockPrisma.order.create({
      data: {
        orderNo: orderNo1,
        userId: 1,
        planId: 1,
        billingCycle: "monthly",
        amount: new Prisma.Decimal(199),
        status: "PENDING",
        channel: "jeepay",
        matchingCode: "1001",
      },
    });

    mockQueryResponse = {
      code: 0,
      msg: "SUCCESS",
      data: {
        payOrderId: `P_${orderNo1}`,
        mchOrderNo: orderNo1,
        orderState: 1, // 未支付
        amount: 19900,
        currency: "cny",
      },
    };

    const resPending = await syncOrderStatusFromJeepay(orderNo1);
    assert.strictEqual(resPending, false, "Jeepay 返回未支付状态时，同步函数应返回 false");
    const orderAfterPending = await mockPrisma.order.findUnique({ where: { id: order1.id } });
    assert.strictEqual(orderAfterPending?.status, "PENDING", "订单状态应保持 PENDING");

    // 1.3 Jeepay 查单返回 orderState = 2 (支付成功)
    const payTime = Date.now().toString();
    mockQueryResponse = {
      code: 0,
      msg: "SUCCESS",
      data: {
        payOrderId: `P_${orderNo1}_PAID`,
        mchOrderNo: orderNo1,
        orderState: 2, // 支付成功
        amount: 19900,
        currency: "cny",
        successTime: payTime,
      },
    };

    const resPaid = await syncOrderStatusFromJeepay(orderNo1);
    assert.strictEqual(resPaid, true, "Jeepay 查单成功支付时，同步函数应返回 true");

    const orderAfterPaid = await mockPrisma.order.findUnique({ where: { id: order1.id } });
    assert.strictEqual(orderAfterPaid?.status, "PAID", "订单状态应更新为 PAID");
    assert.strictEqual(orderAfterPaid?.auditStatus, "APPROVED", "订单核销状态应为 APPROVED");
    assert.strictEqual(orderAfterPaid?.transactionNo, `P_${orderNo1}_PAID`, "交易单号应正确记录");

    // 验证订阅已开通
    const sub = await mockPrisma.subscription.findUnique({ where: { userId: 1 } });
    assert.strictEqual(sub?.status, "ACTIVE", "会员订阅应成功激活");

    // 验证 PaymentEvent 已创建
    const eventKey = `jeepay:P_${orderNo1}_PAID`;
    const event = paymentEvents.get(eventKey);
    assert(event !== undefined, "应生成对应 PaymentEvent 记录");
    assert.strictEqual(event?.status, "PROCESSED", "PaymentEvent 状态应为 PROCESSED");

    // 1.4 对已支付订单再次调用，应直接返回 true
    const resAlreadyPaid = await syncOrderStatusFromJeepay(orderNo1);
    assert.strictEqual(resAlreadyPaid, true, "已支付订单再次同步应返回 true");

    console.log("✓ Test 1: syncOrderStatusFromJeepay 查单同步逻辑全部通过");

    // ----------------------------------------------------------------
    // Test 2: pollOrderStatusAction 轻量轮询
    // ----------------------------------------------------------------
    console.log("\n[Test 2] 验证 pollOrderStatusAction 轻量轮询与主动查单...");

    const orderNo2 = `TB_POLL_TEST_${Date.now()}_2`;
    await mockPrisma.order.create({
      data: {
        orderNo: orderNo2,
        userId: 2,
        planId: 1,
        billingCycle: "monthly",
        amount: new Prisma.Decimal(199),
        status: "PENDING",
        channel: "wechat",
        matchingCode: "1002",
      },
    });

    // 2.1 尚未在外部完成支付，轮询返回 PENDING
    mockQueryResponse = {
      code: 0,
      msg: "SUCCESS",
      data: {
        payOrderId: `P_${orderNo2}`,
        mchOrderNo: orderNo2,
        orderState: 1,
        amount: 19900,
        currency: "cny",
      },
    };

    const pollRes1 = await pollOrderStatusAction(orderNo2);
    assert.strictEqual(pollRes1.status, "PENDING", "未支付时轮询结果应为 PENDING");

    // 2.2 用户在外部完成支付 (orderState=2)，前端轮询触发主动查单核销
    mockQueryResponse = {
      code: 0,
      msg: "SUCCESS",
      data: {
        payOrderId: `P_${orderNo2}_SUCCESS`,
        mchOrderNo: orderNo2,
        orderState: 2,
        amount: 19900,
        currency: "cny",
        successTime: Date.now().toString(),
      },
    };

    const pollRes2 = await pollOrderStatusAction(orderNo2);
    assert.strictEqual(pollRes2.status, "PAID", "外部支付成功后轮询应自动查单并返回 PAID");
    assert.strictEqual(pollRes2.auditStatus, "APPROVED", "核销状态应为 APPROVED");
    assert(pollRes2.paidAt !== null, "paidAt 字段不为空");

    // 2.3 不存在的订单轮询返回 NOT_FOUND
    const pollResNotFound = await pollOrderStatusAction("TB_NON_EXISTENT_POLL");
    assert.strictEqual(pollResNotFound.status, "NOT_FOUND", "不存在订单轮询应返回 NOT_FOUND");

    console.log("✓ Test 2: pollOrderStatusAction 轻量轮询与外部查单协同正常");

    // ----------------------------------------------------------------
    // Test 3: notifyOrderPaidAction 用户点击「我已完成支付」
    // ----------------------------------------------------------------
    console.log("\n[Test 3] 验证 notifyOrderPaidAction 先查单后兜底...");

    const orderNo3 = `TB_NOTIFY_TEST_${Date.now()}_3`;
    await mockPrisma.order.create({
      data: {
        orderNo: orderNo3,
        userId: 1, // 匹配 mockSessionUser.uid
        planId: 1,
        billingCycle: "monthly",
        amount: new Prisma.Decimal(199),
        status: "PENDING",
        channel: "alipay",
        matchingCode: "1003",
      },
    });

    // 3.1 外部 Jeepay 已经支付成功，用户点击通知按钮时，应直接查单核销并返回成功，免去人工审核
    mockQueryResponse = {
      code: 0,
      msg: "SUCCESS",
      data: {
        payOrderId: `P_${orderNo3}_INSTANT`,
        mchOrderNo: orderNo3,
        orderState: 2,
        amount: 19900,
        currency: "cny",
        successTime: Date.now().toString(),
      },
    };

    const notifyRes1 = await notifyOrderPaidAction({ orderNo: orderNo3 });
    assert.strictEqual(notifyRes1.success, true, "查单确认支付成功后应立即返回成功");
    assert.strictEqual(notifyRes1.matchingCode, "1003", "返回 matchingCode 正常");

    const order3After = await mockPrisma.order.findFirst({ where: { orderNo: orderNo3 } });
    assert.strictEqual(order3After?.status, "PAID", "订单应直接成为 PAID，无需人工审核");
    assert.strictEqual(order3After?.auditStatus, "APPROVED", "审核状态应直接为 APPROVED");

    // 3.2 订单已是 PAID 时再次点击，直接返回成功
    const notifyResRepeat = await notifyOrderPaidAction({ orderNo: orderNo3 });
    assert.strictEqual(notifyResRepeat.success, true, "已支付订单再次点击应立即返回成功");

    // 3.3 外部 Jeepay 查单显示未成功 (如 orderState=1)，用户点击后走兜底人工待核销流程
    const orderNo4 = `TB_NOTIFY_TEST_${Date.now()}_4`;
    await mockPrisma.order.create({
      data: {
        orderNo: orderNo4,
        userId: 1,
        planId: 1,
        billingCycle: "monthly",
        amount: new Prisma.Decimal(199),
        status: "PENDING",
        channel: "wechat",
        matchingCode: "1004",
      },
    });

    mockQueryResponse = {
      code: 0,
      msg: "SUCCESS",
      data: {
        payOrderId: `P_${orderNo4}_WAIT`,
        mchOrderNo: orderNo4,
        orderState: 1, // 尚未到账
        amount: 19900,
        currency: "cny",
      },
    };

    const notifyResWait = await notifyOrderPaidAction({ orderNo: orderNo4 });
    assert.strictEqual(notifyResWait.success, true, "兜底人工流提报成功");
    const order4After = await mockPrisma.order.findFirst({ where: { orderNo: orderNo4 } });
    assert.strictEqual(order4After?.status, "WAIT_VERIFY", "未自动查实到账时，进入 WAIT_VERIFY");
    assert.strictEqual(order4After?.auditStatus, "PENDING", "人工审核状态为 PENDING");

    console.log("✓ Test 3: notifyOrderPaidAction 主动查单快通与人工兜底流程全部通过");

    console.log("\n=========================================");
    console.log("🎉 全部 Task 4 Jeepay 主动查单双保险测试通过！");
    console.log("=========================================\n");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((err) => {
  console.error("\n❌ 测试失败:", err);
  process.exit(1);
});
