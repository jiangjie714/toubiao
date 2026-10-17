"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { activatePaidOrder } from "@/lib/commerce";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("需要管理员权限");
  return user;
}

export async function confirmOrderPaidAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await activatePaidOrder(id, { auditByUserId: user.uid });
  revalidatePath("/admin/orders");
  revalidatePath("/pricing");
  revalidatePath("/list");
}

export async function rejectOrderAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = Number(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim() || "未核对到对应入账流水，请核对凭证重新提交";
  if (!id) return;
  await prisma.order.updateMany({
    where: { id, status: { in: ["PENDING", "WAIT_VERIFY"] } },
    data: {
      status: "PENDING",
      auditStatus: "REJECTED",
      auditNote: reason,
      auditByUserId: user.uid,
      auditAt: new Date(),
    },
  });
  revalidatePath("/admin/orders");
}

export async function cancelOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.order.updateMany({
    where: { id, status: { in: ["PENDING", "WAIT_VERIFY"] } },
    data: { status: "CANCELED" },
  });
  revalidatePath("/admin/orders");
}

export async function batchReconcileStatementsAction(rawStatementsText: string) {
  await requireAdmin();
  const { batchReconcileBankStatements } = await import("@/lib/bank-transfer-listener");
  const results = await batchReconcileBankStatements(rawStatementsText);
  revalidatePath("/admin/orders");
  revalidatePath("/pricing");
  return { success: true, results };
}

