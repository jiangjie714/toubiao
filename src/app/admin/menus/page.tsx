import { getMenusDataAction } from "./actions";
import MenusView from "./menus-view";

export const metadata = {
  title: "动态菜单管理配置中心 - 管理后台",
};

export default async function MenusPage() {
  const data = await getMenusDataAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          动态导航菜单配置中枢
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          灵活配置管理后台与前台工作台的导航路由、图标映射、排序权重与权限门禁拦截点
        </p>
      </div>

      <MenusView
        initialMenus={data.menus}
        permissions={data.permissions}
      />
    </div>
  );
}
