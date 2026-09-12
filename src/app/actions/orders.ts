"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function makeOrderNo(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `TB${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createBankOrderAction(formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user) redirect("/login?next=/pricing");

  const planCode = String(formData.get("planCode") ?? "");
  const billingCycle = String(formData.get("billingCycle") ?? "monthly");
  if (!["monthly", "yearly"].includes(billingCycle)) redirect("/pricing?error=cycle");

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active || plan.code === "FREE") redirect("/pricing?error=plan");

  const amount = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  if (amount === null || amount === undefined) redirect("/pricing?error=price");

  const pending = await prisma.order.findFirst({
    where: {
      userId: user.uid,
      planId: plan.id,
      billingCycle,
      status: "PENDING",
    },
    select: { id: true },
  });

  const order = pending
    ? { id: pending.id }
    : await prisma.order.create({
        data: {
          orderNo: makeOrderNo(),
          userId: user.uid,
          planId: plan.id,
          billingCycle,
          amount,
          channel: "bank",
          status: "PENDING",
          note: process.env.BANK_TRANSFER_INFO ?? "对公转账，请联系商务确认到账",
        },
        select: { id: true },
      });

  revalidatePath("/pricing");
  revalidatePath("/admin/orders");
  redirect(`/pricing?submitted=${order.id}`);
}
