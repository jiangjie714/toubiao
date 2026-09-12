"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { generateRawApiKey } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";

export interface ApiKeyItem {
  id: number;
  name: string;
  keyPrefix: string;
  monthlyQuota: number;
  usedCalls: number;
  rateLimitRpm: number;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ApiKeyListResult {
  success: boolean;
  error?: string;
  keys?: ApiKeyItem[];
  stats?: {
    totalKeys: number;
    activeKeys: number;
    totalUsed: number;
    totalQuota: number;
  };
  canCreateMore?: boolean;
}

export async function getUserApiKeysAction(): Promise<ApiKeyListResult> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后访问开发者中心" };
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.uid },
      orderBy: { createdAt: "desc" },
    });

    let totalUsed = 0;
    let totalQuota = 0;
    let activeKeys = 0;

    const formattedKeys: ApiKeyItem[] = keys.map((k) => {
      totalUsed += k.usedCalls;
      totalQuota += k.monthlyQuota;
      if (k.status === "ACTIVE") activeKeys += 1;

      return {
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        monthlyQuota: k.monthlyQuota,
        usedCalls: k.usedCalls,
        rateLimitRpm: k.rateLimitRpm,
        status: k.status,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString().replace("T", " ").slice(0, 19) : null,
        createdAt: k.createdAt.toISOString().slice(0, 10),
      };
    });

    return {
      success: true,
      keys: formattedKeys,
      stats: {
        totalKeys: keys.length,
        activeKeys,
        totalUsed,
        totalQuota,
      },
      canCreateMore: activeKeys < 5,
    };
  } catch (err) {
    console.error("Failed to list API keys:", err);
    return { success: false, error: "获取 API 密钥列表失败" };
  }
}

export async function createApiKeyAction(name: string): Promise<{
  success: boolean;
  error?: string;
  rawKey?: string;
  key?: ApiKeyItem;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 50) {
      return { success: false, error: "请输入有效的密钥名称（1-50字）" };
    }

    const activeCount = await prisma.apiKey.count({
      where: { userId: user.uid, status: "ACTIVE" },
    });

    if (activeCount >= 5) {
      return { success: false, error: "每个账户最多同时保留 5 个活跃 API Key" };
    }

    const entitlement = await getEntitlement(user.uid);
    const isAdmin = user.role === "ADMIN";
    const isEnterprise =
      entitlement.planCode === "PLATINUM" || entitlement.planCode === "ENTERPRISE";

    // 默认月度配额：企业/白金/管理员为 10,000 次，普通体验用户为 200 次（提供免费开发者体验）
    const quota = isAdmin || isEnterprise ? 10000 : 200;

    const { rawKey, keyPrefix, keyHash } = generateRawApiKey();

    const created = await prisma.apiKey.create({
      data: {
        userId: user.uid,
        name: trimmedName,
        keyPrefix,
        keyHash,
        monthlyQuota: quota,
        usedCalls: 0,
        rateLimitRpm: 60,
        status: "ACTIVE",
      },
    });

    revalidatePath("/developer");

    return {
      success: true,
      rawKey,
      key: {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        monthlyQuota: created.monthlyQuota,
        usedCalls: created.usedCalls,
        rateLimitRpm: created.rateLimitRpm,
        status: created.status,
        lastUsedAt: null,
        createdAt: created.createdAt.toISOString().slice(0, 10),
      },
    };
  } catch (err) {
    console.error("Failed to create API key:", err);
    return { success: false, error: "创建 API Key 失败，请稍后重试" };
  }
}

export async function revokeApiKeyAction(keyId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const existing = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!existing) {
      return { success: false, error: "密钥不存在" };
    }

    if (existing.userId !== user.uid && user.role !== "ADMIN") {
      return { success: false, error: "无权操作该密钥" };
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { status: "REVOKED" },
    });

    revalidatePath("/developer");
    return { success: true };
  } catch (err) {
    console.error("Failed to revoke API key:", err);
    return { success: false, error: "吊销密钥失败" };
  }
}
