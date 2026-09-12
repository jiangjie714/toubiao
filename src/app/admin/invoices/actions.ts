"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("需要管理员权限");
  }
}

// 生成模拟符合国家税务总局规则的发票代码与号码
function generateNationalInvoiceCodes() {
  const year = new Date().getFullYear().toString().slice(-2);
  const invoiceCode = `03100${year}00111`;
  const randomNum = Math.floor(10000000 + Math.random() * 90000000).toString();
  const checkCode = Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join("");
  return { invoiceCode, invoiceNumber: randomNum, checkCode };
}

export async function adminIssueInvoiceAction(params: {
  invoiceId: number;
  invoiceCode?: string;
  invoiceNumber?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
    });

    if (!invoice) {
      return { success: false, error: "未找到发票记录" };
    }

    const defaultCodes = generateNationalInvoiceCodes();
    const finalCode = params.invoiceCode?.trim() || defaultCodes.invoiceCode;
    const finalNumber = params.invoiceNumber?.trim() || defaultCodes.invoiceNumber;
    const finalCheckCode = defaultCodes.checkCode;

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "ISSUED",
          invoiceCode: finalCode,
          invoiceNumber: finalNumber,
          checkCode: finalCheckCode,
          issuedAt: new Date(),
          rejectReason: null,
        },
      });

      await tx.order.update({
        where: { id: invoice.orderId },
        data: { invoiceStatus: "ISSUED" },
      });
    });

    revalidatePath("/admin/invoices");
    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("adminIssueInvoiceAction error:", error);
    return { success: false, error: "开具发票失败" };
  }
}

export async function adminRejectInvoiceAction(params: {
  invoiceId: number;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const cleanReason = params.reason.trim();
    if (!cleanReason) {
      return { success: false, error: "请输入驳回原因说明" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
    });

    if (!invoice) {
      return { success: false, error: "未找到发票记录" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "REJECTED",
          rejectReason: cleanReason,
        },
      });

      await tx.order.update({
        where: { id: invoice.orderId },
        data: { invoiceStatus: "REJECTED" },
      });
    });

    revalidatePath("/admin/invoices");
    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("adminRejectInvoiceAction error:", error);
    return { success: false, error: "驳回申请失败" };
  }
}
