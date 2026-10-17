import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement, isEnterpriseUser } from "@/lib/quota";
import { getPipelineCrmDataAction } from "@/app/actions/pipeline-crm";
import PipelineCrmView from "@/components/pipeline-crm-view";
import EnterprisePaywall from "@/components/enterprise-paywall";

export const metadata = {
  title: "企业销售 CRM 与商机全生命周期漏斗 - 标讯通",
  description: "企业团队级销售漏斗、加权预测营收、销售业绩战绩榜、阶段流转损耗与商机公海池认领流转",
};

export default async function PipelineCrmPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/pipeline");
  }

  const entitlement = await getEntitlement(user.uid);
  if (user.role !== "ADMIN" && !isEnterpriseUser(entitlement)) {
    return (
      <EnterprisePaywall
        title="企业销售 CRM 与商机全生命周期漏斗"
        description="专为招投标销售团队打造的商机漏斗罗盘：团队公海池商机认领、防止多名销售撞单撞客户、全流程阶段转化流转与回款预测大盘。"
        badge="企业版专属协同设施"
        features={[
          "标讯商机团队公海池统一管理，杜绝销售私单与内部撞客",
          "立项评估→标书编制→封标递交→中标开标 6 大阶段流转",
          "销售漏斗转化率、损耗原因诊断与季度加权营收预测",
          "销售团队战绩榜单与投标跟进动态审计日志",
          "支持企业银行对公转账结算与开具 6% 增值税专用发票",
        ]}
      />
    );
  }

  const res = await getPipelineCrmDataAction();
  if (!res.success || !res.data) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        加载销售 CRM 漏斗数据失败，请稍后刷新重试。
      </div>
    );
  }

  return <PipelineCrmView initialData={res.data} />;
}
