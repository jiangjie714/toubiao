"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createPrepay, isPrepayUsable, type PaymentChannel } from "@/lib/payment-prepay";

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

async function preparePrepay(
  order: { id: number; orderNo: string; channel: string; amount: Prisma.Decimal; planId: number; billingCycle: string },
): Promise<string | null> {
  const plan = await prisma.plan.findUnique({ where: { id: order.planId } });
  try {
    const prepay = await createPrepay(
      order.channel as PaymentChannel,
      { orderNo: order.orderNo, amount: order.amount },
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
  if (!["wechat", "alipay", "bank"].includes(channel)) redirect("/pricing?error=channel");

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

  const order =
    pending && (channel === "bank" || isPrepayUsable(pending))
      ? pending
      : pending ?? (await prisma.order.create({
          data: {
            orderNo: makeOrderNo(),
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
        }));

  let prepayError: string | null = null;
  if (channel !== "bank" && !isPrepayUsable(order)) {
    prepayError = await preparePrepay(order);
  }

  revalidatePath("/pricing");
  revalidatePath("/admin/orders");
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
  revalidatePath(`/pay/${order.orderNo}`);
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
    });

    if (!order) return { success: false, error: "未找到对应订单" };
    if (order.status !== "PENDING") {
      return { success: false, error: "当前订单状态不可提交凭证" };
    }

    const proofNote = `【对公汇款凭证】汇款户名: ${payerName} | 汇款银行: ${bankName || "未填"} | 银行流水号: ${transactionRef}${note ? ` | 备注: ${note}` : ""}`;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        note: proofNote,
      },
    });

    revalidatePath(`/pay/${orderNo}`);
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "提交打款凭证失败",
    };
  }
}
