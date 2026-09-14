import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getInvoiceCenterDataAction } from "@/app/actions/invoice";
import InvoiceCenterView from "@/components/invoice-center-view";

export const metadata = {
  title: "企业财务与发票中心 - 标讯通",
  description: "增值税普通发票与专用发票申请、企业抬头模板、电子发票全国标准版式凭证在线打印与报销",
};

export default async function InvoicesPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/invoices");
  }

  const initialData = await getInvoiceCenterDataAction();

  return (
    <div className="">
      <InvoiceCenterView
        initialData={initialData}
        userName={user.name || user.username}
      />
    </div>
  );
}
