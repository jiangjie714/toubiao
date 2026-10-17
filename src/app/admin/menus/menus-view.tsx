"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DynamicIcon from "@/components/dynamic-icon";
import MenuModal, { MenuRecord } from "./menu-modal";
import {
  toggleMenuActiveAction,
  deleteMenuAction,
  resetDefaultMenusAction,
} from "./actions";
import {
  FolderIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from "@/components/icons";

interface MenuDataWithCount extends MenuRecord {
  parent?: { id: number; title: string } | null;
  _count: {
    roleMenus: number;
    children: number;
  };
}

export default function MenusView({
  initialMenus,
  permissions,
}: {
  initialMenus: MenuDataWithCount[];
  permissions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ADMIN" | "SITE">("ADMIN");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuRecord | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const [isPending, startTransition] = useTransition();

  const filteredMenus = initialMenus.filter((m) => m.target === activeTab);
  const adminCount = initialMenus.filter((m) => m.target === "ADMIN").length;
  const siteCount = initialMenus.filter((m) => m.target === "SITE").length;

  const handleEdit = (menu: MenuRecord) => {
    setEditingMenu(menu);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingMenu(null);
    setModalOpen(true);
  };

  const handleToggle = (id: number, currentActive: boolean) => {
    startTransition(async () => {
      const res = await toggleMenuActiveAction(id, !currentActive);
      if (res.success) {
        router.refresh();
      } else {
        setFeedback({ text: res.error || "状态切换失败", isError: true });
      }
    });
  };

  const handleDelete = (menu: MenuDataWithCount) => {
    if (!confirm(`确定要删除菜单「${menu.title} (${menu.path})」吗？`)) return;

    startTransition(async () => {
      const res = await deleteMenuAction(menu.id);
      if (res.success) {
        setFeedback({ text: `菜单「${menu.title}」已删除` });
        router.refresh();
      } else {
        setFeedback({ text: res.error || "删除失败", isError: true });
      }
    });
  };

  const handleResetDefaults = () => {
    if (!confirm("确定要一键恢复系统预设的标准前后台菜单结构吗？已有自定义菜单不会被覆盖。")) return;

    startTransition(async () => {
      const res = await resetDefaultMenusAction();
      if (res.success) {
        setFeedback({ text: "预设菜单结构已成功恢复并同步生效" });
        router.refresh();
      } else {
        setFeedback({ text: res.error || "重置失败", isError: true });
      }
    });
  };

  return (
    <div className="space-y-6">
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

      {/* 选项卡与顶栏操作 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-slate-200 bg-surface p-1">
          <button
            onClick={() => setActiveTab("ADMIN")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === "ADMIN"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <FolderIcon className="h-4 w-4" />
            后台管理侧边栏 (ADMIN: {adminCount})
          </button>
          <button
            onClick={() => setActiveTab("SITE")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === "SITE"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <FolderIcon className="h-4 w-4" />
            前台工作台导航 (SITE: {siteCount})
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetDefaults}
            disabled={isPending}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className="h-3.5 w-3.5 text-slate-400" />
            一键补齐预设菜单
          </button>

          <button
            onClick={handleCreate}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            新建{activeTab === "ADMIN" ? "后台" : "前台"}菜单项
          </button>
        </div>
      </div>

      {/* 菜单列表表格 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">排序</th>
              <th className="px-4 py-3">菜单标题 / 图标</th>
              <th className="px-4 py-3">路由路径</th>
              <th className="px-4 py-3">门禁权限码</th>
              <th className="px-4 py-3">专属徽标</th>
              <th className="px-4 py-3">关联角色数</th>
              <th className="px-4 py-3">启用状态</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMenus.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  暂无{activeTab === "ADMIN" ? "后台" : "前台"}菜单项，可点击右上角「一键补齐预设菜单」
                </td>
              </tr>
            ) : (
              filteredMenus.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-slate-500 tnum">
                    {item.sortOrder}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <DynamicIcon name={item.icon} className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-slate-900">{item.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                    {item.path}
                  </td>
                  <td className="px-4 py-3.5">
                    {item.permission ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-blue-50 px-2 py-0.5 text-[11px] font-mono font-medium text-primary">
                        <ShieldCheckIcon className="h-3 w-3" />
                        {item.permission}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">公开无门禁</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {item.badge ? (
                      <span
                        className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                          item.badge === "CORP"
                            ? "bg-amber-100 text-amber-800"
                            : item.badge === "VIP"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.badge === "CORP" ? "企业" : item.badge}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium">
                    {item._count.roleMenus} 个角色
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id, item.active)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        item.active ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          item.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-blue-50 transition-colors"
                    >
                      <PencilSquareIcon className="h-3.5 w-3.5" />
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MenuModal
        isOpen={modalOpen}
        menu={editingMenu}
        defaultTarget={activeTab}
        permissions={permissions}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          setFeedback({ text: "菜单配置已成功保存" });
          router.refresh();
        }}
      />
    </div>
  );
}
