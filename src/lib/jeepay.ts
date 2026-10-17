import crypto from "node:crypto";

export interface JeepayConfig {
  payUrl: string; // 例如: http://127.0.0.1:9217
  mchNo: string; // 商户号
  appId: string; // 应用ID
  apiKey: string; // API密钥
  notifyUrl: string; // 回调通知URL
  returnUrl?: string; // 支付跳转返回URL
}

export interface JeepayUnifiedOrderParams {
  mchOrderNo: string;
  wayCode: string; // 例如: WX_NATIVE, ALI_QR, QR_CASHIER
  amount: number; // 单位: 分 (整数)
  subject: string;
  body?: string;
  clientIp?: string;
  channelExtra?: Record<string, unknown>;
}

export interface JeepayUnifiedOrderResult {
  payOrderId: string;
  mchOrderNo: string;
  orderState: number; // 0-生成, 1-支付中, 2-成功, 3-失败, 4-撤销, 5-退款, 6-关闭
  payDataType: string; // payUrl | codeUrl | form | wxapp | none
  payData: string; // 实际支付参数 (二维码链接/跳转URL等)
  errCode?: string;
  errMsg?: string;
}

export interface JeepayQueryResult {
  payOrderId: string;
  mchOrderNo: string;
  orderState: number; // 2 表示支付成功
  amount: number; // 单位: 分
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
  const notifyUrl =
    process.env.JEEPAY_NOTIFY_URL ||
    "http://127.0.0.1:3000/api/payment/jeepay/notify";
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
export function generateJeepaySign(
  params: Record<string, unknown>,
  apiKey: string
): string {
  const keys = Object.keys(params)
    .filter(
      (k) =>
        k !== "sign" &&
        params[k] !== undefined &&
        params[k] !== null &&
        String(params[k]).trim() !== ""
    )
    .sort();

  const stringA = keys
    .map(
      (k) =>
        `${k}=${
          typeof params[k] === "object" ? JSON.stringify(params[k]) : params[k]
        }`
    )
    .join("&");
  const stringSignTemp = `${stringA}&key=${apiKey}`;

  return crypto
    .createHash("md5")
    .update(stringSignTemp, "utf8")
    .digest("hex")
    .toUpperCase();
}

/** 校验 Jeepay 回调或返回的签名 */
export function verifyJeepaySign(
  params: Record<string, unknown>,
  apiKey: string
): boolean {
  const targetSign = String(params.sign ?? "").trim().toUpperCase();
  if (!targetSign || targetSign.length !== 32) return false;

  const calculated = generateJeepaySign(params, apiKey);
  const targetBuf = Buffer.from(targetSign, "utf8");
  const calcBuf = Buffer.from(calculated, "utf8");

  if (targetBuf.length !== calcBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(targetBuf, calcBuf);
}

/** 构建并自动加签统一请求报文 */
export function buildJeepayParams(
  bizParams: Record<string, unknown>,
  config?: JeepayConfig | null
): Record<string, unknown> {
  const cfg = config || getJeepayConfig();
  if (!cfg) {
    throw new Error("Jeepay 支付中心未配置或配置不完整");
  }

  const payload: Record<string, unknown> = {
    mchNo: cfg.mchNo,
    appId: cfg.appId,
    reqTime: Date.now(),
    version: "1.0",
    signType: "MD5",
    ...bizParams,
  };

  payload.sign = generateJeepaySign(payload, cfg.apiKey);
  return payload;
}

/** 底层统一请求方法 */
async function sendJeepayRequest<T>(
  endpoint: string,
  bizParams: Record<string, unknown>
): Promise<{ code: number; msg: string; data?: T; sign?: string }> {
  const config = getJeepayConfig();
  if (!config) {
    throw new Error("Jeepay 支付中心未配置或配置不完整");
  }

  const requestPayload = buildJeepayParams(bizParams, config);

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
    throw new Error(
      `Jeepay 网关 HTTP 请求异常: ${response.status} ${response.statusText}`
    );
  }

  const result = (await response.json()) as {
    code: number;
    msg: string;
    data?: T;
    sign?: string;
  };
  return result;
}

/** 统一下单接口 (/api/pay/unifiedOrder) */
export async function createJeepayOrder(
  params: JeepayUnifiedOrderParams
): Promise<JeepayUnifiedOrderResult> {
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
    ...(params.channelExtra
      ? { channelExtra: JSON.stringify(params.channelExtra) }
      : {}),
  };

  const res = await sendJeepayRequest<JeepayUnifiedOrderResult>(
    "/api/pay/unifiedOrder",
    bizParams
  );
  if (res.code !== 0 || !res.data) {
    throw new Error(`Jeepay 下单失败: [${res.code}] ${res.msg || "未知错误"}`);
  }

  return res.data;
}

/** 订单主动查单接口 (/api/pay/query) */
export async function queryJeepayOrder(query: {
  mchOrderNo?: string;
  payOrderId?: string;
}): Promise<JeepayQueryResult | null> {
  const config = getJeepayConfig();
  if (!config) return null;

  if (!query.mchOrderNo && !query.payOrderId) {
    throw new Error("查单必须提供 mchOrderNo 或 payOrderId");
  }

  const bizParams: Record<string, unknown> = {};
  if (query.mchOrderNo) bizParams.mchOrderNo = query.mchOrderNo;
  if (query.payOrderId) bizParams.payOrderId = query.payOrderId;

  const res = await sendJeepayRequest<JeepayQueryResult>(
    "/api/pay/query",
    bizParams
  );
  if (res.code !== 0 || !res.data) {
    return null;
  }

  return res.data;
}
