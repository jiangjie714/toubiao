import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getCompanyCasesAction } from "@/app/actions/case";
import CaseLibraryView from "@/components/case-library-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "企业投标业绩与合同案例资产库 - 标讯通",
  description:
    "企业级类似项目业绩资产数字化管理、近 3 年时效合规判定、金额规模阶梯检索与标讯一键加分匹配",
};

export default async function CasesPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/cases");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="企业投标业绩与合同案例资产库"
        description="企业核心商务资产数字化：类似项目业绩归档、近 3 年时效合规判定、金额规模阶梯检索与标讯一键加分匹配。"
        badge="企业版商务资产设施"
        features={[
          "企业中标合同业绩全流程录入归档，支持合同关键页与验收证明附件",
          "基于采购人行业与金额阶梯，秒级智能匹配高分业绩素材",
          "防止销售人员离职导致企业历史重大投标业绩流失",
          "支持企业银行对公转账结算与开具 6% 增值税专用发票",
        ]}
      />
    );
  }

  const result = await getCompanyCasesAction();
  if (!result.success || !result.cases) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {result.error || "加载企业业绩资产库失败，请刷新重试"}
        </div>
      </div>
    );
  }

  return (
    <CaseLibraryView
      initialCases={result.cases}
      companyName={result.companyName || user.name || "我司"}
      totalAmountWan={result.totalAmountWan || 0}
    />
  );
}
