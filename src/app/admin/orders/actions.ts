"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { activatePaidOrder } from "@/lib/commerce";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("需要管理员权限");
}

export async function confirmOrderPaidAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await activatePaidOrder(id);
  revalidatePath("/admin/orders");
  revalidatePath("/pricing");
  revalidatePath("/list");
}

export async function cancelOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.order.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "CANCELED" },
  });
  revalidatePath("/admin/orders");
}
