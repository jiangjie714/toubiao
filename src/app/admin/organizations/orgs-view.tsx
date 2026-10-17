"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  OrganizationRecord,
  OrganizationsOverviewData,
  adminRemoveMemberFromTeamAction,
} from "./actions";
import AdjustSeatsModal from "./adjust-seats-modal";
import {
  BuildingIcon,
  UsersIcon,
  TrophyIcon,
  ChartBarIcon,
  TrashIcon,
  PencilSquareIcon,
  SearchIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from "@/components/icons";

export default function OrgsView({ initialData }: { initialData: OrganizationsOverviewData }) {
  const router = useRouter();
  const { metrics, organizations } = initialData;

  const [search, setSearch] = useState("");
  const [modalOrg, setModalOrg] = useState<OrganizationRecord | null>(null);
  const [activeOrgMembers, setActiveOrgMembers] = useState<OrganizationRecord | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const [isPending, startTransition] = useTransition();

  const filteredOrgs = organizations.filter((org) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.owner.username.toLowerCase().includes(q) ||
      org.owner.name.toLowerCase().includes(q) ||
      (org.owner.companyName && org.owner.companyName.toLowerCase().includes(q))
    );
  });

  const handleRemoveMember = (memberId: number, memberName: string) => {
    if (!confirm(`确定要将成员「${memberName}」从该企业组织席位中强制解绑吗？`)) return;

    startTransition(async () => {
      const res = await adminRemoveMemberFromTeamAction(memberId);
      if (res.success) {
        setFeedback({ text: `成员「${memberName}」已成功解绑` });
        router.refresh();
      } else {
        setFeedback({ text: res.error || "解绑失败", isError: true });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 大核心指标 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">企业组织总数</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <BuildingIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tnum">{metrics.totalOrgs}</div>
          <div className="mt-1 text-xs text-slate-400">已开通多席位组织</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">席位总配额上限</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <UsersIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-indigo-600 tnum">{metrics.totalMaxSeats}</div>
          <div className="mt-1 text-xs text-slate-400">全平台最大可容纳员工</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">在用席位总数</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheckIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600 tnum">{metrics.totalUsedSeats}</div>
          <div className="mt-1 text-xs text-slate-400">活跃企业协同成员</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">平均席位利用率</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ChartBarIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-600 tnum">
            {metrics.avgUtilizationRate}%
          </div>
          <div className="mt-1 text-xs text-slate-400">在职与配额比值</div>
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

      {/* 搜索过滤栏 */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索企业全称、组织名称、负责人姓名…"
            className="w-full rounded-lg border border-slate-200 bg-surface py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-hidden"
          />
        </div>
        <div className="text-xs text-slate-500">
          共找到 <span className="font-semibold text-slate-900 tnum">{filteredOrgs.length}</span> 家企业组织
        </div>
      </div>

      {/* 企业组织表格 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">企业客户 / 团队名称</th>
              <th className="px-4 py-3">企业负责人</th>
              <th className="px-4 py-3">付费商业套餐</th>
              <th className="px-4 py-3">席位配额利用率</th>
              <th className="px-4 py-3">在席成员</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrgs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  暂无匹配的企业组织记录
                </td>
              </tr>
            ) : (
              filteredOrgs.map((org) => {
                const isFull = org.usedSeats >= org.maxSeats;
                return (
                  <tr key={org.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{org.name}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                        <BuildingIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-slate-700">
                          {org.owner.companyName || "未实名登记企业"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{org.owner.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">
                        @{org.owner.username}
                      </div>
                      {org.owner.email && (
                        <div className="font-mono text-[11px] text-slate-400">{org.owner.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        <TrophyIcon className="h-3.5 w-3.5 text-amber-600" />
                        {org.owner.planName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 min-w-[160px]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800 tnum">
                          {org.usedSeats} / {org.maxSeats} 席
                        </span>
                        <span
                          className={`font-semibold tnum ${
                            isFull ? "text-amber-600" : "text-slate-500"
                          }`}
                        >
                          {org.utilizationRate}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull
                              ? "bg-amber-500"
                              : org.utilizationRate > 70
                                ? "bg-primary"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, org.utilizationRate)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setActiveOrgMembers(org)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-blue-100 transition-colors"
                      >
                        <UsersIcon className="h-3.5 w-3.5" />
                        {org.members.length} 名成员
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setModalOrg(org)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-surface px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5 text-slate-500" />
                        席位调配
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 成员透视抽屉 */}
      {activeOrgMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="h-full w-full max-w-lg bg-surface shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {activeOrgMembers.name} - 席位成员透视
                </h3>
                <p className="text-[11px] text-slate-400">
                  当前已占用 {activeOrgMembers.members.length} / {activeOrgMembers.maxSeats} 个席位
                </p>
              </div>
              <button
                onClick={() => setActiveOrgMembers(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {activeOrgMembers.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-surface p-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-700 text-xs">
                      {m.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        <span className="font-mono text-slate-400 text-[11px]">@{m.username}</span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                            m.role === "OWNER"
                              ? "bg-purple-100 text-purple-800"
                              : m.role === "MANAGER"
                                ? "bg-blue-100 text-primary"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {m.role === "OWNER" ? "团队创建人" : m.role === "MANAGER" ? "业务总监" : "投标专员"}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                        {m.title && <span>职务: {m.title}</span>}
                        <span>
                          加入时间: {new Date(m.joinedAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {m.role !== "OWNER" && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id, m.name)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      强制解绑
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-right">
              <button
                type="button"
                onClick={() => setActiveOrgMembers(null)}
                className="rounded-lg border border-slate-300 bg-surface px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                关闭抽屉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 席位调配弹窗 */}
      <AdjustSeatsModal
        isOpen={Boolean(modalOrg)}
        org={modalOrg}
        onClose={() => setModalOrg(null)}
        onSaved={() => {
          setModalOrg(null);
          setFeedback({ text: "企业席位配额已成功调配生效" });
          router.refresh();
        }}
      />
    </div>
  );
}
