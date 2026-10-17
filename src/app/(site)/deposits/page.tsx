import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getDepositLedgerAction } from "@/app/actions/deposit";
import DepositManagerView from "@/components/deposit-manager-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

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

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="投标保证金全生命周期台账与催退罗盘"
        description="解决企业数十万投标在途沉淀资金的监管痛点：法定 5 个工作日退还时效监控、超期滞留高危预警与标准退款公函一键生成。"
        badge="企业版资金风控设施"
        features={[
          "全网标段投标保证金打款、在途、退回全生命周期台账管理",
          "开标后法定 5 个工作日自动退款倒计时跟踪",
          "超期滞留资金红色高危预警与一键生成法务催还公函",
          "支持财务转账凭证与电子保函归档对账",
          "支持企业银行对公转账结算与开具 6% 增值税专用发票",
        ]}
      />
    );
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
