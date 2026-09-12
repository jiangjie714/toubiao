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
  if (!["wechat", "alipay"].includes(channel)) redirect("/pricing?error=channel");

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
    pending && isPrepayUsable(pending)
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
  if (!isPrepayUsable(order)) prepayError = await preparePrepay(order);

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
