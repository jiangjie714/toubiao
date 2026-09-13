import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getUserAdminOverview } from "@/lib/user-admin-service";
import UserCreateForm from "./user-create-form";
import UsersTableView from "@/components/admin/users-table-view";
import {
  UsersIcon,
  BuildingIcon,
  TrophyIcon,
  BriefcaseIcon,
  SearchIcon,
} from "@/components/icons";

export const metadata = { title: "企业客户与用户全景画像 - 管理后台" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const { q = "", filter: filterParam = "ALL", page: pageRaw = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);

  const validFilters = ["ALL", "COMPANY", "PAID", "TEAM", "ADMIN"] as const;
  type FilterType = (typeof validFilters)[number];
  const filter: FilterType = validFilters.includes(filterParam as FilterType)
    ? (filterParam as FilterType)
    : "ALL";

  const [overviewData, me] = await Promise.all([
    getUserAdminOverview({
      search: q,
      filter,
      page,
      pageSize: 15,
    }),
    getSession(),
  ]);

  const { metrics, plans, pagination, users } = overviewData;

  const filterTabs = [
    { key: "ALL", label: "全部客户/用户" },
    { key: "COMPANY", label: "企业实名客户" },
    { key: "PAID", label: "付费商业会员" },
    { key: "TEAM", label: "多席位团队" },
    { key: "ADMIN", label: "系统管理员" },
  ];

  return (
    <div className="space-y-6">
      {/* 顶部标题与简述 */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            企业客户全景画像与席位中心
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            聚合企业认证档案、商业套餐权益、团队多席位架构与线索跟进，构建企业客户 CRM 视图
          </p>
        </div>
      </div>

      {/* 4 大核心指标看板 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">平台注册用户</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <UsersIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tnum">
            {metrics.totalUsers.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">含个人用户与企业成员</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">企业认证客户 (CRM)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <BuildingIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600 tnum">
            {metrics.companyUsers.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">已完善企业资质档案</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">活跃付费会员</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <TrophyIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-600 tnum">
            {metrics.activeSubscribers.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">持有效商业会员订阅</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">多席位团队组织</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BriefcaseIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-indigo-600 tnum">
            {metrics.totalTeams.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">企业协同办公组织</div>
        </div>
      </div>

      {/* 新建客户与账号表单 */}
      <UserCreateForm plans={plans} />

      {/* 多维检索与分类筛选工具栏 */}
      <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* 筛选 Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const isActive = filter === tab.key;
              const href = `/admin/users?filter=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* 搜索框 */}
          <form method="get" action="/admin/users" className="relative min-w-[240px]">
            <input type="hidden" name="filter" value={filter} />
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              name="q"
              defaultValue={q}
              placeholder="搜索企业名、用户名、姓名或邮箱…"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 outline-none transition-colors duration-200 focus:border-accent focus:ring-2 focus:ring-blue-100"
            />
          </form>
        </div>
      </div>

      {/* 客户全景表格及画像模态窗 */}
      <UsersTableView users={users} plans={plans} meUid={me?.uid} />

      {/* 分页导航 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
          <div>
            共 <span className="font-semibold text-slate-800 tnum">{pagination.totalCount}</span>{" "}
            条记录，当前第{" "}
            <span className="font-semibold text-slate-800 tnum">{pagination.page}</span> /{" "}
            <span className="font-semibold text-slate-800 tnum">{pagination.totalPages}</span> 页
          </div>
          <div className="flex items-center gap-2">
            {pagination.page > 1 ? (
              <Link
                href={`/admin/users?page=${pagination.page - 1}${
                  q ? `&q=${encodeURIComponent(q)}` : ""
                }&filter=${filter}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 text-slate-700"
              >
                上一页
              </Link>
            ) : (
              <span className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-slate-300">
                上一页
              </span>
            )}
            {pagination.page < pagination.totalPages ? (
              <Link
                href={`/admin/users?page=${pagination.page + 1}${
                  q ? `&q=${encodeURIComponent(q)}` : ""
                }&filter=${filter}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 text-slate-700"
              >
                下一页
              </Link>
            ) : (
              <span className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-slate-300">
                下一页
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
