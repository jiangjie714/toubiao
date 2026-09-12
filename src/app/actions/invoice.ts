"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface InvoiceItem {
  id: number;
  orderId: number;
  orderNo: string;
  planName: string;
  type: "NORMAL" | "SPECIAL";
  title: string;
  taxNumber: string;
  bankName: string | null;
  bankAccount: string | null;
  address: string | null;
  phone: string | null;
  email: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  amountWithoutTax: number;
  itemName: string;
  invoiceCode: string | null;
  invoiceNumber: string | null;
  checkCode: string | null;
  status: "PENDING" | "ISSUED" | "REJECTED";
  rejectReason: string | null;
  issuedAt: string | null;
  createdAt: string;
}

export interface InvoicableOrderItem {
  id: number;
  orderNo: string;
  planName: string;
  billingCycle: string;
  amount: number;
  paidAt: string | null;
  invoiceStatus: string;
  invoiceId?: number;
}

export interface InvoiceProfileItem {
  id: number;
  type: "NORMAL" | "SPECIAL";
  title: string;
  taxNumber: string;
  bankName: string | null;
  bankAccount: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
}

export interface InvoiceCenterDataResult {
  success: boolean;
  error?: string;
  invoices?: InvoiceItem[];
  invoicableOrders?: InvoicableOrderItem[];
  profiles?: InvoiceProfileItem[];
  stats?: {
    totalInvoicedAmount: number;
    pendingCount: number;
    issuedCount: number;
  };
}

export async function getInvoiceCenterDataAction(): Promise<InvoiceCenterDataResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const userId = session.uid;

    const [rawInvoices, rawOrders, rawProfiles] = await Promise.all([
      prisma.invoice.findMany({
        where: { userId },
        include: {
          order: {
            include: { plan: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          userId,
          status: "PAID",
        },
        include: {
          plan: true,
          invoice: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoiceProfile.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      }),
    ]);

    let totalInvoicedAmount = 0;
    let pendingCount = 0;
    let issuedCount = 0;

    const invoices: InvoiceItem[] = rawInvoices.map((inv) => {
      const amt = Number(inv.amount);
      if (inv.status === "ISSUED") {
        totalInvoicedAmount += amt;
        issuedCount += 1;
      } else if (inv.status === "PENDING") {
        pendingCount += 1;
      }

      return {
        id: inv.id,
        orderId: inv.orderId,
        orderNo: inv.order.orderNo,
        planName: inv.order.plan.name,
        type: inv.type as "NORMAL" | "SPECIAL",
        title: inv.title,
        taxNumber: inv.taxNumber,
        bankName: inv.bankName,
        bankAccount: inv.bankAccount,
        address: inv.address,
        phone: inv.phone,
        email: inv.email,
        amount: amt,
        taxRate: Number(inv.taxRate),
        taxAmount: Number(inv.taxAmount),
        amountWithoutTax: Number(inv.amountWithoutTax),
        itemName: inv.itemName,
        invoiceCode: inv.invoiceCode,
        invoiceNumber: inv.invoiceNumber,
        checkCode: inv.checkCode,
        status: inv.status as "PENDING" | "ISSUED" | "REJECTED",
        rejectReason: inv.rejectReason,
        issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
        createdAt: inv.createdAt.toISOString(),
      };
    });

    const invoicableOrders: InvoicableOrderItem[] = rawOrders.map((ord) => ({
      id: ord.id,
      orderNo: ord.orderNo,
      planName: ord.plan.name,
      billingCycle: ord.billingCycle === "monthly" ? "按月订购" : "按年订购",
      amount: Number(ord.amount),
      paidAt: ord.paidAt ? ord.paidAt.toISOString() : null,
      invoiceStatus: ord.invoiceStatus,
      invoiceId: ord.invoice?.id,
    }));

    const profiles: InvoiceProfileItem[] = rawProfiles.map((p) => ({
      id: p.id,
      type: p.type as "NORMAL" | "SPECIAL",
      title: p.title,
      taxNumber: p.taxNumber,
      bankName: p.bankName,
      bankAccount: p.bankAccount,
      address: p.address,
      phone: p.phone,
      email: p.email,
      isDefault: p.isDefault,
    }));

    return {
      success: true,
      invoices,
      invoicableOrders,
      profiles,
      stats: {
        totalInvoicedAmount: Math.round(totalInvoicedAmount * 100) / 100,
        pendingCount,
        issuedCount,
      },
    };
  } catch (error) {
    console.error("getInvoiceCenterDataAction error:", error);
    return { success: false, error: "获取发票数据失败，请稍后重试" };
  }
}

export interface ApplyInvoiceParams {
  orderId: number;
  type: "NORMAL" | "SPECIAL";
  title: string;
  taxNumber: string;
  bankName?: string;
  bankAccount?: string;
  address?: string;
  phone?: string;
  email: string;
  saveAsProfile?: boolean;
}

export async function applyInvoiceAction(
  params: ApplyInvoiceParams,
): Promise<{ success: boolean; error?: string; invoiceId?: number }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const {
      orderId,
      type,
      title,
      taxNumber,
      bankName,
      bankAccount,
      address,
      phone,
      email,
      saveAsProfile,
    } = params;

    // 基本校验
    const cleanTitle = title.trim();
    const cleanTaxNumber = taxNumber.trim().toUpperCase();
    const cleanEmail = email.trim();

    if (!cleanTitle) {
      return { success: false, error: "请输入企业发票抬头" };
    }

    if (!cleanTaxNumber || cleanTaxNumber.length < 15 || cleanTaxNumber.length > 20) {
      return { success: false, error: "请输入合规的 15-20 位统一社会信用代码或纳税人识别号" };
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, error: "请输入有效的电子发票接收邮箱" };
    }

    if (type === "SPECIAL") {
      if (!bankName?.trim() || !bankAccount?.trim()) {
        return { success: false, error: "增值税专用发票必须提供开户银行及银行账号" };
      }
      if (!address?.trim() || !phone?.trim()) {
        return { success: false, error: "增值税专用发票必须提供企业注册地址及联系电话" };
      }
    }

    // 检查订单所属及状态
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { invoice: true },
    });

    if (!order || order.userId !== session.uid) {
      return { success: false, error: "未找到该笔订单或无权操作" };
    }

    if (order.status !== "PAID") {
      return { success: false, error: "仅已支付成功的订单可申请开票" };
    }

    if (order.invoiceStatus === "ISSUED") {
      return { success: false, error: "该订单已成功开具发票，不能重复申请" };
    }

    if (order.invoiceStatus === "REQUESTED" && order.invoice?.status === "PENDING") {
      return { success: false, error: "该订单已在开票申请处理中，请勿重复提交" };
    }

    // 拆分增值税率 6%
    const totalAmount = Number(order.amount);
    const amountWithoutTax = Math.round((totalAmount / 1.06) * 100) / 100;
    const taxAmount = Math.round((totalAmount - amountWithoutTax) * 100) / 100;

    // 事务写入
    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建或更新 Invoice 记录
      const inv = await tx.invoice.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          userId: session.uid,
          type,
          title: cleanTitle,
          taxNumber: cleanTaxNumber,
          bankName: bankName?.trim() || null,
          bankAccount: bankAccount?.trim() || null,
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          email: cleanEmail,
          amount: totalAmount,
          taxRate: 0.06,
          taxAmount,
          amountWithoutTax,
          itemName: "*信息技术服务*软件信息技术服务",
          status: "PENDING",
        },
        update: {
          type,
          title: cleanTitle,
          taxNumber: cleanTaxNumber,
          bankName: bankName?.trim() || null,
          bankAccount: bankAccount?.trim() || null,
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          email: cleanEmail,
          amount: totalAmount,
          taxRate: 0.06,
          taxAmount,
          amountWithoutTax,
          status: "PENDING",
          rejectReason: null,
        },
      });

      // 2. 更新订单状态
      await tx.order.update({
        where: { id: order.id },
        data: { invoiceStatus: "REQUESTED" },
      });

      // 3. 若用户勾选保存为常用抬头
      if (saveAsProfile) {
        const existingProfile = await tx.invoiceProfile.findFirst({
          where: { userId: session.uid, taxNumber: cleanTaxNumber },
        });

        if (existingProfile) {
          await tx.invoiceProfile.update({
            where: { id: existingProfile.id },
            data: {
              type,
              title: cleanTitle,
              bankName: bankName?.trim() || null,
              bankAccount: bankAccount?.trim() || null,
              address: address?.trim() || null,
              phone: phone?.trim() || null,
              email: cleanEmail,
            },
          });
        } else {
          await tx.invoiceProfile.create({
            data: {
              userId: session.uid,
              type,
              title: cleanTitle,
              taxNumber: cleanTaxNumber,
              bankName: bankName?.trim() || null,
              bankAccount: bankAccount?.trim() || null,
              address: address?.trim() || null,
              phone: phone?.trim() || null,
              email: cleanEmail,
              isDefault: true,
            },
          });
        }
      }

      return inv;
    });

    revalidatePath("/invoices");
    return { success: true, invoiceId: result.id };
  } catch (error) {
    console.error("applyInvoiceAction error:", error);
    return { success: false, error: "提交开票申请失败，请稍后重试" };
  }
}

export async function cancelInvoiceAction(
  invoiceId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.userId !== session.uid) {
      return { success: false, error: "未找到发票记录或无权操作" };
    }

    if (invoice.status !== "PENDING") {
      return { success: false, error: "仅待开具状态的申请支持撤回" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id: invoiceId } });
      await tx.order.update({
        where: { id: invoice.orderId },
        data: { invoiceStatus: "NONE" },
      });
    });

    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("cancelInvoiceAction error:", error);
    return { success: false, error: "撤回开票申请失败" };
  }
}

export async function saveInvoiceProfileAction(params: {
  id?: number;
  type: "NORMAL" | "SPECIAL";
  title: string;
  taxNumber: string;
  bankName?: string;
  bankAccount?: string;
  address?: string;
  phone?: string;
  email?: string;
  isDefault?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const { id, type, title, taxNumber, bankName, bankAccount, address, phone, email, isDefault } =
      params;

    const cleanTitle = title.trim();
    const cleanTaxNumber = taxNumber.trim().toUpperCase();

    if (!cleanTitle || !cleanTaxNumber) {
      return { success: false, error: "抬头名称和税号不能为空" };
    }

    await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.invoiceProfile.updateMany({
          where: { userId: session.uid },
          data: { isDefault: false },
        });
      }

      if (id) {
        await tx.invoiceProfile.update({
          where: { id },
          data: {
            type,
            title: cleanTitle,
            taxNumber: cleanTaxNumber,
            bankName: bankName?.trim() || null,
            bankAccount: bankAccount?.trim() || null,
            address: address?.trim() || null,
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            isDefault: isDefault ?? false,
          },
        });
      } else {
        await tx.invoiceProfile.create({
          data: {
            userId: session.uid,
            type,
            title: cleanTitle,
            taxNumber: cleanTaxNumber,
            bankName: bankName?.trim() || null,
            bankAccount: bankAccount?.trim() || null,
            address: address?.trim() || null,
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            isDefault: isDefault ?? true,
          },
        });
      }
    });

    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("saveInvoiceProfileAction error:", error);
    return { success: false, error: "保存发票抬头失败" };
  }
}
