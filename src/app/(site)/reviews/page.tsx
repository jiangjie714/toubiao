import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getReviewAnalyticsAction } from "@/app/actions/review";
import ReviewAnalyticsView from "@/components/review-analytics-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "企业投标复盘与失标归因诊断罗盘 - 标讯通",
  description: "企业级投标项目开标复盘大盘、六维胜败归因漏斗、价格偏离度精算与经验教训总结报告生成",
};

export default async function ReviewsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/reviews");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="企业投标复盘与失标归因诊断罗盘"
        description="系统性提升中标率的核心法宝：六维失标归因诊断（价格偏离/技术方案/资质业绩/商务客情/合规废标）、中标单位底价偏差精算与经验教训资产沉淀。"
        badge="企业版中标率提升设施"
        features={[
          "开标后中标结果自动对标与我方报价偏离度精算",
          "六维失标根本原因结构化归因分析与团队短板雷达",
          "形成企业投标复盘经验教训库，避免下一次犯同样的错误",
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

  const initialData = await getReviewAnalyticsAction({
    mode: hasTeam ? "team" : "personal",
  });

  return (
    <div className="">
      <ReviewAnalyticsView initialData={initialData} hasTeam={hasTeam} />
    </div>
  );
}
