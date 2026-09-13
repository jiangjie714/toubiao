import { getAlertsOverview } from "@/lib/crawler/alerts-manager";
import AlertsManagerView from "@/components/admin/alerts-manager-view";

export const metadata = {
  title: "数据源健康度告警与机器人配置 - 管理后台",
  description: "企业微信/钉钉/飞书机器人实时通知网络，采集故障与数据异常毫秒级告警分发",
};

export const dynamic = "force-dynamic";

export default async function AdminSourceAlertsPage() {
  const data = await getAlertsOverview();

  return <AlertsManagerView data={data} />;
}
