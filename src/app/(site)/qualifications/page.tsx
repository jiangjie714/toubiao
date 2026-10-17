import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getSmartMatchedOpportunitiesAction } from "@/app/actions/opportunity-radar";
import { getQualificationsAction } from "@/app/actions/qualification";
import QualificationsView from "@/components/qualifications-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "企业资质库与商机匹配雷达 - 标讯通",
  description: "企业资质证书全生命周期台账、有效期临期废标预警与全网招投标商机高赢面推荐雷达",
};

export default async function QualificationsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/qualifications");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="企业资质资产库与商机匹配雷达"
        description="解决企业因资质证书临期导致废标的重大合规隐患：资质证书到期 90/30 天高危红色预警、年审监督提醒，并基于企业资质硬实力自动智能匹配全网高赢面招标公告。"
        badge="企业版资质风控设施"
        features={[
          "企业资质证照与特许经营许可证全生命周期到期预警（防废标）",
          "基于企业真实持有资质，全网毫秒级智能推荐高赢面商机雷达",
          "投标标书编制时一键调取资质证书编号与电子扫描件",
          "支持企业银行对公转账结算与开具 6% 增值税专用发票",
        ]}
      />
    );
  }

  const [radarRes, qualRes] = await Promise.all([
    getSmartMatchedOpportunitiesAction(),
    getQualificationsAction(),
  ]);

  return (
    <div className="">
      <QualificationsView
        initialData={radarRes.data}
        userName={user.name || user.username}
        initialQualifications={qualRes.qualifications || []}
        initialSummary={qualRes.summary}
      />
    </div>
  );
}
