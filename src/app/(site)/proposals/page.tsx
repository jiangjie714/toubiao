import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProposalProjectsAction } from "@/app/actions/proposal-assembler";
import ProposalAssemblerView from "@/components/proposal-assembler-view";

export const metadata = {
  title: "投标文件智能生成与模块化装配工场 - 标讯通",
  description: "全流程打通企业法人资质、历史业绩与技术条款，六大卷宗标准化自动化装配，支持公文排版与一键清标质检",
};

export default async function ProposalsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/proposals");
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
