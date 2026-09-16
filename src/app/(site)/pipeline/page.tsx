import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPipelineCrmDataAction } from "@/app/actions/pipeline-crm";
import PipelineCrmView from "@/components/pipeline-crm-view";

export const metadata = {
  title: "企业销售 CRM 与商机全生命周期漏斗 - 标讯通",
  description: "企业团队级销售漏斗、加权预测营收、销售业绩战绩榜、阶段流转损耗与商机公海池认领流转",
};

export default async function PipelineCrmPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/pipeline");
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
