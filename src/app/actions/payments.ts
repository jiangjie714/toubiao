"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createPrepay, isPrepayUsable, type PaymentChannel } from "@/lib/payment-prepay";
import { activatePaidOrder } from "@/lib/commerce";
import { allocateMatchingCode, verifyAuditToken } from "@/lib/payments";
import { sendAdminPaymentNotification } from "@/lib/payment-notify";
import { isJeepayConfigured, queryJeepayOrder } from "@/lib/jeepay";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // 忽略在独立测试或离线脚本中缺少 Next.js 静态上下文的异常
  }
}

function makeOrderNo(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `TB${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function cycleLabel(cycle: string): string {
  return cycle === "monthly" ? "月付" : "年付";
}

export async function preparePrepay(
  order: { id: number; orderNo: string; channel: string; amount: Prisma.Decimal | number; planId: number; billingCycle: string },
): Promise<string | null> {
  const plan = await prisma.plan.findUnique({ where: { id: order.planId } });
  try {
    const prepay = await createPrepay(
      order.channel as PaymentChannel,
      { orderNo: order.orderNo, amount: order.amount as unknown as Prisma.Decimal },
      `标讯通${plan?.name ?? "会员"}-${cycleLabel(order.billingCycle)}`,
    );
    await prisma.order.update({
      where: { id: order.id },
      data: { prepayCode: prepay.code, prepayExpiresAt: prepay.expiresAt },
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "支付渠道暂不可用";
  }
}

export async function createOnlineOrderAction(formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user) redirect("/login?next=/pricing");

  const planCode = String(formData.get("planCode") ?? "");
  const billingCycle = String(formData.get("billingCycle") ?? "monthly");
  const channel = String(formData.get("channel") ?? "");
  if (!["monthly", "yearly"].includes(billingCycle)) redirect("/pricing?error=cycle");
  if (!["wechat", "alipay", "bank", "jeepay"].includes(channel)) redirect("/pricing?error=channel");

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active || plan.code === "FREE") redirect("/pricing?error=plan");

  const amount = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  if (amount === null || amount === undefined) redirect("/pricing?error=price");

  const pending = await prisma.order.findFirst({
    where: {
      userId: user.uid,
      planId: plan.id,
      billingCycle,
      channel,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNo: true,
      channel: true,
      amount: true,
      planId: true,
      billingCycle: true,
      prepayCode: true,
      prepayExpiresAt: true,
    },
  });

  let order = pending;
  if (!order) {
    const orderNo = makeOrderNo();
    const matchingCode = await allocateMatchingCode(orderNo);
    order = await prisma.order.create({
      data: {
        orderNo,
        matchingCode,
        userId: user.uid,
        planId: plan.id,
        billingCycle,
        amount,
        channel,
        status: "PENDING",
      },
      select: {
        id: true,
        orderNo: true,
        channel: true,
        amount: true,
        planId: true,
        billingCycle: true,
        prepayCode: true,
        prepayExpiresAt: true,
      },
    });
  }

  let prepayError: string | null = null;
  if (channel !== "bank" && !isPrepayUsable(order)) {
    prepayError = await preparePrepay(order);
  }

  safeRevalidatePath("/pricing");
  safeRevalidatePath("/admin/orders");
  const query = prepayError ? `?error=prepay` : "";
  redirect(`/pay/${order.orderNo}${query}`);
}

export async function refreshPrepayAction(formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user) redirect("/login?next=/pricing");

  const orderNo = String(formData.get("orderNo") ?? "");
  const order = await prisma.order.findFirst({
    where: { orderNo, userId: user.uid },
    select: {
      id: true,
      orderNo: true,
      channel: true,
      amount: true,
      planId: true,
      billingCycle: true,
      status: true,
      prepayCode: true,
      prepayExpiresAt: true,
    },
  });
  if (!order) redirect("/pricing?error=order");
  if (order.status !== "PENDING") redirect(`/pay/${order.orderNo}`);

  const prepayError = await preparePrepay(order);
  safeRevalidatePath(`/pay/${order.orderNo}`);
  redirect(`/pay/${order.orderNo}${prepayError ? "?error=prepay" : ""}`);
}

export async function submitBankProofAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "未登录" };

    const orderNo = String(formData.get("orderNo") ?? "").trim();
    const bankName = String(formData.get("bankName") ?? "").trim();
    const payerName = String(formData.get("payerName") ?? "").trim();
    const transactionRef = String(formData.get("transactionRef") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (!orderNo) return { success: false, error: "订单号缺失" };
    if (!payerName || !transactionRef) {
      return { success: false, error: "请填写汇款户名与银行流水号/参考号" };
    }

    const order = await prisma.order.findFirst({
      where: { orderNo, userId: user.uid },
      include: { plan: true },
    });

    if (!order) return { success: false, error: "未找到对应订单" };
    if (order.status !== "PENDING" && order.status !== "WAIT_VERIFY") {
      return { success: false, error: "当前订单状态不可提交凭证" };
    }

    let matchingCode = order.matchingCode;
    if (!matchingCode) {
      matchingCode = await allocateMatchingCode(order.orderNo);
    }

    const proofNote = `【对公汇款凭证】汇款户名: ${payerName} | 汇款银行: ${bankName || "未填"} | 银行流水号: ${transactionRef}${note ? ` | 备注: ${note}` : ""}`;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        note: proofNote,
        status: "WAIT_VERIFY",
        paidNoticeAt: new Date(),
        auditStatus: "PENDING",
        matchingCode,
      },
    });

    await sendAdminPaymentNotification({
      orderNo: order.orderNo,
      userName: user.name || user.username,
      userEmail: user.username.includes("@") ? user.username : undefined,
      planName: order.plan.name,
      billingCycle: order.billingCycle,
      amount: order.amount.toString(),
      channel: "bank",
      matchingCode,
      note: proofNote,
    });

    safeRevalidatePath(`/pay/${orderNo}`);
    safeRevalidatePath("/admin/orders");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "提交打款凭证失败",
    };
  }
}

/**
 * 从 Jeepay 主动查单同步订单支付状态（双保险机制）
 * 当异步通知因网络抖动延迟或丢失时，通过主动查单完成核销
 */
export async function syncOrderStatusFromJeepay(orderNo: string): Promise<boolean> {
  const cleanOrderNo = orderNo.trim();
  if (!cleanOrderNo) return false;

  const order = await prisma.order.findUnique({
    where: { orderNo: cleanOrderNo },
  });
  if (!order) return false;
  if (order.status === "PAID") return true;

  if (isJeepayConfigured()) {
    try {
      const res = await queryJeepayOrder({ mchOrderNo: cleanOrderNo });
      if (res && res.orderState === 2) {
        const parsedTime = res.successTime
          ? new Date(Number(res.successTime) || res.successTime)
          : new Date();
        const paidAt = !isNaN(parsedTime.getTime()) ? parsedTime : new Date();

        await activatePaidOrder(order.id, {
          transactionNo: res.payOrderId,
          paidAt,
        });

        await prisma.paymentEvent.upsert({
          where: {
            provider_providerEventId: {
              provider: "jeepay",
              providerEventId: res.payOrderId,
            },
          },
          update: {
            orderNo: cleanOrderNo,
            status: "PROCESSED",
            processedAt: new Date(),
            payload: res as unknown as Prisma.InputJsonValue,
          },
          create: {
            provider: "jeepay",
            providerEventId: res.payOrderId,
            eventType: String(res.orderState),
            orderNo: cleanOrderNo,
            status: "PROCESSED",
            payload: res as unknown as Prisma.InputJsonValue,
            processedAt: new Date(),
          },
        });

        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/** 用户在收银台点击“我已完成支付”上报通知 */
export async function notifyOrderPaidAction(input: {
  orderNo: string;
  channel?: string;
  proofUrl?: string;
  note?: string;
}): Promise<{ success: boolean; error?: string; matchingCode?: string }> {
  try {
    const orderNo = input.orderNo.trim();
    if (!orderNo) return { success: false, error: "缺少订单号" };

    // 双保险机制：先主动向 Jeepay 查单同步最新支付状态
    await syncOrderStatusFromJeepay(orderNo);

    // 重新检查订单状态；如果已支付（如刚刚查单同步成功或已被异步通知核销），直接返回成功，无需进入人工审核流
    const existingOrder = await prisma.order.findUnique({
      where: { orderNo },
      select: { id: true, status: true, matchingCode: true },
    });
    if (existingOrder && existingOrder.status === "PAID") {
      safeRevalidatePath(`/pay/${orderNo}`);
      safeRevalidatePath("/admin/orders");
      return { success: true, matchingCode: existingOrder.matchingCode ?? "" };
    }

    const user = await getSession();
    if (!user) return { success: false, error: "未登录" };

    const order = await prisma.order.findFirst({
      where: { orderNo, userId: user.uid },
      include: { plan: true },
    });
    if (!order) return { success: false, error: "订单不存在" };
    if (order.status === "PAID") return { success: true, matchingCode: order.matchingCode ?? "" };

    let matchingCode = order.matchingCode;
    if (!matchingCode) {
      matchingCode = await allocateMatchingCode(order.orderNo);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "WAIT_VERIFY",
        paidNoticeAt: new Date(),
        auditStatus: "PENDING",
        matchingCode,
        ...(input.channel ? { channel: input.channel } : {}),
        ...(input.proofUrl ? { proofUrl: input.proofUrl } : {}),
        ...(input.note ? { note: input.note } : {}),
      },
    });

    await sendAdminPaymentNotification({
      orderNo: updated.orderNo,
      userName: user.name || user.username,
      userEmail: user.username.includes("@") ? user.username : undefined,
      planName: order.plan.name,
      billingCycle: updated.billingCycle,
      amount: updated.amount.toString(),
      channel: updated.channel,
      matchingCode: updated.matchingCode,
      note: input.note || (input.proofUrl ? "已上传付款截图凭据" : "客户已扫码并点击【我已完成支付】"),
    });

    safeRevalidatePath(`/pay/${orderNo}`);
    safeRevalidatePath("/admin/orders");
    return { success: true, matchingCode: updated.matchingCode ?? "" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "提交支付通知失败",
    };
  }
}

/** 前台自适应轻量轮询订单状态 */
export async function pollOrderStatusAction(orderNo: string): Promise<{
  status: string;
  paidAt: string | null;
  auditStatus: string;
  auditNote: string | null;
}> {
  let order = await prisma.order.findUnique({
    where: { orderNo },
    select: {
      status: true,
      paidAt: true,
      auditStatus: true,
      auditNote: true,
    },
  });
  if (!order) {
    return { status: "NOT_FOUND", paidAt: null, auditStatus: "PENDING", auditNote: null };
  }

  if ((order.status === "PENDING" || order.status === "WAIT_VERIFY") && isJeepayConfigured()) {
    const synced = await syncOrderStatusFromJeepay(orderNo);
    if (synced) {
      const updated = await prisma.order.findUnique({
        where: { orderNo },
        select: {
          status: true,
          paidAt: true,
          auditStatus: true,
          auditNote: true,
        },
      });
      if (updated) {
        order = updated;
      }
    }
  }

  return {
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
    auditStatus: order.auditStatus,
    auditNote: order.auditNote,
  };
}

/** 管理员后台/移动端一键核销放行或驳回 */
export async function auditOrderPaymentAction(input: {
  orderNo: string;
  action: "APPROVE" | "REJECT";
  auditToken?: string;
  auditNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    const isAdmin = user?.role === "ADMIN";
    const hasValidToken = input.auditToken
      ? verifyAuditToken(input.auditToken, input.orderNo)
      : false;

    if (!isAdmin && !hasValidToken) {
      return { success: false, error: "无权执行审核操作，需要管理员权限或有效核销授权令牌" };
    }

    const order = await prisma.order.findUnique({
      where: { orderNo: input.orderNo },
      include: { plan: true },
    });
    if (!order) return { success: false, error: "未找到待核销订单" };

    if (input.action === "APPROVE") {
      const activated = await activatePaidOrder(order.id, {
        auditByUserId: user?.uid,
        auditNote: input.auditNote || "核销通过并激活订阅",
      });
      if (!activated) return { success: false, error: "订单激活失败或已处于不可激活状态" };
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PENDING",
          auditStatus: "REJECTED",
          auditNote: input.auditNote || "收款核对未通过，请检查流水或重新提交",
          auditByUserId: user?.uid,
          auditAt: new Date(),
        },
      });
    }

    safeRevalidatePath(`/pay/${input.orderNo}`);
    safeRevalidatePath("/admin/orders");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "审核操作失败",
    };
  }
}

