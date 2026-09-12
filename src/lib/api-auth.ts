import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { ApiKey, User } from "@prisma/client";

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
}

export function generateRawApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const hex = crypto.randomBytes(16).toString("hex");
  const rawKey = `bx_live_${hex}`;
  const keyPrefix = `bx_live_${hex.slice(0, 4)}...${hex.slice(-4)}`;
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

export interface ApiAuthResult {
  ok: boolean;
  error?: string;
  statusCode?: number;
  apiKey?: ApiKey & { user: User };
  quotaRemaining?: number;
}

export async function authenticateApiKey(request: Request): Promise<ApiAuthResult> {
  // 1. 获取 Authorization Bearer 或 X-Api-Key 请求头
  const authHeader = request.headers.get("authorization");
  const customHeader = request.headers.get("x-api-key");

  let rawKey = "";
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    rawKey = authHeader.slice(7).trim();
  } else if (customHeader) {
    rawKey = customHeader.trim();
  }

  if (!rawKey) {
    return {
      ok: false,
      error: "未提供 API Key。请在请求头设置 Authorization: Bearer <API_KEY> 或 X-Api-Key: <API_KEY>",
      statusCode: 401,
    };
  }

  if (!rawKey.startsWith("bx_live_") && !rawKey.startsWith("bx_test_")) {
    return {
      ok: false,
      error: "无效的 API Key 格式，请检查密钥是否正确",
      statusCode: 401,
    };
  }

  const keyHash = hashApiKey(rawKey);

  // 2. 查询数据库
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey) {
    return {
      ok: false,
      error: "API Key 不存在或已失效",
      statusCode: 401,
    };
  }

  if (apiKey.status !== "ACTIVE") {
    return {
      ok: false,
      error: "该 API Key 已被管理员或用户本人吊销 (REVOKED)",
      statusCode: 403,
    };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      ok: false,
      error: "该 API Key 已超出有效期，请前往开发者中心重新生成",
      statusCode: 403,
    };
  }

  if (apiKey.user.status !== "ACTIVE") {
    return {
      ok: false,
      error: "关联的用户账号处于非活跃状态",
      statusCode: 403,
    };
  }

  // 3. 配额检查
  if (apiKey.usedCalls >= apiKey.monthlyQuota) {
    return {
      ok: false,
      error: `本月 API 调用配额已耗尽 (${apiKey.usedCalls}/${apiKey.monthlyQuota})。请在开发者中心升级或重置额度。`,
      statusCode: 429,
    };
  }

  // 4. 原子自增调用计数并刷新最近调用时间
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      usedCalls: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  const remaining = Math.max(0, apiKey.monthlyQuota - (apiKey.usedCalls + 1));

  return {
    ok: true,
    apiKey,
    quotaRemaining: remaining,
  };
}
