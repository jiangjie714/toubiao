import assert from "node:assert";
import {
  createPrepay,
  PaymentPrepayError,
  type PaymentChannel,
} from "../src/lib/payment-prepay";
import { isJeepayConfigured } from "../src/lib/jeepay";

console.log("=== Testing Prepay Adapter with Jeepay Integration ===");

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

import { Prisma } from "@prisma/client";

// 模拟测试数据
const mockOrder = {
  orderNo: "TB202610010099",
  amount: new Prisma.Decimal(299), // 299 元 -> 29900 分
};
const mockDescription = "标讯通会员-月付";

async function runTests() {
  try {
    // ---------------------------------------------------------
    // Test 1: 类型与渠道定义验证 ("wechat" | "alipay" | "jeepay")
    // ---------------------------------------------------------
    const channels: PaymentChannel[] = ["wechat", "alipay", "jeepay"];
    assert.strictEqual(channels.length, 3, "PaymentChannel 必须包含 wechat, alipay, jeepay");
    console.log("✓ Test 1: PaymentChannel 类型验证包含 'jeepay'");

    // ---------------------------------------------------------
    // Test 2: 当 isJeepayConfigured() 为 true 时，路由至 Jeepay
    // ---------------------------------------------------------
    process.env.JEEPAY_PAY_URL = "http://127.0.0.1:9217";
    process.env.JEEPAY_MCH_NO = "M1623984572";
    process.env.JEEPAY_APP_ID = "60cc09bce4b0f1c0b83761c9";
    process.env.JEEPAY_API_KEY = "MOCK_API_KEY";
    delete process.env.JEEPAY_WAYCODE_WECHAT;
    delete process.env.JEEPAY_WAYCODE_ALIPAY;
    delete process.env.JEEPAY_WAYCODE_CASHIER;

    assert.strictEqual(isJeepayConfigured(), true, "Jeepay 应处于已配置状态");

    let lastRequestUrl = "";
    let lastRequestBody: Record<string, unknown> | null = null;

    // Mock fetch for Jeepay unifiedOrder
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      lastRequestUrl = String(input);
      if (init?.body) {
        lastRequestBody = JSON.parse(String(init.body));
      }

      // 默认成功返回
      return {
        ok: true,
        json: async () => ({
          code: 0,
          msg: "SUCCESS",
          data: {
            payOrderId: "P202610010001",
            mchOrderNo: lastRequestBody?.mchOrderNo,
            orderState: 1,
            payDataType: "codeUrl",
            payData: "weixin://wxpay/bizpayurl?pr=mockWechatQr",
          },
        }),
      } as unknown as Response;
    }) as typeof fetch;

    // 2.1 channel = "wechat" -> wayCode 默认为 WX_NATIVE
    const prepayWechat = await createPrepay("wechat", mockOrder, mockDescription);
    assert(lastRequestUrl.includes("/api/pay/unifiedOrder"), "微信应请求 Jeepay 统一下单接口");
    assert.strictEqual(lastRequestBody.wayCode, "WX_NATIVE", "微信默认 wayCode 应为 WX_NATIVE");
    assert.strictEqual(lastRequestBody.amount, 29900, "金额应换算为分 (29900)");
    assert.strictEqual(lastRequestBody.mchOrderNo, mockOrder.orderNo);
    assert.strictEqual(prepayWechat.code, "weixin://wxpay/bizpayurl?pr=mockWechatQr");
    assert(prepayWechat.expiresAt > new Date(), "预下单过期时间应大于当前时间");
    console.log("✓ Test 2.1: channel=wechat 正确路由至 Jeepay (WX_NATIVE)");

    // 2.2 channel = "alipay" -> wayCode 默认为 ALI_QR
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      lastRequestUrl = String(input);
      lastRequestBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({
          code: 0,
          msg: "SUCCESS",
          data: {
            payOrderId: "P202610010002",
            mchOrderNo: lastRequestBody?.mchOrderNo,
            orderState: 1,
            payDataType: "payUrl",
            payData: "https://qr.alipay.com/bax01234mockAlipayQr",
          },
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const prepayAlipay = await createPrepay("alipay", mockOrder, mockDescription);
    assert.strictEqual(lastRequestBody.wayCode, "ALI_QR", "支付宝默认 wayCode 应为 ALI_QR");
    assert.strictEqual(prepayAlipay.code, "https://qr.alipay.com/bax01234mockAlipayQr");
    console.log("✓ Test 2.2: channel=alipay 正确路由至 Jeepay (ALI_QR) 并支持 payUrl 格式");

    // 2.3 channel = "jeepay" -> wayCode 默认为 QR_CASHIER
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      lastRequestUrl = String(input);
      lastRequestBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({
          code: 0,
          msg: "SUCCESS",
          data: {
            payOrderId: "P202610010003",
            mchOrderNo: lastRequestBody?.mchOrderNo,
            orderState: 1,
            payDataType: "payUrl",
            payData: "http://127.0.0.1:9217/cashier/pay?id=mockCashier",
          },
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const prepayJeepay = await createPrepay("jeepay", mockOrder, mockDescription);
    assert.strictEqual(lastRequestBody.wayCode, "QR_CASHIER", "Jeepay 聚合收银台默认 wayCode 应为 QR_CASHIER");
    assert.strictEqual(prepayJeepay.code, "http://127.0.0.1:9217/cashier/pay?id=mockCashier");
    console.log("✓ Test 2.3: channel=jeepay 正确路由至收银台 (QR_CASHIER)");

    // 2.4 测试环境变量重载 wayCode
    process.env.JEEPAY_WAYCODE_WECHAT = "CUSTOM_WX";
    process.env.JEEPAY_WAYCODE_ALIPAY = "CUSTOM_ALI";
    process.env.JEEPAY_WAYCODE_CASHIER = "CUSTOM_CASHIER";

    await createPrepay("wechat", mockOrder, mockDescription);
    assert.strictEqual(lastRequestBody.wayCode, "CUSTOM_WX", "支持环境变量定制微信 wayCode");
    await createPrepay("alipay", mockOrder, mockDescription);
    assert.strictEqual(lastRequestBody.wayCode, "CUSTOM_ALI", "支持环境变量定制支付宝 wayCode");
    await createPrepay("jeepay", mockOrder, mockDescription);
    assert.strictEqual(lastRequestBody.wayCode, "CUSTOM_CASHIER", "支持环境变量定制收银台 wayCode");
    console.log("✓ Test 2.4: 环境变量 JEEPAY_WAYCODE_* 覆盖机制生效");

    // ---------------------------------------------------------
    // Test 3: Jeepay 错误处理 (网关错误码、网络异常、缺少 payData)
    // ---------------------------------------------------------
    // 3.1 远端返回业务错误码
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        code: 5001,
        msg: "商户支付通道未开通",
      }),
    })) as unknown as typeof fetch;

    await assert.rejects(
      async () => {
        await createPrepay("wechat", mockOrder, mockDescription);
      },
      (err: Error) => {
        assert(err instanceof PaymentPrepayError);
        assert(err.message.includes("商户支付通道未开通") || err.message.includes("5001"));
        return true;
      },
      "Jeepay 返回非0错误时应抛出包含详细信息的 PaymentPrepayError"
    );
    console.log("✓ Test 3.1: Jeepay 远端业务错误正确转换为 PaymentPrepayError");

    // 3.2 远端 HTTP 异常
    globalThis.fetch = (async () => ({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
    })) as unknown as typeof fetch;

    await assert.rejects(
      async () => {
        await createPrepay("alipay", mockOrder, mockDescription);
      },
      (err: Error) => {
        assert(err instanceof PaymentPrepayError);
        return true;
      },
      "Jeepay HTTP 错误应抛出 PaymentPrepayError"
    );
    console.log("✓ Test 3.2: Jeepay HTTP 异常正确抛出 PaymentPrepayError");

    // ---------------------------------------------------------
    // Test 4: 当 Jeepay 未配置时 (isJeepayConfigured() === false)
    // ---------------------------------------------------------
    delete process.env.JEEPAY_PAY_URL;
    delete process.env.JEEPAY_MCH_NO;
    delete process.env.JEEPAY_APP_ID;
    delete process.env.JEEPAY_API_KEY;
    delete process.env.WECHAT_PAY_APP_ID;
    delete process.env.ALIPAY_APP_ID;

    assert.strictEqual(isJeepayConfigured(), false);

    // 4.1 channel = "jeepay" 时未配置应直接报错
    await assert.rejects(
      async () => {
        await createPrepay("jeepay", mockOrder, mockDescription);
      },
      (err: Error) => {
        assert(err instanceof PaymentPrepayError);
        return true;
      },
      "未配置 Jeepay 时请求 channel=jeepay 应抛出 PaymentPrepayError"
    );
    console.log("✓ Test 4.1: 未配置 Jeepay 时 channel=jeepay 正确拒绝并抛出 PaymentPrepayError");

    // 4.2 channel = "wechat" 降级到直连微信（因缺少直连配置而抛出对应错误）
    await assert.rejects(
      async () => {
        await createPrepay("wechat", mockOrder, mockDescription);
      },
      (err: Error) => {
        assert(err instanceof PaymentPrepayError);
        assert(err.message.includes("微信支付配置不完整"));
        return true;
      },
      "未配置 Jeepay 时降级至原有直连微信逻辑"
    );
    console.log("✓ Test 4.2: 未配置 Jeepay 时平滑回退至直连微信支付检查");

    // 4.3 channel = "alipay" 降级到直连支付宝
    await assert.rejects(
      async () => {
        await createPrepay("alipay", mockOrder, mockDescription);
      },
      (err: Error) => {
        assert(err instanceof PaymentPrepayError);
        assert(err.message.includes("支付宝配置不完整"));
        return true;
      },
      "未配置 Jeepay 时降级至原有直连支付宝逻辑"
    );
    console.log("✓ Test 4.3: 未配置 Jeepay 时平滑回退至直连支付宝支付检查");

    console.log("\n🎉 [PASS] Task 2 所有预下单适配层测试全部通过！");
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
