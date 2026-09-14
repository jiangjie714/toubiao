import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDepositLedgerAction } from "@/app/actions/deposit";
import DepositManagerView from "@/components/deposit-manager-view";

export const metadata = {
  title: "投标保证金与在途资金占用罗盘 - 标讯通",
  description:
    "企业级投标保证金全生命周期台账、法定 5 个工作日退还时效跟踪、超期滞留风险预警与法定催款公函一键生成",
};

export default async function DepositsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/deposits");
  }

  const result = await getDepositLedgerAction();
  if (!result.success || !result.summary || !result.items) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {result.error || "加载保证金台账失败，请刷新重试"}
        </div>
      </div>
    );
  }

  return (
    <DepositManagerView
      initialSummary={result.summary}
      initialItems={result.items}
      companyName={result.companyName || user.name || "我司"}
    />
  );
}
