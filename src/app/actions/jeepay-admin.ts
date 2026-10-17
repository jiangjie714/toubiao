"use server";

import { getSession } from "@/lib/auth";
import {
  getJeepayConfig,
  isJeepayConfigured,
  buildJeepayParams,
  createJeepayOrder,
} from "@/lib/jeepay";

export interface JeepayConnectionTestResult {
  success: boolean;
  latencyMs?: number;
  message: string;
  data?: unknown;
}

export interface JeepayTestOrderResult {
  success: boolean;
  payOrderId?: string;
  payData?: string;
  payDataType?: string;
  error?: string;
}

/**
 * 校验 Jeepay 网关连通性与商户签名
 */
export async function testJeepayConnectionAction(): Promise<JeepayConnectionTestResult> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { success: false, message: "需要管理员权限" };
  }

  if (!isJeepayConfigured()) {
    return { success: false, message: "Jeepay 环境变量未配置或不完整" };
  }

  const config = getJeepayConfig();
  if (!config) {
    return { success: false, message: "Jeepay 环境变量未配置或不完整" };
  }

  const startTime = Date.now();
  let latencyMs = 0;

  try {
    const requestPayload = buildJeepayParams(
      { mchOrderNo: "PROBE_PING" },
      config
    );
    const url = `${config.payUrl}/api/pay/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(8000),
    });

    latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        latencyMs,
        message: `Jeepay 网关 HTTP 响应异常: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as {
      code?: number;
      msg?: string;
      [key: string]: unknown;
    };

    // 若网关返回验签失败，说明密钥或签名算法不匹配
    if (
      data.code !== undefined &&
      data.code !== 0 &&
      (data.msg?.includes("验签失败") ||
        data.msg?.includes("签名错误") ||
        data.msg?.includes("sign error"))
    ) {
      return {
        success: false,
        latencyMs,
        message: `Jeepay 网关签名校验失败: [${data.code}] ${data.msg}`,
        data,
      };
    }

    return {
      success: true,
      latencyMs,
      message: "网关与签名验证连通正常",
      data,
    };
  } catch (error: unknown) {
    latencyMs = latencyMs || Date.now() - startTime;
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      latencyMs,
      message: msg || "连接 Jeepay 网关失败",
    };
  }
}

/**
 * 发起 0.01 元测试订单联调
 */
export async function createJeepayTestOrderAction(
  wayCode?: string
): Promise<JeepayTestOrderResult> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { success: false, error: "需要管理员权限" };
  }

  if (!isJeepayConfigured()) {
    return { success: false, error: "Jeepay 环境变量未配置或不完整" };
  }

  try {
    const mchOrderNo = `TEST_${Date.now()}`;
    const targetWayCode = wayCode || "QR_CASHIER";
    const result = await createJeepayOrder({
      mchOrderNo,
      wayCode: targetWayCode,
      amount: 1, // 0.01 元 (1分)
      subject: "标讯通-Jeepay联调测试订单(0.01元)",
      body: "标讯通系统后台联调测试订单",
    });

    return {
      success: true,
      payOrderId: result.payOrderId,
      payData: result.payData,
      payDataType: result.payDataType,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: msg || "创建测试订单失败",
    };
  }
}
