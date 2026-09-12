import { prisma } from "@/lib/prisma";
import InvoiceAuditTable from "./invoice-audit-table";

export const metadata = {
  title: "企业发票审核与开具 - 标讯通后台",
};

export default async function AdminInvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      user: {
        select: { name: true, username: true, email: true },
      },
      order: {
        include: { plan: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedInvoices = invoices.map((inv) => ({
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
    amount: Number(inv.amount),
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
    userName: inv.user.name || inv.user.username,
    userEmail: inv.user.email,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">企业发票审核与开具</h1>
        <p className="mt-1 text-sm text-slate-500">
          审核企业客户提交的增值税普通发票与专用发票申请，核准后将下发全国标准版式电子凭证。
        </p>
      </div>

      <InvoiceAuditTable initialInvoices={formattedInvoices} />
    </div>
  );
}
