import { getRoleOverviewDataAction } from "./actions";
import RolesView from "./roles-view";

export const metadata = {
  title: "角色管理与权限分配中心 - 管理后台",
};

export default async function RolesPage() {
  const data = await getRoleOverviewDataAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          角色管理与权限分配中枢
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          统筹平台运营管理角色与企业租户业务角色，按需分配动态菜单入口与原子操作权限点
        </p>
      </div>

      <RolesView
        initialRoles={data.roles}
        permissions={data.permissions}
        menus={data.menus}
      />
    </div>
  );
}
