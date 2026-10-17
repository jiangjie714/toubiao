import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getAuditHistoryAction } from "@/app/actions/audit";
import BidAuditView from "@/components/bid-audit-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "投标文件智能清标查重与合规深度质检罗盘 - 标讯通",
  description: "全真模拟专家清标：穿透排查模板占位符残留、错写非本项目业主、商务报价大小写不符、星号负偏离与串标特征，生成公文级质检合格单",
};

export default async function AuditPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/audit");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="投标文件智能清标查重与合规深度质检"
        description="全真模拟专家清标：穿透排查模板占位符残留、错写非本项目业主、商务报价大小写不符、关键星号负偏离与串标特征，出具公文级质检合格单与废标风险预警报告。"
        badge="企业版专属风控设施"
        features={[
          "全自动排查一票否决项、星号关键技术负偏离与资格证书缺陷",
          "审查报价大小写一致性、非本项目业主占位符残留与串标特征",
          "每月专属清标配额（标准版 5 次/月，专业版 30 次/月，支持大标书扫描）",
          "出具公文级质检合格单与盖章前自查风险整改备忘",
          "支持企业银行对公转账结算与开具 6% 增值税专用发票",
        ]}
      />
    );
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
    <div className="">
      <BidAuditView
        initialHistory={res.records || []}
        initialSummary={res.summary}
        hasTeam={hasTeam}
        followsList={followsList}
      />
    </div>
  );
}
