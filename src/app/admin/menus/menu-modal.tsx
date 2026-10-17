"use client";

import { useState, useTransition, useId } from "react";
import { saveMenuAction, SaveMenuInput } from "./actions";
import DynamicIcon, { AVAILABLE_ICONS } from "@/components/dynamic-icon";
import { XMarkIcon, CheckCircleIcon } from "@/components/icons";

export interface MenuRecord {
  id: number;
  parentId: number | null;
  title: string;
  path: string;
  icon: string | null;
  sortOrder: number;
  target: string;
  badge: string | null;
  permission: string | null;
  active: boolean;
}

export default function MenuModal({
  isOpen,
  menu,
  defaultTarget,
  permissions,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  menu: MenuRecord | null;
  defaultTarget: "ADMIN" | "SITE";
  permissions: { code: string; name: string; category?: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(menu?.id);

  const [title, setTitle] = useState(menu?.title ?? "");
  const [path, setPath] = useState(menu?.path ?? "");
  const [icon, setIcon] = useState(menu?.icon ?? "FolderIcon");
  const [sortOrder, setSortOrder] = useState<number>(menu?.sortOrder ?? 10);
  const [target, setTarget] = useState<"ADMIN" | "SITE">(
    (menu?.target as "ADMIN" | "SITE") ?? defaultTarget,
  );
  const [badge, setBadge] = useState<string>(menu?.badge ?? "");
  const [permission, setPermission] = useState<string>(menu?.permission ?? "");
  const [active, setActive] = useState<boolean>(menu?.active ?? true);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const titleInputId = useId();
  const pathInputId = useId();
  const iconSelectId = useId();
  const targetSelectId = useId();
  const sortInputId = useId();
  const badgeSelectId = useId();
  const permSelectId = useId();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload: SaveMenuInput = {
        id: menu?.id,
        title,
        path,
        icon,
        sortOrder: Number(sortOrder) || 0,
        target,
        badge: badge || undefined,
        permission: permission || undefined,
        active,
      };

      const res = await saveMenuAction(payload);
      if (res.success) {
        onSaved();
      } else {
        setError(res.error || "保存失败");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-surface shadow-2xl overflow-hidden">
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <DynamicIcon name={icon} className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEdit ? `编辑菜单项：${menu?.title}` : "新建导航菜单项"}
              </h3>
              <p className="text-[11px] text-slate-400">配置路由、图标、权限拦截及角标展示</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 text-xs">
          {error && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={titleInputId} className="block font-semibold text-slate-700">
                菜单标题 <span className="text-red-500">*</span>
              </label>
              <input
                id={titleInputId}
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="如：标书装配工场"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor={pathInputId} className="block font-semibold text-slate-700">
                路由路径 <span className="text-red-500">*</span>
              </label>
              <input
                id={pathInputId}
                type="text"
                required
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="如：/admin/tenders 或 /proposals"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 font-mono focus:border-primary focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor={iconSelectId} className="block font-semibold text-slate-700">展示图标</label>
              <div className="mt-1 flex items-center gap-2">
                <select
                  id={iconSelectId}
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-slate-900 focus:border-primary focus:outline-hidden"
                >
                  {AVAILABLE_ICONS.map((ic) => (
                    <option key={ic.name} value={ic.name}>
                      {ic.label} ({ic.name})
                    </option>
                  ))}
                </select>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                  <DynamicIcon name={icon} className="h-4.5 w-4.5" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor={targetSelectId} className="block font-semibold text-slate-700">所属导航端</label>
              <select
                id={targetSelectId}
                value={target}
                onChange={(e) => setTarget(e.target.value as "ADMIN" | "SITE")}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-slate-900 focus:border-primary focus:outline-hidden"
              >
                <option value="ADMIN">管理后台侧边栏 (ADMIN)</option>
                <option value="SITE">前台工作台顶部/抽屉 (SITE)</option>
              </select>
            </div>

            <div>
              <label htmlFor={sortInputId} className="block font-semibold text-slate-700">排序权重 (升序)</label>
              <input
                id={sortInputId}
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                placeholder="数值越小越靠前，如 10, 20"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor={badgeSelectId} className="block font-semibold text-slate-700">专属特权徽标</label>
              <select
                id={badgeSelectId}
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-slate-900 focus:border-primary focus:outline-hidden"
              >
                <option value="">无徽标 (常规)</option>
                <option value="CORP">企业专属 [企业]</option>
                <option value="VIP">VIP会员 [VIP]</option>
                <option value="HOT">热门商机 [HOT]</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={permSelectId} className="block font-semibold text-slate-700">关联门禁权限点 (可选)</label>
            <select
              id={permSelectId}
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-slate-900 focus:border-primary focus:outline-hidden font-mono"
            >
              <option value="">公开访问（无需特定权限点，角色勾选即见）</option>
              {permissions.map((p) => (
                <option key={p.code} value={p.code}>
                  [{p.category}] {p.name} ({p.code})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              若绑定了权限码，仅拥有对应权限的角色才会渲染此菜单。
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="menu_active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded-sm border-slate-300 text-primary focus:ring-primary"
            />
            <label htmlFor="menu_active" className="cursor-pointer font-medium text-slate-800">
              启用并在导航栏中显示此菜单
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {isPending ? "保存中..." : "保存菜单项"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
