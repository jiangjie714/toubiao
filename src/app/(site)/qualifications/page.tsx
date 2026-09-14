import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSmartMatchedOpportunitiesAction } from "@/app/actions/opportunity-radar";
import QualificationsView from "@/components/qualifications-view";

export const metadata = {
  title: "企业资质库与商机匹配雷达 - 标讯通",
  description: "企业资质认证与标杆业绩资产管理，全网招投标商机契合度智能精算与高赢面推荐雷达",
};

export default async function QualificationsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/qualifications");
  }

  const radarRes = await getSmartMatchedOpportunitiesAction();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <QualificationsView
        initialData={radarRes.data}
        userName={user.name || user.username}
      />
    </div>
  );
}
