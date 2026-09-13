"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  reaggregateOrphansAction,
  mergeProjectsAction,
  detachTenderAction,
  refreshProjectArbitrationAction,
} from "@/app/admin/projects/actions";
import { type GovernanceMetrics } from "@/lib/project-arbitration";
import { projectStageBadgeColor, type ProjectStage } from "@/lib/project";
import {
  BriefcaseIcon,
  BoltIcon,
  SearchIcon,
  ExternalLinkIcon,
  ArrowsRightLeftIcon,
} from "@/components/icons";

export interface AdminNoticeSummary {
  id: number;
  title: string;
  type: string;
  publishDate: string;
  budgetAmount: number | null;
  awardAmount: number | null;
  purchaser: string | null;
  winningSupplier: string | null;
}

export interface AdminProjectRow {
  id: number;
  projectNo: string | null;
  canonicalTitle: string;
  displayTitle: string;
  provinceCode: string | null;
  provinceName: string | null;
  stage: string;
  stageLabel: string;
  noticeCount: number;
  budgetAmountWan: number | null;
  awardAmountWan: number | null;
  purchaser: string | null;
  winningSupplier: string | null;
  firstSeenAt: string;
  updatedAt: string;
  notices: AdminNoticeSummary[];
}

interface Props {
  initialProjects: AdminProjectRow[];
  metrics: GovernanceMetrics;
  provinces: Array<{ code: string; name: string }>;
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export default function ProjectsManagerView({
  initialProjects,
  metrics,
  provinces,
  currentPage,
  totalPages,
  totalItems,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // 搜索与过滤状态
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [stageFilter, setStageFilter] = useState(searchParams.get("stage") || "all");
  const [provinceFilter, setProvinceFilter] = useState(searchParams.get("province") || "");
  const [multiOnly, setMultiOnly] = useState(searchParams.get("multi") === "1");

  // 关联公告查看抽屉
  const [activeProject, setActiveProject] = useState<AdminProjectRow | null>(null);

  // 合并项目模态框
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [sourceIdInput, setSourceIdInput] = useState("");
  const [targetIdInput, setTargetIdInput] = useState("");
  const [mergeError, setMergeError] = useState("");

  // 执行搜索
  const applyFilters = (newQ?: string, newStage?: string, newProv?: string, newMulti?: boolean) => {
    const params = new URLSearchParams();
    const q = newQ !== undefined ? newQ : searchQuery;
    const stage = newStage !== undefined ? newStage : stageFilter;
    const prov = newProv !== undefined ? newProv : provinceFilter;
    const multi = newMulti !== undefined ? newMulti : multiOnly;

    if (q.trim()) params.set("q", q.trim());
    if (stage && stage !== "all") params.set("stage", stage);
    if (prov) params.set("province", prov);
    if (multi) params.set("multi", "1");
    params.set("page", "1");

    router.push(`/admin/projects?${params.toString()}`);
  };

  // 1. 一键重扫归集孤儿标讯
  const handleReaggregateOrphans = () => {
    if (!confirm("确定要启动全库孤儿标讯批量重扫吗？系统将自动通过编号与文本相似度将孤儿标讯吸纳归集至项目主数据。")) {
      return;
    }
    startTransition(async () => {
      const res = await reaggregateOrphansAction();
      if (res.success && res.data) {
        alert(
          `🎉 孤儿标讯批量重扫归集完成！\n共扫描未关联孤儿标讯: ${res.data.totalScanned} 篇\n成功关联至项目: ${res.data.linked} 篇\n自动新建项目主数据: ${res.data.newlyCreated} 个\n总耗时: ${res.data.durationMs}ms`
        );
        router.refresh();
      } else {
        alert(res.error || "批量重扫失败");
      }
    });
  };

  // 2. 刷新单个项目多源仲裁
  const handleRefreshArbitration = (projectId: number) => {
    startTransition(async () => {
      const res = await refreshProjectArbitrationAction(projectId);
      if (res.success) {
        alert(res.message);
        router.refresh();
      } else {
        alert(res.error || "刷新失败");
      }
    });
  };

  // 3. 执行合并项目
  const handleExecuteMerge = () => {
    const sId = parseInt(sourceIdInput, 10);
    const tId = parseInt(targetIdInput, 10);
    if (isNaN(sId) || isNaN(tId)) {
      setMergeError("请输入有效的数字项目 ID");
      return;
    }
    if (sId === tId) {
      setMergeError("源项目 ID 与目标项目 ID 不能相同");
      return;
    }

    startTransition(async () => {
      setMergeError("");
      const res = await mergeProjectsAction(sId, tId);
      if (res.success) {
        alert(res.message || "合并成功");
        setIsMergeModalOpen(false);
        setSourceIdInput("");
        setTargetIdInput("");
        router.refresh();
      } else {
        setMergeError(res.error || "合并失败");
      }
    });
  };

  // 4. 拆分标讯
  const handleDetachTender = (tenderId: number) => {
    if (!confirm(`确定要将标讯 #${tenderId} 从当前项目中拆分并为其创建独立项目吗？`)) {
      return;
    }
    startTransition(async () => {
      const res = await detachTenderAction(tenderId);
      if (res.success) {
        alert(res.message || "拆分成功");
        setActiveProject(null);
        router.refresh();
      } else {
        alert(res.error || "拆分失败");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 头部大盘与工具栏 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                <BriefcaseIcon className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                项目主数据与多源仲裁中枢
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              打破单篇公告孤岛：跨时间线穿透【采购预告 → 招标公告 → 答疑更正 → 中标成交】，提供孤儿批量吸纳、多源字段仲裁与项目合并治理
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/projects"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-primary hover:text-primary transition-colors"
            >
              <span>前台穿透大盘</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-400" />
            </Link>

            <button
              onClick={() => {
                setSourceIdInput("");
                setTargetIdInput("");
                setMergeError("");
                setIsMergeModalOpen(true);
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2.5 text-xs font-semibold text-purple-700 shadow-xs hover:bg-purple-100 transition-colors"
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
              <span>合并项目</span>
            </button>

            <button
              disabled={isPending}
              onClick={handleReaggregateOrphans}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <BoltIcon className="h-4 w-4" />
              <span>{isPending ? "正在重扫归集..." : "⚡ 一键重扫孤儿标讯"}</span>
            </button>
          </div>
        </div>

        {/* 4 大核心资产治理指标 */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
            <span className="text-xs font-medium text-slate-500">项目主数据总量</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
                {metrics.totalProjects}
              </span>
              <span className="text-xs text-slate-400">个独立项目</span>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/40 p-3.5 border border-emerald-100/60">
            <span className="text-xs font-medium text-emerald-700">标讯主数据关联率</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 tnum">
                {metrics.linkedRate}%
              </span>
              <span className="text-xs text-emerald-600">({metrics.linkedTenders}/{metrics.totalTenders})</span>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50/40 p-3.5 border border-amber-100/60">
            <span className="text-xs font-medium text-amber-700">待吸纳孤儿标讯</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-amber-600 tnum">
                {metrics.orphanTenders}
              </span>
              <span className="text-xs text-amber-600">篇未绑定</span>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50/40 p-3.5 border border-blue-100/60">
            <span className="text-xs font-medium text-blue-700">长周期穿透项目 (≥2篇)</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-blue-600 tnum">
                {metrics.multiNoticeProjects}
              </span>
              <span className="text-xs text-blue-600">个多阶段贯通</span>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索与过滤工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs text-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[280px]">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="搜索项目名称、项目编号、采购人、供应商..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-primary focus:bg-white transition-colors"
            />
          </div>

          {/* 阶段下拉 */}
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              applyFilters(undefined, e.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-primary"
          >
            <option value="all">全部生命周期阶段</option>
            <option value="INTENTION">采购意向公示</option>
            <option value="BIDDING">正在招标申报</option>
            <option value="CLARIFYING">更正澄清答疑</option>
            <option value="AWARDED">已中标成交</option>
            <option value="TERMINATED">流标/终止</option>
          </select>

          {/* 省份下拉 */}
          <select
            value={provinceFilter}
            onChange={(e) => {
              setProvinceFilter(e.target.value);
              applyFilters(undefined, undefined, e.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-primary"
          >
            <option value="">全国所有省份</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          {/* 仅看多公告复选 */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900 ml-1">
            <input
              type="checkbox"
              checked={multiOnly}
              onChange={(e) => {
                setMultiOnly(e.target.checked);
                applyFilters(undefined, undefined, undefined, e.target.checked);
              }}
              className="rounded border-slate-300 text-primary focus:ring-0"
            />
            <span>仅多公告穿透 (≥2篇)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => applyFilters()}
            className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 transition-colors"
          >
            筛选查询
          </button>
          <button
            onClick={() => {
              setSearchQuery("");
              setStageFilter("all");
              setProvinceFilter("");
              setMultiOnly(false);
              router.push("/admin/projects");
            }}
            className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            重置
          </button>
        </div>
      </div>

      {/* 主数据表格 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
              <th className="px-5 py-3.5 font-medium">项目 ID / 编号</th>
              <th className="px-5 py-3.5 font-medium">规范化项目名称</th>
              <th className="px-5 py-3.5 font-medium">所属地区</th>
              <th className="px-5 py-3.5 font-medium">生命周期阶段</th>
              <th className="px-5 py-3.5 font-medium">穿透公告</th>
              <th className="px-5 py-3.5 font-medium">仲裁金额 (预算 / 中标)</th>
              <th className="px-5 py-3.5 font-medium">采购人 / 中标商</th>
              <th className="px-5 py-3.5 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {initialProjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  没有找到符合条件的项目主数据
                </td>
              </tr>
            ) : (
              initialProjects.map((p) => {
                return (
                  <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900">#{p.id}</div>
                      {p.projectNo ? (
                        <div className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]" title={p.projectNo}>
                          {p.projectNo}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">无官方编号</div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 max-w-[280px]">
                      <Link
                        href={`/projects/${p.id}`}
                        target="_blank"
                        className="font-semibold text-slate-900 hover:text-primary hover:underline line-clamp-2"
                        title={p.displayTitle}
                      >
                        {p.displayTitle}
                      </Link>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        首次发现: {new Date(p.firstSeenAt).toLocaleDateString("zh-CN")}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600">
                      {p.provinceName || "全国"}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${projectStageBadgeColor(
                          p.stage as ProjectStage
                        )}`}
                      >
                        {p.stageLabel}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setActiveProject(p)}
                        className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                          p.noticeCount >= 2
                            ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <span>{p.noticeCount} 篇</span>
                        <span className="text-[10px]">展开 ↗</span>
                      </button>
                    </td>

                    <td className="px-5 py-3.5 tnum">
                      <div className="text-slate-900 font-semibold">
                        {p.budgetAmountWan ? `${p.budgetAmountWan} 万预算` : "—"}
                      </div>
                      <div className="text-emerald-600 font-bold">
                        {p.awardAmountWan ? `${p.awardAmountWan} 万中标` : "—"}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 max-w-[180px]">
                      <div className="truncate" title={p.purchaser || ""}>
                        {p.purchaser ? `买方: ${p.purchaser}` : "—"}
                      </div>
                      <div className="truncate text-slate-500" title={p.winningSupplier || ""}>
                        {p.winningSupplier ? `卖方: ${p.winningSupplier}` : ""}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          disabled={isPending}
                          onClick={() => handleRefreshArbitration(p.id)}
                          title="重新计算该项目生命周期阶段、预算与中标商仲裁"
                          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                        >
                          刷新仲裁
                        </button>
                        <button
                          onClick={() => {
                            setSourceIdInput(p.id.toString());
                            setTargetIdInput("");
                            setMergeError("");
                            setIsMergeModalOpen(true);
                          }}
                          title="将此项目合并到另一个主数据项目"
                          className="cursor-pointer rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-purple-700 hover:bg-purple-100 transition-colors"
                        >
                          合并
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* 分页导航 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <div>
              共 <span className="font-semibold text-slate-900">{totalItems}</span> 个项目主数据，第{" "}
              <span className="font-semibold text-slate-900">{currentPage}</span> / {totalPages} 页
            </div>
            <div className="flex items-center gap-1.5">
              {currentPage > 1 && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("page", (currentPage - 1).toString());
                    router.push(`/admin/projects?${params.toString()}`);
                  }}
                  className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50"
                >
                  上一页
                </button>
              )}
              {currentPage < totalPages && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("page", (currentPage + 1).toString());
                    router.push(`/admin/projects?${params.toString()}`);
                  }}
                  className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50"
                >
                  下一页
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 关联公告列表抽屉 */}
      {activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  项目 #{activeProject.id} 穿透公告时间线 ({activeProject.notices.length} 篇)
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                  {activeProject.displayTitle}
                </p>
              </div>
              <button
                onClick={() => setActiveProject(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕ 关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {activeProject.notices.map((n, idx) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs transition-colors hover:bg-blue-50/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900">{n.title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span>发布时间: {new Date(n.publishDate).toLocaleDateString("zh-CN")}</span>
                        <span>类型: {n.type}</span>
                        {n.budgetAmount && <span>预算: {n.budgetAmount} 元</span>}
                        {n.awardAmount && <span className="font-bold text-emerald-600">中标: {n.awardAmount} 元</span>}
                        {n.winningSupplier && <span>供应商: {n.winningSupplier}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/tender/${n.id}`}
                        target="_blank"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:border-primary hover:text-primary transition-colors"
                      >
                        详情
                      </Link>
                      {activeProject.notices.length > 1 && (
                        <button
                          disabled={isPending}
                          onClick={() => handleDetachTender(n.id)}
                          title="将此篇标讯从当前项目中移出，并为其独立生成新项目"
                          className="cursor-pointer rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                          拆分出项目
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 text-right">
              <button
                onClick={() => setActiveProject(null)}
                className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                关闭抽屉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 项目合并治理弹窗 */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowsRightLeftIcon className="h-5 w-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">合并项目主数据</h3>
              </div>
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <p className="text-slate-500">
                将【源项目】的所有关联标讯全部转移至【目标项目】，并重新计算目标项目的全生命周期阶段与金额仲裁。合并完成后源项目将被自动清理。
              </p>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  待并入的源项目 ID (将被清空并迁移)
                </label>
                <input
                  type="number"
                  value={sourceIdInput}
                  onChange={(e) => setSourceIdInput(e.target.value)}
                  placeholder="例如: 105"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 outline-none focus:border-primary focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  接收的目标项目 ID (保留并聚合)
                </label>
                <input
                  type="number"
                  value={targetIdInput}
                  onChange={(e) => setTargetIdInput(e.target.value)}
                  placeholder="例如: 88"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 outline-none focus:border-primary focus:bg-white"
                />
              </div>

              {mergeError && (
                <div className="rounded-xl bg-red-50 p-2.5 text-red-600 font-medium">
                  {mergeError}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                disabled={isPending}
                onClick={handleExecuteMerge}
                className="cursor-pointer rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isPending ? "正在合并..." : "确认合并"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
