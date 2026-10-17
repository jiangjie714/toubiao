"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RoleDrawer, { RoleDrawerData, PermissionItem, MenuItem } from "./role-drawer";
import { deleteRoleAction } from "./actions";
import {
  ShieldCheckIcon,
  UsersIcon,
  BuildingIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  FolderIcon,
  KeyIcon,
} from "@/components/icons";

interface RoleRecord extends RoleDrawerData {
  createdAt: Date;
  _count: {
    userRoles: number;
    rolePerms: number;
    roleMenus: number;
  };
}

export default function RolesView({
  initialRoles,
  permissions,
  menus,
}: {
  initialRoles: RoleRecord[];
  permissions: PermissionItem[];
  menus: MenuItem[];
}) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PLATFORM" | "TENANT">("ALL");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleDrawerData | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const filteredRoles = initialRoles.filter((r) => {
    if (activeFilter !== "ALL" && r.scope !== activeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    }
    return true;
  });

  const platformCount = initialRoles.filter((r) => r.scope === "PLATFORM").length;
  const tenantCount = initialRoles.filter((r) => r.scope === "TENANT").length;
  const systemCount = initialRoles.filter((r) => r.isSystem).length;

  const handleEditRole = (role: RoleRecord) => {
    setSelectedRole({
      id: role.id,
      code: role.code,
      name: role.name,
      scope: role.scope,
      description: role.description,
      isSystem: role.isSystem,
      rolePerms: role.rolePerms,
      roleMenus: role.roleMenus,
    });
    setDrawerOpen(true);
  };

  const handleCreateRole = () => {
    setSelectedRole(null);
    setDrawerOpen(true);
  };

  const handleDeleteRole = (role: RoleRecord) => {
    if (role.isSystem) {
      alert("系统内置角色不可删除");
      return;
    }
    if (!confirm(`确定要删除自定义角色「${role.name} (${role.code})」吗？`)) return;

    startDelete(async () => {
      const res = await deleteRoleAction(role.id!);
      if (res.success) {
        setFeedback({ text: `角色「${role.name}」已成功删除` });
        router.refresh();
      } else {
        setFeedback({ text: res.error || "删除失败", isError: true });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 大核心指标 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">平台角色总数</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <ShieldCheckIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tnum">{initialRoles.length}</div>
          <div className="mt-1 text-xs text-slate-400">含 {systemCount} 个系统内置保护角色</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">平台运营角色</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <UsersIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-indigo-600 tnum">{platformCount}</div>
          <div className="mt-1 text-xs text-slate-400">超管、财务、运营、运维</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">企业租户角色</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <BuildingIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600 tnum">{tenantCount}</div>
          <div className="mt-1 text-xs text-slate-400">企业主、总监、投标专员</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">原子权限点总数</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <KeyIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-600 tnum">{permissions.length}</div>
          <div className="mt-1 text-xs text-slate-400">含 {menus.length} 个动态菜单项</div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg p-3 text-xs flex items-center justify-between border ${
            feedback.isError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* 筛选与操作工具栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-surface p-1">
            <button
              onClick={() => setActiveFilter("ALL")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === "ALL"
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              全部角色 ({initialRoles.length})
            </button>
            <button
              onClick={() => setActiveFilter("PLATFORM")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === "PLATFORM"
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              平台运营端 ({platformCount})
            </button>
            <button
              onClick={() => setActiveFilter("TENANT")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === "TENANT"
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              企业租户端 ({tenantCount})
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索角色名称或代码..."
            className="rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-hidden"
          />
        </div>

        <button
          onClick={handleCreateRole}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          新建自定义角色
        </button>
      </div>

      {/* 角色列表表格 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">角色名称 / 编码</th>
              <th className="px-4 py-3">适用作用域</th>
              <th className="px-4 py-3">角色类型</th>
              <th className="px-4 py-3">关联用户数</th>
              <th className="px-4 py-3">授权权限点</th>
              <th className="px-4 py-3">可见菜单</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRoles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-slate-900">{role.name}</div>
                  <div className="font-mono text-[11px] text-slate-400 mt-0.5">{role.code}</div>
                  {role.description && (
                    <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      {role.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {role.scope === "PLATFORM" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-primary">
                      平台管理端
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      企业租户端
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {role.isSystem ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      系统内置 (受保护)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      自定义扩展
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-slate-800 tnum">
                    {role._count.userRoles}
                  </span>
                  <span className="text-slate-400 ml-1">人</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <KeyIcon className="h-3.5 w-3.5 text-slate-400" />
                    {role.code === "SUPER_ADMIN" ? (
                      <span className="font-bold text-primary">全部权限 (*)</span>
                    ) : (
                      <span>{role._count.rolePerms} 项</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <FolderIcon className="h-3.5 w-3.5 text-slate-400" />
                    {role._count.roleMenus} 项
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right space-x-2">
                  <button
                    onClick={() => handleEditRole(role)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-blue-50 transition-colors"
                  >
                    <PencilSquareIcon className="h-3.5 w-3.5" />
                    授权配置
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 抽屉 */}
      <RoleDrawer
        isOpen={drawerOpen}
        role={selectedRole}
        permissions={permissions}
        menus={menus}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false);
          setFeedback({ text: "角色权限配置已成功保存" });
          router.refresh();
        }}
      />
    </div>
  );
}
