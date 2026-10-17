import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getWebhookCenterDataAction } from "@/app/actions/webhook-center";
import WebhookCenterView from "@/components/webhook-center-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "多渠道即时预警与 Webhook 路由中枢 - 标讯通",
  description: "企业微信、钉钉（加签校验）、飞书群机器人及通用 Webhook 统一接入，五大高危业务事件秒级触达作战群聊",
};

export default async function WebhooksPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/webhooks");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="企微 / 钉钉 / 飞书群机器人预警中枢"
        description="开通企业版可将新标讯、截标倒计时、竞对中标、保证金催退等重大业务事件，通过群机器人第一秒推送到企业日常办公作战群。"
        badge="企业版专属推送设施"
        features={[
          "支持企业微信、钉钉（加签加密）、飞书及通用 Webhook 群机器人",
          "5 大高危业务事件独立开关与多群多路由策略",
          "团队全员无需主动盯盘，关键商机与风险秒级触达作战群",
          "支持企业银行对公转账结算，提供规范《技术服务采购合同》",
          "开具“*信息技术服务*软件信息技术服务”6% 增值税专用发票抵扣税额",
        ]}
      />
    );
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
