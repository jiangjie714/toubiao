import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompanyCasesAction } from "@/app/actions/case";
import CaseLibraryView from "@/components/case-library-view";

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
