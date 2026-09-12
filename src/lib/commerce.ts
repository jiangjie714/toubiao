import { prisma } from "./prisma";

export async function activatePaidOrder(
  orderId: number,
  options: { transactionNo?: string; paidAt?: Date } = {},
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { plan: true },
    });
    if (!order || order.status !== "PENDING") return false;

    const now = new Date();
    const current = await tx.subscription.findUnique({ where: { userId: order.userId } });
    const base =
      current?.status === "ACTIVE" && current.endsAt && current.endsAt > now ? current.endsAt : now;
    const endsAt = new Date(base);
    if (order.billingCycle === "monthly") endsAt.setMonth(endsAt.getMonth() + 1);
    else endsAt.setFullYear(endsAt.getFullYear() + 1);

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: options.paidAt ?? now,
        ...(options.transactionNo ? { transactionNo: options.transactionNo } : {}),
      },
    });

    await tx.subscription.upsert({
      where: { userId: order.userId },
      update: {
        planId: order.planId,
        status: "ACTIVE",
        billingCycle: order.billingCycle,
        startsAt: current?.startsAt ?? now,
        endsAt,
        autoRenew: false,
      },
      create: {
        userId: order.userId,
        planId: order.planId,
        status: "ACTIVE",
        billingCycle: order.billingCycle,
        startsAt: now,
        endsAt,
        autoRenew: false,
      },
    });
    return true;
  });
}
