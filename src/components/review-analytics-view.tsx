"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  TrophyIcon,
  ScaleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  SparklesIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  PlusIcon,
  ArrowRightIcon,
} from "@/components/icons";
import {
  getReviewAnalyticsAction,
  type ReviewAnalyticsResponse,
} from "@/app/actions/review";
import {
  PRIMARY_CAUSES_META,
  formatCurrencyWan,
  type PrimaryCauseType,
} from "@/lib/review-manager";
import BidReviewModal from "@/components/bid-review-modal";

interface Props {
  initialData: ReviewAnalyticsResponse;
  hasTeam: boolean;
}

export default function ReviewAnalyticsView({ initialData, hasTeam }: Props) {
  const [data, setData] = useState(initialData);
  const [mode, setMode] = useState<"personal" | "team">(hasTeam ? "team" : "personal");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [causeFilter, setCauseFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [activeFollowId, setActiveFollowId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [, startTransition] = useTransition();

  const reloadData = async (
    newMode = mode,
    newOutcome = outcomeFilter,
    newCause = causeFilter
  ) => {
    setLoading(true);
    const res = await getReviewAnalyticsAction({
      mode: newMode,
      outcomeFilter: newOutcome,
      causeFilter: newCause,
    });
    if (res.success) {
      setData(res);
    }
    setLoading(false);
  };

  const handleModeChange = (newMode: "personal" | "team") => {
    setMode(newMode);
    startTransition(() => {
      reloadData(newMode, outcomeFilter, causeFilter);
    });
  };

  const handleOutcomeChange = (newOutcome: string) => {
    setOutcomeFilter(newOutcome);
    startTransition(() => {
      reloadData(mode, newOutcome, causeFilter);
    });
  };

  const handleCauseChange = (newCause: string) => {
    setCauseFilter(newCause);
    startTransition(() => {
      reloadData(mode, outcomeFilter, newCause);
    });
  };

  const summary = data.summary;
  const reviews = data.reviews || [];

  return (
    <div className="space-y-6">
      {/* 顶部标题与团队切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ScaleIcon className="size-6 text-primary" />
              企业投标复盘与胜败归因诊断罗盘
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              M2 智能决策引擎
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            精细化记录开标对标数据，穿透诊断报价失误、技术硬伤、业绩短板与客情控标六大失分诱因，闭环沉淀团队胜率。
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasTeam && (
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleModeChange("team")}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === "team"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                企业团队战盘
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("personal")}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === "personal"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                我负责的项目
              </button>
            </div>
          )}

          <Link
            href="/tracker"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <span>返回跟进看板</span>
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 维核心指标大盘卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 卡片 1: 胜率与总复盘数 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">综合投标胜率 (Win Rate)</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <TrophyIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tnum">
              {summary ? `${summary.winRate}%` : "0%"}
            </span>
            <span className="text-xs text-slate-500">
              ({summary?.wonCount || 0} 中标 / {summary?.totalCount || 0} 已复盘)
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            <span>失标项目: {summary?.lostCount || 0} 个</span>
          </div>
        </div>

        {/* 卡片 2: 累计中标金额 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">已复盘累计中标额</span>
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <ChartBarIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900 tnum">
              {formatCurrencyWan(summary?.totalWonAmount || 0)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
            <span className="inline-block size-2 rounded-full bg-primary" />
            <span>我方投标总报价: {formatCurrencyWan(summary?.totalMyBidAmount || 0)}</span>
          </div>
        </div>

        {/* 卡片 3: 价格偏离度 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">报价对标偏离情况</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
              <ScaleIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900 tnum">
              {summary?.priceGapStats.avgPriceGapPercent !== undefined && summary.priceGapStats.avgPriceGapPercent !== 0
                ? `${summary.priceGapStats.avgPriceGapPercent > 0 ? "+" : ""}${summary.priceGapStats.avgPriceGapPercent}%`
                : "均价贴合"}
            </span>
            <span className="text-xs text-slate-500">平均价差率</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <span>偏高: {summary?.priceGapStats.higherCount || 0}</span>
            <span>·</span>
            <span>贴合: {summary?.priceGapStats.similarCount || 0}</span>
            <span>·</span>
            <span>偏低: {summary?.priceGapStats.lowerCount || 0}</span>
          </div>
        </div>

        {/* 卡片 4: 核心痛点归因聚焦 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">最高频失分诱因</span>
            <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
              <AlertCircleIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-900 line-clamp-1">
              {summary && summary.causeBreakdown.length > 0
                ? summary.causeBreakdown[0].shortLabel
                : "尚未归因"}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            {summary && summary.causeBreakdown.length > 0 ? (
              <span>
                占总复盘数 {summary.causeBreakdown[0].percent}% ({summary.causeBreakdown[0].count} 次触发)
              </span>
            ) : (
              <span>暂无归因记录</span>
            )}
          </div>
        </div>
      </div>

      {/* 归因漏斗与经验沉淀栏目 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 2 列: 六维归因漏斗分布 */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ScaleIcon className="size-5 text-primary" />
              <h2 className="text-sm font-bold text-slate-900">
                失标与成败归因分布漏斗 (Cause Attribution Breakdown)
              </h2>
            </div>
            <span className="text-xs text-slate-400">已归类 {summary?.totalCount || 0} 项</span>
          </div>

          <div className="space-y-3.5">
            {summary && summary.causeBreakdown.length > 0 ? (
              summary.causeBreakdown.map((item) => (
                <div key={item.cause} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-2">
                      <span className={`inline-block size-2 rounded-full ${item.badgeColor.includes("amber") ? "bg-amber-500" : item.badgeColor.includes("rose") ? "bg-rose-500" : item.badgeColor.includes("indigo") ? "bg-indigo-500" : item.badgeColor.includes("purple") ? "bg-purple-500" : item.badgeColor.includes("red") ? "bg-red-500" : "bg-sky-500"}`} />
                      {item.label}
                    </span>
                    <span className="font-bold text-slate-900 tnum">
                      {item.count} 次 ({item.percent}%)
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.cause === "PRICE"
                          ? "bg-amber-500"
                          : item.cause === "TECHNICAL"
                          ? "bg-rose-500"
                          : item.cause === "COMMERCIAL"
                          ? "bg-indigo-500"
                          : item.cause === "CLIENT_RELATION"
                          ? "bg-purple-500"
                          : item.cause === "COMPLIANCE"
                          ? "bg-red-500"
                          : "bg-sky-500"
                      }`}
                      style={{ width: `${Math.max(item.percent, 3)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-slate-400">
                暂无归因数据，请在下方项目列表中添加开标复盘诊断。
              </div>
            )}
          </div>
        </div>

        {/* 右侧 1 列: 沉淀与教训锦囊卡片 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <SparklesIcon className="size-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">实战经验与教训库</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="font-bold text-emerald-800 flex items-center gap-1 mb-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                高频亮点与制胜打法 (Keep Doing)
              </span>
              {summary && summary.topStrengths.length > 0 ? (
                <ul className="space-y-1 text-slate-600 bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                  {summary.topStrengths.map((s, idx) => (
                    <li key={idx} className="line-clamp-2 leading-relaxed">
                      • {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 p-2">尚未提取亮点记录</p>
              )}
            </div>

            <div>
              <span className="font-bold text-rose-800 flex items-center gap-1 mb-1">
                <span className="size-1.5 rounded-full bg-rose-500" />
                高发短板与排查提醒 (Stop Doing)
              </span>
              {summary && summary.topShortcomings.length > 0 ? (
                <ul className="space-y-1 text-slate-600 bg-rose-50/50 rounded-xl p-3 border border-rose-100">
                  {summary.topShortcomings.map((s, idx) => (
                    <li key={idx} className="line-clamp-2 leading-relaxed">
                      • {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 p-2">尚未提取教训记录</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 复盘台账明细列表 */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* 筛选过滤工具条 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 bg-slate-50/60">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DocumentTextIcon className="size-4 text-primary" />
              已复盘投标项目台账 ({reviews.length})
            </h3>

            {/* 成败筛选 */}
            <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleOutcomeChange("ALL")}
                className={`rounded-md px-2.5 py-1 transition ${
                  outcomeFilter === "ALL"
                    ? "bg-white text-slate-900 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                全部成败
              </button>
              <button
                type="button"
                onClick={() => handleOutcomeChange("WON")}
                className={`rounded-md px-2.5 py-1 transition ${
                  outcomeFilter === "WON"
                    ? "bg-white text-emerald-800 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                仅中标 (WON)
              </button>
              <button
                type="button"
                onClick={() => handleOutcomeChange("LOST")}
                className={`rounded-md px-2.5 py-1 transition ${
                  outcomeFilter === "LOST"
                    ? "bg-white text-rose-800 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                仅失标 (LOST)
              </button>
            </div>

            {/* 主因筛选下拉 */}
            <div className="relative inline-block">
              <select
                value={causeFilter}
                onChange={(e) => handleCauseChange(e.target.value)}
                className="appearance-none rounded-lg border border-slate-300 bg-white py-1 pl-3 pr-8 text-xs font-medium text-slate-700 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
              >
                <option value="ALL">全部归因维度</option>
                {(Object.keys(PRIMARY_CAUSES_META) as PrimaryCauseType[]).map((c) => (
                  <option key={c} value={c}>
                    {PRIMARY_CAUSES_META[c].shortLabel}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-2 size-3 text-slate-400" />
            </div>
          </div>
        </div>

        {/* 列表内容 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs">加载复盘列表中...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-2">
            <ScaleIcon className="size-10 stroke-1 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">暂无符合条件的复盘项目</p>
            <p className="text-xs text-slate-400 max-w-sm">
              前往跟进看板，在已结案（中标 / 失标）的项目卡片上点击【复盘归因】即可一键登记诊断。
            </p>
            <Link
              href="/tracker"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition"
            >
              <PlusIcon className="size-3.5" />
              <span>前往看板录入</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((item) => {
              const meta = PRIMARY_CAUSES_META[item.primaryCause] || PRIMARY_CAUSES_META.OTHER;
              const isWon = item.outcome === "WON";

              return (
                <div
                  key={item.id}
                  className="p-5 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          isWon
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isWon ? "中标 WIN" : "失标 LOST"}
                      </span>

                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${meta.badgeColor}`}
                      >
                        {meta.shortLabel}
                      </span>

                      {item.ranking && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          排名: 第 {item.ranking} 名
                        </span>
                      )}

                      {item.priceGapPercent !== null && item.priceGapPercent !== undefined && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            Number(item.priceGapPercent) > 5
                              ? "bg-amber-50 text-amber-800"
                              : Number(item.priceGapPercent) < -5
                              ? "bg-sky-50 text-sky-800"
                              : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          价差: {Number(item.priceGapPercent) > 0 ? "+" : ""}
                          {item.priceGapPercent}%
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      <Link
                        href={`/tender/${item.projectInfo.tenderId}`}
                        className="hover:text-primary transition"
                      >
                        {item.projectInfo.title}
                      </Link>
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {item.projectInfo.purchaser && (
                        <span>业主: {item.projectInfo.purchaser}</span>
                      )}
                      <span>
                        中标方:{" "}
                        <strong className="text-slate-700 font-medium">
                          {item.winningSupplier || (isWon ? "我方企业" : "-")}
                        </strong>
                      </span>
                      <span>中标额: {formatCurrencyWan(item.winningAmount)}</span>
                      <span>我方报价: {formatCurrencyWan(item.myBidAmount)}</span>
                      {item.reviewer && <span>复盘人: {item.reviewer}</span>}
                      <span>复盘日期: {item.reviewedAt.slice(0, 10)}</span>
                    </div>

                    {/* 次要诱因标签 */}
                    {item.secondaryCauses && item.secondaryCauses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.secondaryCauses.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFollowId(item.followId);
                        setIsModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                    >
                      <DocumentTextIcon className="size-3.5" />
                      <span>查看/调整复盘</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 复盘弹窗 */}
      {activeFollowId && (
        <BidReviewModal
          followId={activeFollowId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setActiveFollowId(null);
          }}
          onSaved={() => {
            reloadData();
          }}
        />
      )}
    </div>
  );
}
