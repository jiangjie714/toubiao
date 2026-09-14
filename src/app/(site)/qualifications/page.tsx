import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSmartMatchedOpportunitiesAction } from "@/app/actions/opportunity-radar";
import { getQualificationsAction } from "@/app/actions/qualification";
import QualificationsView from "@/components/qualifications-view";

export const metadata = {
  title: "企业资质库与商机匹配雷达 - 标讯通",
  description: "企业资质证书全生命周期台账、有效期临期废标预警与全网招投标商机高赢面推荐雷达",
};

export default async function QualificationsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/qualifications");
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
