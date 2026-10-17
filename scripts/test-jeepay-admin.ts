import Module from "node:module";
import assert from "node:assert";
import QRCode from "qrcode";

// 拦截 server-only 与 auth 模块以方便在 CLI 单元测试中模拟会话
const origLoad = (
  Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;

let mockSessionUser: {
  uid: number;
  username: string;
  name: string;
  role: string;
  emailVerified: boolean;
} | null = null;

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
  const loaded = origLoad.apply(this, [request, parent, isMain]);
  if (request.endsWith("/auth") || request === "@/lib/auth") {
    return {
      ...(loaded as Record<string, unknown>),
      getSession: async () => mockSessionUser,
    };
  }
  return loaded;
};

console.log("=== Testing Task 6: Jeepay Admin Diagnostic & Test Actions ===");

async function runTests() {
  const {
    testJeepayConnectionAction,
    createJeepayTestOrderAction,
  } = await import("../src/app/actions/jeepay-admin");

  const originalFetch = global.fetch;

  try {
    // -------------------------------------------------------------
    // Test 1: 权限校验 (非 ADMIN 会话拒绝执行)
    // -------------------------------------------------------------
    console.log("\n[Test 1] 验证管理员权限守卫 (RBAC Session Guard)...");

    // 1.1 未登录状态
    mockSessionUser = null;
    const unauthConnRes = await testJeepayConnectionAction();
    assert.strictEqual(
      unauthConnRes.success,
      false,
      "未登录执行连通测试必须返回失败"
    );
    assert.match(
      unauthConnRes.message,
      /管理员权限/,
      "未登录应提示需要管理员权限"
    );

    const unauthOrderRes = await createJeepayTestOrderAction();
    assert.strictEqual(
      unauthOrderRes.success,
      false,
      "未登录执行测试下单必须返回失败"
    );
    assert.match(
      unauthOrderRes.error || "",
      /管理员权限/,
      "未登录应提示需要管理员权限"
    );

    // 1.2 普通 USER 角色
    mockSessionUser = {
      uid: 99,
      username: "normal_user",
      name: "普通用户",
      role: "USER",
      emailVerified: true,
    };
    const userConnRes = await testJeepayConnectionAction();
    assert.strictEqual(
      userConnRes.success,
      false,
      "普通用户执行连通测试必须返回失败"
    );
    const userOrderRes = await createJeepayTestOrderAction();
    assert.strictEqual(
      userOrderRes.success,
      false,
      "普通用户执行测试下单必须返回失败"
    );
    console.log("✓ 未登录及普通用户均被严格拦截 (RBAC 守卫有效)");

    // 切换为 ADMIN 用户
    mockSessionUser = {
      uid: 1,
      username: "admin_test",
      name: "系统管理员",
      role: "ADMIN",
      emailVerified: true,
    };

    // -------------------------------------------------------------
    // Test 2: 未配置 Jeepay 环境变量时的诊断提示
    // -------------------------------------------------------------
    console.log("\n[Test 2] 验证未配置或缺少关键环境变量时的异常处理...");
    const oldPayUrl = process.env.JEEPAY_PAY_URL;
    const oldMchNo = process.env.JEEPAY_MCH_NO;
    const oldAppId = process.env.JEEPAY_APP_ID;
    const oldApiKey = process.env.JEEPAY_API_KEY;

    delete process.env.JEEPAY_PAY_URL;
    delete process.env.JEEPAY_MCH_NO;

    const notConfiguredConn = await testJeepayConnectionAction();
    assert.strictEqual(notConfiguredConn.success, false);
    assert.match(notConfiguredConn.message, /未配置或不完整/);

    const notConfiguredOrder = await createJeepayTestOrderAction();
    assert.strictEqual(notConfiguredOrder.success, false);
    assert.match(notConfiguredOrder.error || "", /未配置或不完整/);
    console.log("✓ 环境变量缺失时正确提示「Jeepay 环境变量未配置或不完整」");

    // 恢复配置
    process.env.JEEPAY_PAY_URL = "http://127.0.0.1:9217";
    process.env.JEEPAY_MCH_NO = "M1700000001";
    process.env.JEEPAY_APP_ID = "640000000000000000000001";
    process.env.JEEPAY_API_KEY = "test_api_key_32_chars_long_123456";

    // -------------------------------------------------------------
    // Test 3: testJeepayConnectionAction 连通性测试探针与延时
    // -------------------------------------------------------------
    console.log("\n[Test 3] 验证 testJeepayConnectionAction 探针请求与响应...");

    // 3.1 模拟正常网关返回 (200 OK，包含合规 JSON，即使订单不存在 code: 5013)
    let interceptedRequestPayload: Record<string, unknown> | null = null;
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      interceptedRequestPayload = JSON.parse(String(init?.body || "{}"));
      // 模拟 15ms 网络延迟
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          code: 5013,
          msg: "订单不存在",
          sign: "MOCK_GATEWAY_SIGN",
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const pingRes = await testJeepayConnectionAction();
    assert.strictEqual(pingRes.success, true, "正常响应即使订单不存在也代表连通成功");
    assert.strictEqual(pingRes.message, "网关与签名验证连通正常");
    assert(
      typeof pingRes.latencyMs === "number" && pingRes.latencyMs >= 10,
      `延迟统计应大于 10ms，实际: ${pingRes.latencyMs}ms`
    );
    assert.strictEqual(
      interceptedRequestPayload?.mchOrderNo,
      "PROBE_PING",
      "探针请求应发送 PROBE_PING 订单号"
    );
    assert.strictEqual(
      interceptedRequestPayload?.mchNo,
      "M1700000001",
      "商户号应正确传入"
    );
    assert(
      typeof interceptedRequestPayload?.sign === "string" &&
        interceptedRequestPayload.sign.length === 32,
      "探针请求应自动生成合规 32 位 MD5 签名"
    );
    console.log(`✓ 探针连通成功，实测延迟: ${pingRes.latencyMs}ms`);

    // 3.2 模拟验签失败返回
    global.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          code: 5001,
          msg: "商户签名验签失败",
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const signFailRes = await testJeepayConnectionAction();
    assert.strictEqual(signFailRes.success, false, "网关返回验签失败应返回 false");
    assert.match(signFailRes.message, /签名校验失败/, "应明确提示签名校验失败");
    console.log("✓ 网关报签名错误时能够被精确识别");

    // 3.3 模拟网络异常 (ECONNREFUSED / 超时)
    global.fetch = (async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:9217");
    }) as typeof fetch;

    const connRefusedRes = await testJeepayConnectionAction();
    assert.strictEqual(connRefusedRes.success, false);
    assert.match(connRefusedRes.message, /ECONNREFUSED/);
    console.log("✓ 网络连接拒绝时正确捕获并返回友好错误信息");

    // -------------------------------------------------------------
    // Test 4: createJeepayTestOrderAction 创建 0.01 元测试订单
    // -------------------------------------------------------------
    console.log("\n[Test 4] 验证 createJeepayTestOrderAction 联调下单...");

    let orderReqBody: Record<string, unknown> | null = null;
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      orderReqBody = JSON.parse(String(init?.body || "{}"));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          code: 0,
          msg: "SUCCESS",
          data: {
            payOrderId: "P20261001" + Date.now(),
            mchOrderNo: orderReqBody?.mchOrderNo,
            orderState: 1,
            payDataType: "codeUrl",
            payData: "weixin://wxpay/bizpayurl?pr=TEST_PR_CODE_12345",
          },
        }),
      } as unknown as Response;
    }) as typeof fetch;

    // 4.1 默认聚合收银台渠道
    const orderResDefault = await createJeepayTestOrderAction();
    assert.strictEqual(orderResDefault.success, true);
    assert.strictEqual(orderResDefault.payDataType, "codeUrl");
    assert(
      orderResDefault.payOrderId?.startsWith("P20261001"),
      "应返回 Jeepay 支付单号"
    );
    assert.strictEqual(
      orderReqBody?.amount,
      1,
      "测试订单金额必须严格为 1 分钱 (0.01元)"
    );
    assert.strictEqual(
      orderReqBody?.wayCode,
      "QR_CASHIER",
      "默认 wayCode 应为 QR_CASHIER"
    );
    assert.match(
      String(orderReqBody?.subject),
      /0\.01元/,
      "订单标题应包含 0.01元"
    );
    console.log("✓ 默认 QR_CASHIER 下单成功，金额 0.01元 (1分)");

    // 4.2 指定 WX_NATIVE 渠道
    const orderResWx = await createJeepayTestOrderAction("WX_NATIVE");
    assert.strictEqual(orderResWx.success, true);
    assert.strictEqual(orderReqBody?.wayCode, "WX_NATIVE");
    console.log("✓ 指定 WX_NATIVE 渠道成功传递");

    // 4.3 验证 QRCode 库能够直接从 payData 生成二维码 DataURL
    const qrDataUrl = await QRCode.toDataURL(orderResWx.payData!, {
      width: 200,
      margin: 2,
    });
    assert(
      qrDataUrl.startsWith("data:image/png;base64,"),
      "QRCode 应成功生成 base64 PNG 图片 DataURL"
    );
    console.log("✓ QRCode.toDataURL 成功转换 payData 为手机扫码图片");

    // 恢复环境变量
    if (oldPayUrl) process.env.JEEPAY_PAY_URL = oldPayUrl;
    if (oldMchNo) process.env.JEEPAY_MCH_NO = oldMchNo;
    if (oldAppId) process.env.JEEPAY_APP_ID = oldAppId;
    if (oldApiKey) process.env.JEEPAY_API_KEY = oldApiKey;

    console.log("\n=======================================================");
    console.log("🎉 All Task 6 Jeepay Admin Tests Passed Successfully!");
    console.log("=======================================================\n");
  } finally {
    global.fetch = originalFetch;
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
