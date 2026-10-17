import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getProposalProjectsAction } from "@/app/actions/proposal-assembler";
import ProposalAssemblerView from "@/components/proposal-assembler-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "投标文件智能生成与模块化装配工场 - 标讯通",
  description: "全流程打通企业法人资质、历史业绩与技术条款，六大卷宗标准化自动化装配，支持公文排版与一键清标质检",
};

export default async function ProposalsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/proposals");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="投标文件智能生成与模块化装配工场"
        description="打通企业法人资质、历史业绩与技术条款，六大卷宗标准化自动化智能装配，支持公文排版与一键清标质检。"
        badge="企业版标书装配设施"
        features={[
          "贯通企业资质证照库、合同业绩库与技术方案模块",
          "投标声明、商务卷、技术卷、报价卷、履约承诺六卷模块化装配",
          "一键联动清标查重质检系统，防范一票废标隐患",
          "支持企业银行对公转账结算与开具 6% 增值税专用发票",
        ]}
      />
    );
  }

  const res = await getProposalProjectsAction();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ProposalAssemblerView
        initialProjects={res.projects || []}
        userFollows={res.userFollows || []}
        userName={user.name || user.username || "投标人"}
      />
    </div>
  );
}
