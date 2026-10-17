import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getCompetitorRadarOverviewAction } from "@/app/actions/competitor-radar";
import CompetitorRadarView from "@/components/competitor-radar-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "企业招投标核心竞对动向监控与攻防穿透雷达 - 标讯通",
  description: "全天候监控竞争对手中标态势、后院起火客户渗透红色预警、低价突袭与同场遭遇战攻防对标沙箱",
};

export default async function CompetitorsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/competitors");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="招投标核心竞对动向监控与攻防穿透雷达"
        description="锁定 3~20 家行业核心宿敌：全天候监控竞对中标态势、后院起火客户渗透红色预警、低价突袭与同场遭遇战攻防对标沙箱。"
        badge="企业版专属情报雷达"
        features={[
          "核心宿敌企业全网招投标动态全自动实时追踪",
          "竞对渗透我方深耕客户与核心战区实时高危警报",
          "同场遭遇战历史胜负率分析与价格策略复盘",
          "支持企业银行对公转账结算与开具 6% 增值税专用发票",
        ]}
      />
    );
  }

  const res = await getCompetitorRadarOverviewAction();
  if (!res.success || !res.data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800">
        <h2 className="text-base font-bold">获取竞对雷达数据失败</h2>
        <p className="mt-1 text-xs">{res.error || "网络异常，请稍后刷新重试"}</p>
      </div>
    );
  }

  return (
    <CompetitorRadarView
      initialOverview={res.data}
      userName={user.name || user.username}
    />
  );
}
