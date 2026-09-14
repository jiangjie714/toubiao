import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuditHistoryAction } from "@/app/actions/audit";
import BidAuditView from "@/components/bid-audit-view";

export const metadata = {
  title: "投标文件智能清标查重与合规深度质检罗盘 - 标讯通",
  description: "全真模拟专家清标：穿透排查模板占位符残留、错写非本项目业主、商务报价大小写不符、星号负偏离与串标特征，生成公文级质检合格单",
};

export default async function AuditPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/audit");
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { userId: user.uid },
    select: { teamId: true },
  });
  const ownedTeam = await prisma.team.findUnique({
    where: { ownerId: user.uid },
    select: { id: true },
  });
  const hasTeam = Boolean(teamMember?.teamId || ownedTeam);

  const res = await getAuditHistoryAction({
    mode: hasTeam ? "team" : "personal",
  });

  // 获取跟进标讯供快捷关联选择
  const follows = await prisma.tenderFollow.findMany({
    where: hasTeam && (teamMember?.teamId || ownedTeam?.id)
      ? { teamId: teamMember?.teamId || ownedTeam?.id }
      : { userId: user.uid },
    include: {
      tender: {
        select: {
          id: true,
          title: true,
          purchaser: true,
          budgetAmount: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const followsList = follows.map((f) => ({
    id: f.id,
    title: f.tender.title,
    purchaser: f.tender.purchaser,
    budgetAmount: f.tender.budgetAmount ? Number(f.tender.budgetAmount) : null,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <BidAuditView
        initialHistory={res.records || []}
        initialSummary={res.summary}
        hasTeam={hasTeam}
        followsList={followsList}
      />
    </div>
  );
}
