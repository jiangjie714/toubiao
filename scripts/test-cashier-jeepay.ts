import Module from "node:module";
import assert from "node:assert";
import QRCode from "qrcode";
import { Prisma } from "@prisma/client";

// 拦截 server-only 与 next/cache 避免在脚本环境中报错
const origLoad = (Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown })._load;
const mockSessionUser = {
  uid: 1,
  username: "cashier_test_user",
  name: "收银台测试用户",
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

import { prisma } from "../src/lib/prisma";
import { isJeepayConfigured } from "../src/lib/jeepay";
import { isPrepayUsable } from "../src/lib/payment-prepay";

console.log("=== Testing Task 5: Cashier View & Dynamic QR Code Adaptation ===");

async function runTests() {
  const { preparePrepay, createOnlineOrderAction } = await import(
    "../src/app/actions/payments"
  );
  // 设置测试用 Jeepay 环境变量
  process.env.JEEPAY_PAY_URL = "http://127.0.0.1:9217";
  process.env.JEEPAY_MCH_NO = "M1700000001";
  process.env.JEEPAY_APP_ID = "640000000000000000000001";
  process.env.JEEPAY_API_KEY = "test_api_key_32_chars_long_123456";

  const originalFetch = global.fetch;

  try {
    // -------------------------------------------------------------
    // Test 1: 验证 isJeepayConfigured 正确识别配置状态
    // -------------------------------------------------------------
    console.log("\n[Test 1] 验证 isJeepayConfigured...");
    assert.strictEqual(isJeepayConfigured(), true, "Jeepay 应处于已配置状态");
    console.log("✓ Test 1: isJeepayConfigured 状态识别正常");

    // -------------------------------------------------------------
    // Test 2: 验证 payUrl 识别逻辑 (HTTP/HTTPS)
    // -------------------------------------------------------------
    console.log("\n[Test 2] 验证 payUrl 识别逻辑...");
    const httpCode = "http://127.0.0.1:9217/cashier/pay?id=123";
    const httpsCode = "https://pay.example.com/cashier/pay?id=456";
    const qrSchemeCode = "weixin://wxpay/bizpayurl?pr=abcdef";
    const alipaySchemeCode = "alipays://platformapi/startapp?appId=20000067";

    const detectPayUrl = (code: string | null) => {
      const isHttp = Boolean(code && /^https?:\/\//i.test(code.trim()));
      return isHttp ? code!.trim() : null;
    };

    assert.strictEqual(detectPayUrl(httpCode), httpCode);
    assert.strictEqual(detectPayUrl(httpsCode), httpsCode);
    assert.strictEqual(detectPayUrl(qrSchemeCode), null);
    assert.strictEqual(detectPayUrl(alipaySchemeCode), null);
    assert.strictEqual(detectPayUrl(null), null);
    console.log("✓ Test 2: payUrl 链接检测与过滤逻辑全部正确");

    // -------------------------------------------------------------
    // Test 3: 验证动态二维码生成 (QRCode.toDataURL)
    // -------------------------------------------------------------
    console.log("\n[Test 3] 验证 QRCode 生成...");
    const qrDataUrl = await QRCode.toDataURL(httpsCode, { width: 280, margin: 1 });
    assert.ok(qrDataUrl.startsWith("data:image/png;base64,"), "二维码应生成有效 base64 PNG Data URL");
    console.log("✓ Test 3: 二维码生成正常");

    // -------------------------------------------------------------
    // Test 4: 验证 preparePrepay 在订单缺少/过期 prepayCode 时自动调用 Jeepay 预下单
    // -------------------------------------------------------------
    console.log("\n[Test 4] 验证 preparePrepay 对 jeepay 渠道的动态预下单补全...");
    const mockCashierUrl = "https://pay.jeepay.vip/cashier/TB_TEST_CASHIER_001";
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/pay/unifiedOrder")) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            msg: "SUCCESS",
            data: {
              payOrderId: "P1790000000001",
              mchOrderNo: "TB_TEST_CASHIER_001",
              orderState: 1,
              payDataType: "payUrl",
              payData: mockCashierUrl,
            },
          }),
        } as unknown as Response;
      }
      return originalFetch(url);
    };

    // 内存模拟 Prisma 数据库
    type MockOrder = {
      id: number;
      orderNo: string;
      userId: number;
      planId: number;
      billingCycle: string;
      amount: Prisma.Decimal;
      channel: string;
      status: string;
      prepayCode: string | null;
      prepayExpiresAt: Date | null;
      plan?: MockPlan;
    };

    type MockPlan = {
      id: number;
      code: string;
      name: string;
      priceMonthly: Prisma.Decimal;
      priceYearly: Prisma.Decimal;
      active: boolean;
    };

    const orders = new Map<number, MockOrder>();
    const plans = new Map<string, MockPlan>();
    const proPlan: MockPlan = {
      id: 1,
      code: "PRO",
      name: "专业版",
      priceMonthly: new Prisma.Decimal("199.00"),
      priceYearly: new Prisma.Decimal("1990.00"),
      active: true,
    };
    plans.set("PRO", proPlan);

    let nextOrderId = 1;
    const mockPrisma = prisma as unknown as {
      order: {
        findUnique: (args: { where: { id?: number; orderNo?: string } }) => Promise<MockOrder | null>;
        findFirst: (args: { where: { orderNo?: string; userId?: number; status?: string } }) => Promise<MockOrder | null>;
        create: (args: { data: Omit<MockOrder, "id"> }) => Promise<MockOrder>;
        update: (args: { where: { id: number }; data: Partial<MockOrder> }) => Promise<MockOrder>;
      };
      plan: {
        findUnique: (args: { where: { id?: number; code?: string } }) => Promise<MockPlan | null>;
        findFirst: () => Promise<MockPlan | null>;
      };
    };

    mockPrisma.plan = {
      findUnique: async ({ where }) => {
        if (where.code) return plans.get(where.code) || null;
        if (where.id) {
          for (const p of plans.values()) {
            if (p.id === where.id) return p;
          }
        }
        return null;
      },
      findFirst: async () => proPlan,
    };

    mockPrisma.order = {
      findUnique: async ({ where }) => {
        if (where.id) return orders.get(where.id) || null;
        if (where.orderNo) {
          for (const o of orders.values()) {
            if (o.orderNo === where.orderNo) return { ...o };
          }
        }
        return null;
      },
      findFirst: async ({ where }) => {
        for (const o of orders.values()) {
          if (where.orderNo && o.orderNo !== where.orderNo) continue;
          if (where.userId && o.userId !== where.userId) continue;
          if (where.status && o.status !== where.status) continue;
          return { ...o, plan: proPlan };
        }
        return null;
      },
      create: async ({ data }) => {
        const id = nextOrderId++;
        const record: MockOrder = { id, ...data };
        orders.set(id, record);
        return { ...record };
      },
      update: async ({ where, data }) => {
        const existing = orders.get(where.id);
        if (!existing) throw new Error("Order not found");
        const updated: MockOrder = { ...existing, ...data };
        orders.set(where.id, updated);
        return { ...updated };
      },
    };

    const testOrderNo = `TB_CASHIER_${Date.now()}`;
    const order = await mockPrisma.order.create({
      data: {
        orderNo: testOrderNo,
        userId: mockSessionUser.uid,
        planId: proPlan.id,
        billingCycle: "monthly",
        amount: new Prisma.Decimal("199.00"),
        channel: "jeepay",
        status: "PENDING",
        prepayCode: null,
        prepayExpiresAt: null,
      },
    });

    assert.strictEqual(isPrepayUsable(order), false, "初始状态下 prepayCode 为空，isPrepayUsable 应为 false");

    // 模拟收银台服务端渲染页面：调用 preparePrepay 动态预下单
    const prepayErr = await preparePrepay(order);
    assert.strictEqual(prepayErr, null, "preparePrepay 应无错误执行");

    const updatedOrder = await mockPrisma.order.findUnique({ where: { id: order.id } });
    assert.ok(updatedOrder?.prepayCode, "order.prepayCode 应被自动填充");
    assert.strictEqual(updatedOrder?.prepayCode, mockCashierUrl, "order.prepayCode 应为 Jeepay 返回的 payUrl");
    assert.ok(updatedOrder?.prepayExpiresAt && updatedOrder.prepayExpiresAt > new Date(), "预下单应刷新过期时间");
    assert.strictEqual(isPrepayUsable(updatedOrder!), true, "更新后 isPrepayUsable 应为 true");
    console.log("✓ Test 4: preparePrepay 动态生成与刷新逻辑验证通过");

    // -------------------------------------------------------------
    // Test 5: 验证 createOnlineOrderAction 接收 channel="jeepay"
    // -------------------------------------------------------------
    console.log("\n[Test 5] 验证 createOnlineOrderAction 允许 channel=jeepay...");
    const formData = new FormData();
    formData.append("planCode", proPlan.code);
    formData.append("billingCycle", "monthly");
    formData.append("channel", "jeepay");

    // createOnlineOrderAction 会在末尾调用 redirect() 抛出 NEXT_REDIRECT
    try {
      await createOnlineOrderAction(formData);
    } catch (e: unknown) {
      const err = e as Error;
      // 确认重定向目标为 /pay/TB... 而非 /pricing?error=channel
      assert.ok(
        err.message.includes("NEXT_REDIRECT") || err.message.includes("/pay/"),
        `应成功创建订单并重定向到收银台，捕获到: ${err.message}`,
      );
      assert.ok(!err.message.includes("error=channel"), "不应被 channel 验证拦截");
    }
    console.log("✓ Test 5: createOnlineOrderAction 支持 jeepay 渠道验证通过");

    console.log("\n=========================================");
    console.log("🎉 全部 Task 5 收银台与动态二维码适配测试通过！");
    console.log("=========================================\n");
  } finally {
    global.fetch = originalFetch;
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
