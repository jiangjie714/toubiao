"use client";

import React, { useState, useTransition } from "react";
import {
  TrophyIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  BuildingIcon,
  ShieldCheckIcon,
  CheckIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  saveCompanyCaseAction,
  deleteCompanyCaseAction,
} from "@/app/actions/case";
import { type CompanyCaseItem } from "@/lib/case-matching";
import { INDUSTRY_META } from "@/lib/industry";

interface Props {
  initialCases: CompanyCaseItem[];
  companyName: string;
  totalAmountWan: number;
}

export default function CaseLibraryView({
  initialCases,
  companyName,
  totalAmountWan,
}: Props) {
  const [cases, setCases] = useState<CompanyCaseItem[]>(initialCases);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "VALID_3Y" | "OVERDUE_3Y">("ALL");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<CompanyCaseItem | null>(null);

  const [formData, setFormData] = useState<{
    id?: number;
    title: string;
    clientName: string;
    amountWan: string;
    signDate: string;
    industryCode: string;
    serviceScope: string;
    projectLeader: string;
    hasAcceptanceDoc: boolean;
    contractFileUrl: string;
  }>({
    title: "",
    clientName: "",
    amountWan: "",
    signDate: new Date().toISOString().split("T")[0],
    industryCode: "IT_SOFTWARE",
    serviceScope: "",
    projectLeader: "",
    hasAcceptanceDoc: true,
    contractFileUrl: "",
  });

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // 指标统计
  const validThreeYearsCount = cases.filter((c) => !c.isOverdueThreeYears).length;
  const withAcceptanceDocCount = cases.filter((c) => c.hasAcceptanceDoc).length;
  const docCoverageRate = cases.length > 0 ? Math.round((withAcceptanceDocCount / cases.length) * 100) : 0;

  const handleOpenCreate = () => {
    setEditItem(null);
    setFormData({
      title: "",
      clientName: "",
      amountWan: "",
      signDate: new Date().toISOString().split("T")[0],
      industryCode: "IT_SOFTWARE",
      serviceScope: "",
      projectLeader: "",
      hasAcceptanceDoc: true,
      contractFileUrl: "",
    });
    setFormError("");
    setIsEditOpen(true);
  };

  const handleOpenEdit = (item: CompanyCaseItem) => {
    setEditItem(item);
    setFormData({
      id: item.id,
      title: item.title,
      clientName: item.clientName,
      amountWan: item.amountWan.toString(),
      signDate: item.signDate,
      industryCode: item.industryCode || "IT_SOFTWARE",
      serviceScope: item.serviceScope || "",
      projectLeader: item.projectLeader || "",
      hasAcceptanceDoc: item.hasAcceptanceDoc,
      contractFileUrl: item.contractFileUrl || "",
    });
    setFormError("");
    setIsEditOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const numAmt = parseFloat(formData.amountWan);
    if (!formData.title.trim()) {
      setFormError("合同项目名称不能为空");
      return;
    }
    if (!formData.clientName.trim()) {
      setFormError("业主/客户单位名称不能为空");
      return;
    }
    if (isNaN(numAmt) || numAmt <= 0) {
      setFormError("合同金额必须为有效正数（万元）");
      return;
    }

    startTransition(async () => {
      const res = await saveCompanyCaseAction({
        id: editItem ? editItem.id : undefined,
        title: formData.title,
        clientName: formData.clientName,
        amountWan: numAmt,
        signDate: formData.signDate,
        industryCode: formData.industryCode || undefined,
        serviceScope: formData.serviceScope || undefined,
        projectLeader: formData.projectLeader || undefined,
        hasAcceptanceDoc: formData.hasAcceptanceDoc,
        contractFileUrl: formData.contractFileUrl || undefined,
      });

      if (res.success) {
        setIsEditOpen(false);
        window.location.reload();
      } else {
        setFormError(res.error || "保存失败");
      }
    });
  };

  const handleDelete = (item: CompanyCaseItem) => {
    if (!confirm(`确定删除业绩【${item.title}】吗？删除后投标匹配将不再引用此案例。`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteCompanyCaseAction(item.id);
      if (res.success) {
        setCases(cases.filter((c) => c.id !== item.id));
      } else {
        alert(res.error || "删除失败");
      }
    });
  };

  const filteredCases = cases.filter((item) => {
    if (timeFilter === "VALID_3Y" && item.isOverdueThreeYears) return false;
    if (timeFilter === "OVERDUE_3Y" && !item.isOverdueThreeYears) return false;
    if (selectedIndustry !== "ALL" && item.industryCode !== selectedIndustry) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchClient = item.clientName.toLowerCase().includes(q);
      const matchScope = item.serviceScope?.toLowerCase().includes(q);
      const matchLeader = item.projectLeader?.toLowerCase().includes(q);
      return matchTitle || matchClient || matchScope || matchLeader;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* 头部标题与操作 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              企业投标业绩与合同案例资产库
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              <TrophyIcon className="h-3.5 w-3.5" />
              {companyName}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            集中归档历史工程、软硬件及服务合同业绩，在任意标讯详情页一键秒级匹配类似业绩满分证明
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          <span>录入业绩案例</span>
        </button>
      </div>

      {/* 4 大核心指标卡 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 1: 累计储备案例 */}
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">累计储备业绩</span>
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <TrophyIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-slate-900">{cases.length}</span>
              <span className="text-xs text-slate-500 font-medium">个项目</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">数字化沉淀企业成功案例</p>
          </div>
        </div>

        {/* 卡片 2: 合同总额 */}
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">合同业绩总规模</span>
            <span className="rounded-lg bg-blue-50 p-2 text-primary">
              <BuildingIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-blue-700">
                {totalAmountWan.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">万元</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">历史签约标杆履约体量</p>
          </div>
        </div>

        {/* 卡片 3: 3 年内黄金案例 */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">3年内高分黄金案例</span>
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
              <SparklesIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-emerald-700">
                {validThreeYearsCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">个</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">完全满足政采近3年时效要求</p>
          </div>
        </div>

        {/* 卡片 4: 验收证明完备率 */}
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">验收/评价证明完备度</span>
            <span className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <ShieldCheckIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-purple-700">
                {docCoverageRate}%
              </span>
              <span className="text-xs text-slate-500 font-medium">（{withAcceptanceDocCount} 项具备）</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">附带竣工验收单更具信服力</p>
          </div>
        </div>
      </div>

      {/* 搜索与多维度筛选栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 时效筛选 */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setTimeFilter("ALL")}
              className={`cursor-pointer px-2.5 py-1 rounded-md transition font-medium ${
                timeFilter === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              全部时段
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("VALID_3Y")}
              className={`cursor-pointer px-2.5 py-1 rounded-md transition font-medium ${
                timeFilter === "VALID_3Y" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              近 3 年内黄金业绩 ({validThreeYearsCount})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("OVERDUE_3Y")}
              className={`cursor-pointer px-2.5 py-1 rounded-md transition font-medium ${
                timeFilter === "OVERDUE_3Y" ? "bg-rose-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              已超 3 年 ({cases.length - validThreeYearsCount})
            </button>
          </div>

          {/* 行业赛道下拉 */}
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">全部行业赛道</option>
            {Object.entries(INDUSTRY_META).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.name}
              </option>
            ))}
          </select>
        </div>

        {/* 关键字搜索框 */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索业绩名称/客户/供货范围..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 案例列表表格 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {filteredCases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <TrophyIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">未检索到符合条件的业绩案例</h3>
            <p className="mt-1 text-xs text-slate-500">
              请调整上方筛选条件，或点击“录入业绩案例”添加合同
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">业绩项目名称</th>
                  <th className="px-4 py-3 text-left">业主 / 客户单位</th>
                  <th className="px-4 py-3 text-right">合同金额</th>
                  <th className="px-4 py-3 text-center">签署日期与时效</th>
                  <th className="px-4 py-3 text-center">垂直行业</th>
                  <th className="px-4 py-3 text-center">证明完备度</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* 项目名称与供货范围 */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {item.title}
                      </div>
                      {item.serviceScope && (
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                          范围: {item.serviceScope}
                        </p>
                      )}
                    </td>

                    {/* 客户单位 */}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {item.clientName}
                    </td>

                    {/* 金额 */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-blue-700 text-sm">
                        {item.amountWan.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1">万元</span>
                    </td>

                    {/* 签署日期与时效 */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div>{item.signDate}</div>
                      <div className="mt-0.5">
                        {item.isOverdueThreeYears ? (
                          <span className="inline-flex rounded bg-rose-50 px-1.5 py-0.2 text-[10px] text-rose-700 border border-rose-200">
                            已超 3 年
                          </span>
                        ) : (
                          <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] text-emerald-700 border border-emerald-200">
                            3年内黄金
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 行业赛道 */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {item.industryLabel}
                      </span>
                    </td>

                    {/* 证明材料 */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {item.hasAcceptanceDoc ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold text-[11px]">
                          <CheckIcon className="h-3.5 w-3.5" />
                          附带验收证明
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">仅合同原件</span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="cursor-pointer text-xs font-medium text-slate-600 hover:text-indigo-600"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="cursor-pointer text-xs font-medium text-rose-500 hover:text-rose-700"
                      >
                        <TrashIcon className="h-3.5 w-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 录入 / 编辑业绩案例模态窗 */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editItem ? "编辑企业业绩案例" : "录入类似项目业绩证明"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  合同 / 项目全称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="如：某市第一人民医院信息化网络及集成服务项目"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    业主 / 客户单位 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="如：某市第一人民医院"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    合同金额 (万元) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amountWan}
                    onChange={(e) => setFormData({ ...formData, amountWan: e.target.value })}
                    placeholder="如：380.00"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    合同签署日期 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.signDate}
                    onChange={(e) => setFormData({ ...formData, signDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">所属垂直行业</label>
                  <select
                    value={formData.industryCode}
                    onChange={(e) => setFormData({ ...formData, industryCode: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    {Object.entries(INDUSTRY_META).map(([code, meta]) => (
                      <option key={code} value={code}>
                        {meta.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">主要供货或实施范围关键描述</label>
                <textarea
                  rows={2}
                  value={formData.serviceScope}
                  onChange={(e) => setFormData({ ...formData, serviceScope: e.target.value })}
                  placeholder="如：医院机房网络建设、HIS系统集成、信创终端采购等（用于自动关键词语义匹配）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">项目负责人 / 项目经理</label>
                  <input
                    type="text"
                    value={formData.projectLeader}
                    onChange={(e) => setFormData({ ...formData, projectLeader: e.target.value })}
                    placeholder="如：张三（高工、PMP）"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasAcceptanceDoc}
                      onChange={(e) => setFormData({ ...formData, hasAcceptanceDoc: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="font-semibold text-slate-700">具备竣工验收报告/好评证明</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending ? "正在保存..." : "保存业绩"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
