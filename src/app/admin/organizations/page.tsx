import { getOrganizationsOverviewAction } from "./actions";
import OrgsView from "./orgs-view";

export const metadata = {
  title: "企业组织与席位中心 - 管理后台",
};

export default async function OrganizationsPage() {
  const data = await getOrganizationsOverviewAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          企业组织与多席位管控中枢
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          统筹管理企业客户多席位组织架构、席位利用率、在职成员明细，并支持按需动态扩容席位配额
        </p>
      </div>

      <OrgsView initialData={data} />
    </div>
  );
}
