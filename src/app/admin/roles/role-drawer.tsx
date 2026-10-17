"use client";

import { useState, useTransition, useId } from "react";
import { saveRoleAction, SaveRoleInput } from "./actions";
import {
  XMarkIcon,
  ShieldCheckIcon,
  FolderIcon,
  SparklesIcon,
  CheckCircleIcon,
} from "@/components/icons";

export interface RoleDrawerData {
  id?: number;
  code: string;
  name: string;
  scope: string;
  description: string | null;
  isSystem: boolean;
  rolePerms: { permissionId: number }[];
  roleMenus: { menuId: number }[];
}

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  category: string;
  type: string;
  description?: string | null;
}

export interface MenuItem {
  id: number;
  title: string;
  path: string;
  target: string;
  badge?: string | null;
  permission?: string | null;
}

const CATEGORY_NAMES: Record<string, string> = {
  TENDER: "标讯与项目",
  FINANCE: "财务与交易",
  OPS: "业务运营",
  DATA: "爬虫与数据",
  SYSTEM: "系统与安全",
  CRM: "企业与客户",
  AI: "AI智能算力",
};

export default function RoleDrawer({
  isOpen,
  role,
  permissions,
  menus,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  role: RoleDrawerData | null;
  permissions: PermissionItem[];
  menus: MenuItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(role?.id);
  const isSystem = Boolean(role?.isSystem);

  const [code, setCode] = useState(role?.code ?? "");
  const [name, setName] = useState(role?.name ?? "");
  const [scope, setScope] = useState<"PLATFORM" | "TENANT">(
    (role?.scope as "PLATFORM" | "TENANT") ?? "PLATFORM",
  );
  const [description, setDescription] = useState(role?.description ?? "");

  const [selectedPermIds, setSelectedPermIds] = useState<Set<number>>(
    new Set(role?.rolePerms.map((rp) => rp.permissionId) ?? []),
  );
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<number>>(
    new Set(role?.roleMenus.map((rm) => rm.menuId) ?? []),
  );

  const [activeTab, setActiveTab] = useState<"PERMISSIONS" | "MENUS">("PERMISSIONS");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const codeInputId = useId();
  const nameInputId = useId();
  const scopeSelectId = useId();
  const descInputId = useId();

  if (!isOpen) return null;

  // 按分类对权限点归类
  const groupedPerms = permissions.reduce(
    (acc, p) => {
      const cat = p.category || "OTHER";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    },
    {} as Record<string, PermissionItem[]>,
  );

  // 区分前后台菜单
  const adminMenus = menus.filter((m) => m.target === "ADMIN");
  const siteMenus = menus.filter((m) => m.target === "SITE");

  const togglePerm = (id: number) => {
    const next = new Set(selectedPermIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPermIds(next);
  };

  const toggleAllPermsInCat = (catPerms: PermissionItem[]) => {
    const allChecked = catPerms.every((p) => selectedPermIds.has(p.id));
    const next = new Set(selectedPermIds);
    if (allChecked) {
      catPerms.forEach((p) => next.delete(p.id));
    } else {
      catPerms.forEach((p) => next.add(p.id));
    }
    setSelectedPermIds(next);
  };

  const toggleMenu = (id: number) => {
    const next = new Set(selectedMenuIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMenuIds(next);
  };

  const selectAllMenus = (targetMenus: MenuItem[]) => {
    const allChecked = targetMenus.every((m) => selectedMenuIds.has(m.id));
    const next = new Set(selectedMenuIds);
    if (allChecked) {
      targetMenus.forEach((m) => next.delete(m.id));
    } else {
      targetMenus.forEach((m) => next.add(m.id));
    }
    setSelectedMenuIds(next);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const payload: SaveRoleInput = {
        id: role?.id,
        code,
        name,
        scope,
        description,
        permissionIds: Array.from(selectedPermIds),
        menuIds: Array.from(selectedMenuIds),
      };

      const res = await saveRoleAction(payload);
      if (res.success) {
        onSaved();
      } else {
        setError(res.error || "保存失败");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="flex w-screen max-w-2xl flex-col bg-surface shadow-2xl">
          {/* 抽屉头部 */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isEdit ? `编辑角色：${role?.name}` : "新建业务角色"}
                </h2>
                <p className="text-xs text-slate-500">
                  {isSystem
                    ? "系统内置角色（关键标识与类型受保护，可调控细粒度权限）"
                    : "自定义角色，可按需勾选分配菜单与原子操作权限点"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* 抽屉表单主体 */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            {/* 基础信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={nameInputId} className="block text-xs font-semibold text-slate-700">
                  角色名称 <span className="text-red-500">*</span>
                </label>
                <input
                  id={nameInputId}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：财务审核员、运营专员"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor={codeInputId} className="block text-xs font-semibold text-slate-700">
                  角色标识代码 <span className="text-red-500">*</span>
                </label>
                <input
                  id={codeInputId}
                  type="text"
                  value={code}
                  disabled={isSystem}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="如：FINANCE_OPERATOR"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 uppercase font-mono disabled:bg-slate-100 disabled:text-slate-500 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor={scopeSelectId} className="block text-xs font-semibold text-slate-700">
                  适用范围 <span className="text-red-500">*</span>
                </label>
                <select
                  id={scopeSelectId}
                  value={scope}
                  disabled={isSystem}
                  onChange={(e) => setScope(e.target.value as "PLATFORM" | "TENANT")}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 focus:border-primary focus:outline-hidden"
                >
                  <option value="PLATFORM">平台运营端 (PLATFORM)</option>
                  <option value="TENANT">企业租户端 (TENANT)</option>
                </select>
              </div>

              <div>
                <label htmlFor={descInputId} className="block text-xs font-semibold text-slate-700">职责描述说明</label>
                <input
                  id={descInputId}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简述该角色承担的业务职责"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>

            {/* 权限点与菜单配置 Tabs */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("PERMISSIONS")}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === "PERMISSIONS"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <ShieldCheckIcon className="h-4 w-4" />
                  操作权限点配置 ({selectedPermIds.size}/{permissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("MENUS")}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === "MENUS"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <FolderIcon className="h-4 w-4" />
                  可见菜单配置 ({selectedMenuIds.size}/{menus.length})
                </button>
              </div>

              {/* 权限点配置面板 */}
              {activeTab === "PERMISSIONS" && (
                <div className="mt-4 space-y-5">
                  {Object.entries(groupedPerms).map(([category, catPerms]) => {
                    const allCatChecked = catPerms.every((p) => selectedPermIds.has(p.id));
                    return (
                      <div key={category} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <SparklesIcon className="h-3.5 w-3.5 text-primary" />
                            {CATEGORY_NAMES[category] || category}
                            <span className="text-[11px] font-normal text-slate-400">
                              ({catPerms.filter((p) => selectedPermIds.has(p.id)).length}/{catPerms.length})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAllPermsInCat(catPerms)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {allCatChecked ? "取消全选" : "全选分类"}
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {catPerms.map((p) => {
                            const checked = selectedPermIds.has(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                                  checked
                                    ? "border-blue-300 bg-blue-50/60 text-slate-900"
                                    : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePerm(p.id)}
                                  className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-primary focus:ring-primary"
                                />
                                <div className="text-xs">
                                  <div className="font-medium text-slate-800">{p.name}</div>
                                  <div className="text-[11px] font-mono text-slate-400">{p.code}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 菜单配置面板 */}
              {activeTab === "MENUS" && (
                <div className="mt-4 space-y-6">
                  {/* 后台管理菜单 */}
                  <div className="rounded-xl border border-slate-200 bg-surface p-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div>
                        <div className="text-xs font-bold text-slate-900">后台管理中心菜单 (ADMIN)</div>
                        <div className="text-[11px] text-slate-400">配置该角色登录后台侧边栏所能看见并点击的功能入口</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectAllMenus(adminMenus)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        全选/反选后台
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {adminMenus.map((m) => {
                        const checked = selectedMenuIds.has(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 text-xs transition-colors ${
                              checked
                                ? "border-blue-300 bg-blue-50/60 font-semibold text-primary"
                                : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMenu(m.id)}
                                className="h-4 w-4 rounded-sm border-slate-300 text-primary focus:ring-primary"
                              />
                              <span>{m.title}</span>
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{m.path}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 前台工作台菜单 */}
                  <div className="rounded-xl border border-slate-200 bg-surface p-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div>
                        <div className="text-xs font-bold text-slate-900">前台工作台导航菜单 (SITE)</div>
                        <div className="text-[11px] text-slate-400">配置租户角色在前台导航可见的功能模块</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectAllMenus(siteMenus)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        全选/反选前台
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {siteMenus.map((m) => {
                        const checked = selectedMenuIds.has(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 text-xs transition-colors ${
                              checked
                                ? "border-emerald-300 bg-emerald-50/60 font-semibold text-emerald-800"
                                : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMenu(m.id)}
                                className="h-4 w-4 rounded-sm border-slate-300 text-primary focus:ring-primary"
                              />
                              <span>{m.title}</span>
                              {m.badge && (
                                <span className="rounded-sm bg-amber-100 px-1 text-[10px] text-amber-800 font-semibold">
                                  {m.badge}
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{m.path}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 抽屉底部操作栏 */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              已勾选 <span className="font-semibold text-primary">{selectedPermIds.size}</span> 个操作权限点，
              <span className="font-semibold text-primary">{selectedMenuIds.size}</span> 个菜单项
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {isPending ? "保存中..." : "保存角色与授权"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
