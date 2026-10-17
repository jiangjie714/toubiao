# Jeepay 外部支付平台对接 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将标讯通商业化支付模块无缝对接外部（本地已部署）Jeepay 聚合支付中心，实现微信/支付宝统一下单扫码、异步 Webhook 回调验签、本地环境主动查单对账保底，以及后台诊断工具的全链路闭环。

**Architecture:** 
1. **网关 SDK 层 (`src/lib/jeepay.ts`)**：实现严格遵循 Jeepay 开放平台规范的 ASCII 字典序 MD5 签名/验签、`/api/pay/unifiedOrder` 统一下单、`/api/pay/query` 订单主动查单；
2. **预下单路由层 (`src/lib/payment-prepay.ts`)**：优先路由 Jeepay 网关（微信 `WX_NATIVE` / 支付宝 `ALI_QR`），生成真实动态收款码，并保留对公转账兜底；
3. **异步通知与幂等激活 (`src/app/api/payment/jeepay/notify/route.ts` & `src/lib/payments.ts`)**：接收 Jeepay 异步 POST 回调并执行签名验证，安全写入 `PaymentEvent` 并原子激活 `Subscription` 权益，响应标准 `success`；
4. **主动查询与本地联调双保险 (`src/app/actions/payments.ts`)**：在前台收银台轻量轮询及点击「我已支付」时主动请求 Jeepay `/api/pay/query`，彻底解决本地无公网穿透时回调受阻的即时核销难题；
5. **管理后台诊断与连通性验证 (`src/app/admin/settings/jeepay/`)**：提供商户号、AppID、密钥配置测试与 0.01 元沙箱/模拟联调工具。

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma 6 + PostgreSQL, Crypto (MD5), QRCode, Tailwind CSS v4.

---

## 任务拆解与执行步骤

### Task 1: Jeepay 核心 SDK 与 MD5 签名/验签实现

**Files:**
- Create: `src/lib/jeepay.ts`
- Test: `scripts/test-jeepay-sdk.ts`

**Step 1: 编写测试用例验证签名算法与参数过滤**

创建测试脚本 `scripts/test-jeepay-sdk.ts`，验证 Jeepay 官方签名标准（ASCII 升序、空值过滤、`&key=` 追加、大写 MD5、验签）：

```typescript
import assert from "node:assert";
import { generateJeepaySign, verifyJeepaySign, buildJeepayParams } from "../src/lib/jeepay";

// 1. 测试签名生成算法
const mockParams = {
  mchNo: "M1623984572",
  appId: "60cc09bce4b0f1c0b83761c9",
  mchOrderNo: "TB202610010001",
  amount: 29900,
  currency: "cny",
  emptyField: "",
  nullField: null,
};
const mockApiKey = "TEST_API_KEY_123456";

const sign = generateJeepaySign(mockParams, mockApiKey);
assert(typeof sign === "string" && sign.length === 32, "签名必须为 32 位 MD5 字符串");
assert(sign === sign.toUpperCase(), "签名必须全部为大写字母");

// 2. 测试验签
const verifyOk = verifyJeepaySign({ ...mockParams, sign }, mockApiKey);
assert(verifyOk === true, "合法签名验签应通过");

const verifyTampered = verifyJeepaySign({ ...mockParams, amount: 100, sign }, mockApiKey);
assert(verifyTampered === false, "篡改金额后验签必须失败");

console.log("✓ Task 1 Jeepay 签名/验签算法测试全部通过！");
```

**Step 2: 运行测试并验证失败**

运行：`npx tsx scripts/test-jeepay-sdk.ts`
预期：报错失败（模块尚未创建）

**Step 3: 实现 `src/lib/jeepay.ts` 核心逻辑**

编写完整生产级 Jeepay 交互客户端：

```typescript
import crypto from "node:crypto";

export interface JeepayConfig {
  payUrl: string;       // 例如: http://127.0.0.1:9217
  mchNo: string;        // 商户号
  appId: string;        // 应用ID
  apiKey: string;       // API密钥
  notifyUrl: string;    // 回调通知URL
  returnUrl?: string;   // 支付跳转返回URL
}

export interface JeepayUnifiedOrderParams {
  mchOrderNo: string;
  wayCode: string;      // 例如: WX_NATIVE, ALI_QR, QR_CASHIER
  amount: number;       // 单位: 分 (整数)
  subject: string;
  body?: string;
  clientIp?: string;
  channelExtra?: Record<string, unknown>;
}

export interface JeepayUnifiedOrderResult {
  payOrderId: string;
  mchOrderNo: string;
  orderState: number;   // 0-生成, 1-支付中, 2-成功, 3-失败, 4-撤销, 5-退款, 6-关闭
  payDataType: string;  // payUrl | codeUrl | form | wxapp | none
  payData: string;      // 实际支付参数 (二维码链接/跳转URL等)
  errCode?: string;
  errMsg?: string;
}

export interface JeepayQueryResult {
  payOrderId: string;
  mchOrderNo: string;
  orderState: number;   // 2 表示支付成功
  amount: number;       // 单位: 分
  currency: string;
  createdAt?: string;
  successTime?: string;
  errMsg?: string;
}

/** 获取系统配置的 Jeepay 参数 */
export function getJeepayConfig(): JeepayConfig | null {
  const payUrl = process.env.JEEPAY_PAY_URL;
  const mchNo = process.env.JEEPAY_MCH_NO;
  const appId = process.env.JEEPAY_APP_ID;
  const apiKey = process.env.JEEPAY_API_KEY;
  const notifyUrl = process.env.JEEPAY_NOTIFY_URL || "http://127.0.0.1:3000/api/payment/jeepay/notify";
  const returnUrl = process.env.JEEPAY_RETURN_URL;

  if (!payUrl || !mchNo || !appId || !apiKey) {
    return null;
  }

  return {
    payUrl: payUrl.replace(/\/+$/, ""),
    mchNo,
    appId,
    apiKey,
    notifyUrl,
    returnUrl,
  };
}

/** 是否已启用 Jeepay 对接 */
export function isJeepayConfigured(): boolean {
  return getJeepayConfig() !== null;
}

/** Jeepay MD5 签名生成器 (ASCII升序排序 + 拼接 &key= + 大写) */
export function generateJeepaySign(params: Record<string, unknown>, apiKey: string): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== null && String(params[k]).trim() !== "")
    .sort();

  const stringA = keys.map((k) => `${k}=${typeof params[k] === "object" ? JSON.stringify(params[k]) : params[k]}`).join("&");
  const stringSignTemp = `${stringA}&key=${apiKey}`;

  return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
}

/** 校验 Jeepay 回调或返回的签名 */
export function verifyJeepaySign(params: Record<string, unknown>, apiKey: string): boolean {
  const targetSign = String(params.sign ?? "").trim().toUpperCase();
  if (!targetSign) return false;

  const calculated = generateJeepaySign(params, apiKey);
  return crypto.timingSafeEqual(Buffer.from(targetSign), Buffer.from(calculated));
}

/** 底层统一请求方法 */
async function sendJeepayRequest<T>(endpoint: string, bizParams: Record<string, unknown>): Promise<{ code: number; msg: string; data?: T }> {
  const config = getJeepayConfig();
  if (!config) {
    throw new Error("Jeepay 支付中心未配置或配置不完整");
  }

  const reqTime = Date.now();
  const requestPayload: Record<string, unknown> = {
    mchNo: config.mchNo,
    appId: config.appId,
    reqTime,
    version: "1.0",
    signType: "MD5",
    ...bizParams,
  };

  requestPayload.sign = generateJeepaySign(requestPayload, config.apiKey);

  const url = `${config.payUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    throw new Error(`Jeepay 网关 HTTP 请求异常: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { code: number; msg: string; data?: T; sign?: string };
  return result;
}

/** 统一下单接口 (/api/pay/unifiedOrder) */
export async function createJeepayOrder(params: JeepayUnifiedOrderParams): Promise<JeepayUnifiedOrderResult> {
  const config = getJeepayConfig();
  if (!config) throw new Error("Jeepay 未配置");

  const bizParams: Record<string, unknown> = {
    mchOrderNo: params.mchOrderNo,
    wayCode: params.wayCode,
    amount: params.amount,
    currency: "cny",
    subject: params.subject,
    body: params.body || params.subject,
    notifyUrl: config.notifyUrl,
    ...(config.returnUrl ? { returnUrl: config.returnUrl } : {}),
    ...(params.clientIp ? { clientIp: params.clientIp } : { clientIp: "127.0.0.1" }),
    ...(params.channelExtra ? { channelExtra: JSON.stringify(params.channelExtra) } : {}),
  };

  const res = await sendJeepayRequest<JeepayUnifiedOrderResult>("/api/pay/unifiedOrder", bizParams);
  if (res.code !== 0 || !res.data) {
    throw new Error(`Jeepay 下单失败: [${res.code}] ${res.msg || "未知错误"}`);
  }

  return res.data;
}

/** 订单主动查单接口 (/api/pay/query) */
export async function queryJeepayOrder(query: { mchOrderNo?: string; payOrderId?: string }): Promise<JeepayQueryResult | null> {
  const config = getJeepayConfig();
  if (!config) return null;

  if (!query.mchOrderNo && !query.payOrderId) {
    throw new Error("查单必须提供 mchOrderNo 或 payOrderId");
  }

  const bizParams: Record<string, unknown> = {};
  if (query.mchOrderNo) bizParams.mchOrderNo = query.mchOrderNo;
  if (query.payOrderId) bizParams.payOrderId = query.payOrderId;

  const res = await sendJeepayRequest<JeepayQueryResult>("/api/pay/query", bizParams);
  if (res.code !== 0 || !res.data) {
    return null;
  }

  return res.data;
}
```

**Step 4: 重新运行测试并验证通过**

运行：`npx tsx scripts/test-jeepay-sdk.ts`
预期：输出 `✓ Task 1 Jeepay 签名/验签算法测试全部通过！`

---

### Task 2: 预下单适配层 (`src/lib/payment-prepay.ts`) 改造

**Files:**
- Modify: `src/lib/payment-prepay.ts`
- Test: `scripts/test-prepay-jeepay.ts`

**Step 1: 编写测试用例**

创建 `scripts/test-prepay-jeepay.ts` 模拟环境变量开启与关闭时，`createPrepay` 是否正确分发至 Jeepay 通道与降级通道。

**Step 2: 改造 `src/lib/payment-prepay.ts` 支持 Jeepay 优先**

- 当 `isJeepayConfigured()` 为 true 时：
  - 若 `channel === "wechat"`，使用 `wayCode = process.env.JEEPAY_WAYCODE_WECHAT || "WX_NATIVE"` 调用 `createJeepayOrder`；
  - 若 `channel === "alipay"`，使用 `wayCode = process.env.JEEPAY_WAYCODE_ALIPAY || "ALI_QR"` 调用 `createJeepayOrder`；
  - 若 `channel === "jeepay"`，使用 `wayCode = process.env.JEEPAY_WAYCODE_CASHIER || "QR_CASHIER"`；
  - 获取返回的 `payData` 作为 `code`，过期时间设为 2 小时；
- 若未配置 Jeepay，则平滑回退至原有的直连微信/支付宝逻辑或报错；
- 扩展 `PaymentChannel` 类型定义为 `"wechat" | "alipay" | "jeepay"`。

**Step 3: 运行测试确认通过**

运行：`npx tsx scripts/test-prepay-jeepay.ts`
预期：PASS

---

### Task 3: 异步通知接收路由与订单激活 (`/api/payment/jeepay/notify`)

**Files:**
- Create: `src/app/api/payment/jeepay/notify/route.ts`
- Modify: `src/lib/payments.ts`
- Test: `scripts/test-jeepay-notify.ts`

**Step 1: 编写测试脚本模拟 Jeepay Webhook**

创建 `scripts/test-jeepay-notify.ts`：
1. 构造一个包含合法签名、`state=2`（支付成功）、订单号、支付金额的通知报文；
2. 验证验签与 `processPaymentNotification` 幂等激活逻辑；
3. 验证被篡改的报文返回拒绝。

**Step 2: 在 `src/lib/payments.ts` 中增强 Jeepay 通知解析**

在 `src/lib/payments.ts` 中：
- 导出 `parseJeepayNotification(params: Record<string, unknown>): PaymentNotification | null`；
- 适配 `PaymentProvider = "alipay" | "wechat" | "jeepay"`；
- 在 `processPaymentNotification` 中适配渠道检查：若订单渠道为 `wechat` 或 `alipay` 且接入了 Jeepay 网关，或订单渠道为 `jeepay`，均接受 provider 为 `jeepay` 的合法收款事件。

**Step 3: 创建 Webhook 路由 `src/app/api/payment/jeepay/notify/route.ts`**

- 接收 POST 请求，支持解析 `application/x-www-form-urlencoded` 与 `application/json`；
- 读取系统 `JEEPAY_API_KEY`，调用 `verifyJeepaySign(params, apiKey)` 进行严格验签；
- 验签失败直接返回 HTTP 400，响应文本 `FAIL`；
- 验签成功调用 `parseJeepayNotification(params)`；
- 调用 `processPaymentNotification(notification)`，激活订单与用户会员时长；
- 处理成功必须返回纯文本 `success`（Jeepay 标准响应码）。

**Step 4: 运行通知测试并确认全部通过**

运行：`npx tsx scripts/test-jeepay-notify.ts`
预期：PASS

---

### Task 4: 前台收银台轻量轮询与主动查单双保险

**Files:**
- Modify: `src/app/actions/payments.ts`
- Test: `scripts/test-jeepay-query-sync.ts`

**Step 1: 编写测试用例**

创建 `scripts/test-jeepay-query-sync.ts` 测试主动查单同步流：
当订单处于 `PENDING` 或 `WAIT_VERIFY` 时，调用 `syncOrderStatusFromJeepay(orderNo)`，若外部已支付（`orderState === 2`），应成功将订单变更为 `PAID` 并返回最新状态。

**Step 2: 改造 `pollOrderStatusAction` 与 `notifyOrderPaidAction`**

在 `src/app/actions/payments.ts` 中：
- 增加辅助函数 `syncOrderStatusFromJeepay(orderNo: string)`：
  - 检查订单是否处于待支付或待审核状态；
  - 若配置了 Jeepay，主动发起 `queryJeepayOrder({ mchOrderNo: orderNo })`；
  - 若查询到 `orderState === 2`（支付成功），立即调用 `activatePaidOrder(order.id, { transactionNo: res.payOrderId, paidAt: res.successTime ? new Date(res.successTime) : new Date() })`；
  - 记录 `PaymentEvent` 日志；
- 在 `pollOrderStatusAction(orderNo)` 中：
  - 若数据库中订单仍是 `PENDING` 且启用了 Jeepay，执行一次轻量主动查单探测；
  - 探测成功即时返回最新 `PAID` 状态，页面无需手动刷新即可直接生效！
- 在 `notifyOrderPaidAction(input)` 中：
  - 当用户在收银台点击「我已完成支付」时，先调用 `syncOrderStatusFromJeepay` 尝试秒级自动对账；
  - 若查单已确认到账，直接开通，无需人工审核；
  - 若查单尚未到账，才顺滑转入人工审核流程并发送管理员工单。

**Step 3: 运行查单同步测试确认通过**

运行：`npx tsx scripts/test-jeepay-query-sync.ts`
预期：PASS

---

### Task 5: 收银台前端交互与动态二维码适配

**Files:**
- Modify: `src/app/(site)/pay/[orderNo]/page.tsx`
- Modify: `src/components/pay-cashier-view.tsx`

**Step 1: 优化 `/pay/[orderNo]/page.tsx`**

- 当已配置 Jeepay 且订单已有 `prepayCode`（即 Jeepay 统一下单返回的二维码链接，如微信 `weixin://wxpay/bizpayurl?...` 或支付宝 `https://qr.alipay.com/...`）：
  - 使用 `QRCode.toDataURL(order.prepayCode)` 渲染真实的扫码付二维码；
- 若订单尚无有效 `prepayCode` 或已过期，自动在页面加载时调用 `preparePrepay` 预下单并生成最新收款码；
- 将 `payType`（二维码/跳转链接）传递给前端组件，支持若 Jeepay 返回的是跳转页（PC支付链接），收银台同时展示「点击直接在新窗口付款」按钮。

**Step 2: 优化 `PayCashierView` 状态提示**

- 增加对“Jeepay 自动网关已就绪”的状态标签；
- 无论通过微信还是支付宝扫码付款，展示对应的扫码提示；
- 轮询组件无感检测主动查单结果，一旦扫码支付成功，1~2 秒内自动触发礼花效果并引导进入系统。

---

### Task 6: 管理后台 Jeepay 配置与联调工具

**Files:**
- Create: `src/app/admin/settings/jeepay/page.tsx`
- Create: `src/app/actions/jeepay-admin.ts`
- Modify: `src/app/admin/layout.tsx` (在侧边栏或系统设置中添加 Jeepay 入口)

**Step 1: 编写后台 Jeepay 联调诊断 Server Action**

创建 `src/app/actions/jeepay-admin.ts`：
- `testJeepayConnectionAction()`：
  - 测试 `JEEPAY_PAY_URL` 连通性；
  - 使用当前商户号/AppID 发起一次沙箱查询或下单测试；
  - 返回详细的连通状态、响应耗时、错误排查建议；
- `createJeepayTestOrderAction()`：
  - 允许管理员在后台直接生成一笔 0.01 元的测试订单并拉起二维码，验证全流程收银与回调。

**Step 2: 创建可视化诊断看板页面**

创建 `src/app/admin/settings/jeepay/page.tsx`：
- 展示当前环境变量生效情况（隐藏核心密钥敏感位）；
- 一键点击「连通性与签名验证测试」；
- 显示最近 10 条 Jeepay 相关的 `PaymentEvent` 接收日志与处理状态；
- 提供本地开发常见问题指引（如：端口配置、通道开启状态、本地 IP 回调配置等）。

---

### Task 7: 环境变量规范、全链路端到端集成测试与验证

**Files:**
- Modify: `.env.example`
- Create: `scripts/test-jeepay-full-flow.ts`

**Step 1: 完善 `.env.example`**

添加清晰的中文环境变量注释：
```bash
# ==============================================================================
# Jeepay 聚合支付中心对接配置 (本地或外部部署)
# 平台文档参考: https://doc.jeequan.com/#/integrate/open
# ==============================================================================
# Jeepay 支付网关地址 (本地部署默认端口为 9217，如: http://127.0.0.1:9217)
JEEPAY_PAY_URL=http://127.0.0.1:9217

# Jeepay 分配的商户号 (例如: M1623984572)
JEEPAY_MCH_NO=M1623984572

# Jeepay 商户应用 ID (例如: 60cc09bce4b0f1c0b83761c9)
JEEPAY_APP_ID=60cc09bce4b0f1c0b83761c9

# Jeepay 商户应用 API Key (用于 MD5 签名与验签，必须与后台完全一致)
JEEPAY_API_KEY=your_jeepay_api_key_here

# 异步回调地址 (外网可访问 URL 或本地反代地址)
JEEPAY_NOTIFY_URL=http://127.0.0.1:3000/api/payment/jeepay/notify

# 支付方式代码映射 (可选，默认为标准扫码付)
JEEPAY_WAYCODE_WECHAT=WX_NATIVE
JEEPAY_WAYCODE_ALIPAY=ALI_QR
JEEPAY_WAYCODE_CASHIER=QR_CASHIER
```

**Step 2: 编写全链路端到端测试脚本 `scripts/test-jeepay-full-flow.ts`**

覆盖全流程自动化验证：
1. 模拟初始化测试用户与套餐订单；
2. 模拟调用 `createJeepayOrder` 统一下单生成预支付凭据；
3. 验证 `prepayCode` 成功注入订单；
4. 模拟向 `/api/payment/jeepay/notify` 发送合法回调报文；
5. 验证订单自动变更为 `PAID`；
6. 验证对应用户的 `Subscription` 正确被激活、有效期从今天起精准计算；
7. 验证重复发送回调报文时的幂等性（不重复延长会员时长）；
8. 清理测试数据。

**Step 3: 运行完整检查**

```bash
npx tsx scripts/test-jeepay-full-flow.ts
npx tsc --noEmit
npm run lint
```
预期：
- 全链路测试脚本输出全部通过
- TypeScript 类型检查 0 错误
- ESLint 检查 0 警告

---

## 交付物与执行选项 (Execution Handoff)

Plan complete and saved to `docs/plans/2026-10-01-jeepay-payment-integration.md`. Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagents per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** - Open a new session with executing-plans, batch execution with checkpoints.

**Which approach would you prefer?**
