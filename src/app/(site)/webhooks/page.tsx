import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWebhookCenterDataAction } from "@/app/actions/webhook-center";
import WebhookCenterView from "@/components/webhook-center-view";

export const metadata = {
  title: "多渠道即时预警与 Webhook 路由中枢 - 标讯通",
  description: "企业微信、钉钉（加签校验）、飞书群机器人及通用 Webhook 统一接入，五大高危业务事件秒级触达作战群聊",
};

export default async function WebhooksPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/webhooks");
  }

  const res = await getWebhookCenterDataAction();
  if (!res.success || !res.data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800">
        <h2 className="text-base font-bold">获取预警推送中枢数据失败</h2>
        <p className="mt-1 text-xs">{res.error || "网络异常，请稍后刷新重试"}</p>
      </div>
    );
  }

  return (
    <WebhookCenterView
      initialData={res.data}
      userName={user.name || user.username}
    />
  );
}
