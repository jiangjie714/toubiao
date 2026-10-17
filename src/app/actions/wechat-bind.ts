"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getWechatMpConfig } from "@/lib/wechat-service";
import QRCode from "qrcode";

export interface WechatBindStatus {
  isBound: boolean;
  wechatOpenId?: string | null;
  maskedOpenId?: string | null;
  isWechatConfigured: boolean;
  appId?: string;
}

export async function getWechatBindStatusAction(): Promise<WechatBindStatus> {
  const session = await getSession();
  if (!session) {
    return { isBound: false, isWechatConfigured: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { wechatOpenId: true },
  });

  const config = getWechatMpConfig();
  const openId = user?.wechatOpenId;
  const maskedOpenId = openId
    ? openId.length > 8
      ? `${openId.slice(0, 4)}****${openId.slice(-4)}`
      : openId
    : null;

  return {
    isBound: Boolean(openId),
    wechatOpenId: openId,
    maskedOpenId,
    isWechatConfigured: config.isConfigured,
    appId: config.appId || undefined,
  };
}

export async function generateWechatBindQrAction(): Promise<{
  success: boolean;
  qrCodeDataUrl?: string;
  ticket?: string;
  isSimulation: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, isSimulation: false, error: "未登录" };
  }

  const config = getWechatMpConfig();
  const bindTicket = `BIND_${session.uid}_${Date.now()}`;

  // 如果未配置官方微信服务号秘钥，生成带参模拟绑定二维码
  if (!config.isConfigured) {
    const simulationUrl = `https://toubiao.com/wechat/mock-bind?ticket=${bindTicket}&uid=${session.uid}`;
    const qrDataUrl = await QRCode.toDataURL(simulationUrl, {
      margin: 1,
      width: 240,
      color: { dark: "#0f172a", light: "#ffffff" },
    });

    return {
      success: true,
      qrCodeDataUrl: qrDataUrl,
      ticket: bindTicket,
      isSimulation: true,
    };
  }

  // 若已配置真实微信服务号，调用生成带参临时二维码接口
  try {
    const { getWechatAccessToken } = await import("@/lib/wechat-service");
    const token = await getWechatAccessToken();
    if (!token) {
      throw new Error("获取微信接口 Token 失败");
    }

    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expire_seconds: 600,
          action_name: "QR_STR_SCENE",
          action_info: {
            scene: { scene_str: `bind_${session.uid}` },
          },
        }),
      }
    );

    const data = await res.json();
    if (data.ticket) {
      const wechatQrUrl = `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(
        data.ticket
      )}`;
      const qrDataUrl = await QRCode.toDataURL(wechatQrUrl, {
        margin: 1,
        width: 240,
      });

      return {
        success: true,
        qrCodeDataUrl: qrDataUrl,
        ticket: data.ticket,
        isSimulation: false,
      };
    }

    throw new Error(data.errmsg || "获取微信二维码 Ticket 失败");
  } catch (err) {
    return {
      success: false,
      isSimulation: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 模拟一键绑定（用于未开通服务号时的演示与测试闭环）
 */
export async function simulateBindWechatAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: "未登录" };

  const mockOpenId = `wx_mp_${session.uid}_${Math.random().toString(36).slice(2, 8)}`;
  await prisma.user.update({
    where: { id: session.uid },
    data: { wechatOpenId: mockOpenId },
  });

  revalidatePath("/watches");
  revalidatePath("/admin/users");
  return { success: true };
}

/**
 * 解绑微信服务号
 */
export async function unbindWechatAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: "未登录" };

  await prisma.user.update({
    where: { id: session.uid },
    data: { wechatOpenId: null },
  });

  revalidatePath("/watches");
  revalidatePath("/admin/users");
  return { success: true };
}
