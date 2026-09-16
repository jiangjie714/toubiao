"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChartBarIcon,
  SparklesIcon,
  SearchIcon,
  BuildingIcon,
  TrophyIcon,
  BoltIcon,
  ScaleIcon,
} from "@/components/icons";
import {
  HistoricalBenchmarkResult,
  HistoricalQueryFilters,
} from "@/lib/historical-analytics";
import { getHistoricalBenchmarkAction } from "@/app/actions/historical";

interface HistoricalExplorerViewProps {
  initialData: HistoricalBenchmarkResult;
  initialFilters: HistoricalQueryFilters;
}

const INDUSTRIES = [
  { code: "", label: "全部行业赛道" },
  { code: "software", label: "软件与信息化" },
  { code: "medical", label: "医疗设备与医药" },
  { code: "construction", label: "建筑与工程施工" },
  { code: "environmental", label: "环保与水务工程" },
  { code: "education", label: "教育与科研装备" },
  { code: "security", label: "安防监控与弱电" },
  { code: "energy", label: "电力与新能源" },
  { code: "finance", label: "金融外包与商用" },
];

const YEARS = [
  { value: "ALL", label: "全部历史年份" },
  { value: "2026", label: "2026 年度" },
  { value: "2025", label: "2025 年度" },
  { value: "2024", label: "2024 年度" },
  { value: "2023", label: "2023 年度" },
];

export default function HistoricalExplorerView({
  initialData,
  initialFilters,
}: HistoricalExplorerViewProps) {
  const [data, setData] = useState<HistoricalBenchmarkResult>(initialData);
  const [filters, setFilters] = useState<HistoricalQueryFilters>(initialFilters);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await getHistoricalBenchmarkAction(filters);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        alert(res.error || "查询失败");
      }
    });
  };

  const handleFilterChange = (key: keyof HistoricalQueryFilters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    startTransition(async () => {
      const res = await getHistoricalBenchmarkAction(next);
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题与说明 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xs">
              <ChartBarIcon className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              历史标讯大数据穿透分析库与价格下浮罗盘
            </h1>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              M2 大数据产品化
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            对标千里马历史数据库，深度穿透历年中标案例、测算行业让利下浮率分布，量化分析发包单位供应商集中度 (CR3/CR5) 垄断指数，为科学报价提供博弈依据。
          </p>
        </div>
      </div>

      {/* 多维筛选栏 */}
      <form
        onSubmit={handleSearch}
        className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* 关键字搜索 */}
          <div className="relative min-w-[240px] flex-1">
            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索历史项目名称、采购人或中标商..."
              value={filters.q || ""}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* 行业赛道选择 */}
          <select
            value={filters.industryCode || ""}
            onChange={(e) => handleFilterChange("industryCode", e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind.code} value={ind.code}>
                {ind.label}
              </option>
            ))}
          </select>

          {/* 年份选择 */}
          <select
            value={filters.year || "ALL"}
            onChange={(e) => handleFilterChange("year", e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            {YEARS.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          <SparklesIcon className="h-4 w-4" />
          <span>{isPending ? "正在穿透计算..." : "穿透分析"}</span>
        </button>
      </form>

      {/* 核心大数据 KPI 指标卡 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">穿透分析标讯总量</span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              大盘基数
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 tnum">
              {data.stats.totalAnalyzedTenders.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">条</span>
          </div>
          <div className="text-[11px] text-slate-500">
            涵盖招标、中标、更正全过程链
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">有效价格对标样本</span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              预算vs中标
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-indigo-600 tnum">
              {data.stats.validPricingSamplesCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">笔成交</span>
          </div>
          <div className="text-[11px] text-slate-500">
            累计成交额 ¥{data.stats.totalAwardWan.toLocaleString()} 万元
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">行业平均让利下浮率</span>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              让利均值
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-emerald-700 tnum">
              {data.stats.avgDiscountRate}%
            </span>
            <span className="text-xs text-emerald-600">中位数 {data.stats.medianDiscountRate}%</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            主流折扣集中在 5%~10% 区间
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">采购人 CR3 垄断均值</span>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              市场集中度
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-amber-700 tnum">
              {data.stats.avgCr3Rate}%
            </span>
            <span className="text-xs text-amber-600">Top3 份额</span>
          </div>
          <div className="text-[11px] text-amber-700 font-medium">
            市场竞争度处于良性区间
          </div>
        </div>
      </div>

      {/* 核心看板：价格下浮率分布图谱与科学报价罗盘 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左侧：下浮率分布区间图 */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                历史中标价格让利下浮率分布图谱
              </h3>
              <p className="text-xs text-slate-500">
                计算公式：(预算金额 - 中标金额) / 预算金额 × 100%
              </p>
            </div>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              样本数：{data.stats.validPricingSamplesCount} 笔
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {data.discountDistribution.map((bucket, idx) => {
              // 柱条颜色阶梯
              const barColors = [
                "bg-rose-500",
                "bg-blue-500",
                "bg-emerald-500",
                "bg-indigo-500",
                "bg-amber-500",
              ];
              const barColor = barColors[idx % barColors.length];

              return (
                <div key={bucket.rangeLabel} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {bucket.rangeLabel}
                    </span>
                    <div className="flex items-center gap-2 tnum">
                      <span className="text-slate-500">{bucket.count} 笔</span>
                      <span className="font-bold text-slate-900 min-w-[45px] text-right">
                        {bucket.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* 进度柱状条 */}
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.max(bucket.percentage, 1)}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-500">
                    {bucket.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：科学报价博弈建议罗盘 */}
        <div className="lg:col-span-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-blue-50/40 p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <ScaleIcon className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-indigo-950">
                标讯通 · 智能投标报价博弈罗盘
              </h3>
            </div>
            <p className="mt-1 text-xs text-indigo-800">
              基于该赛道历史真实成交大数据下浮中枢深度学习测算
            </p>

            <div className="mt-5 rounded-xl border border-indigo-200/80 bg-white/80 p-4 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-500">
                推荐理性投标报价下浮区间
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-600 tnum">
                  {data.pricingAdvice.recommendedMinRate}%
                </span>
                <span className="text-slate-400 font-semibold">至</span>
                <span className="text-3xl font-extrabold text-indigo-600 tnum">
                  {data.pricingAdvice.recommendedMaxRate}%
                </span>
              </div>
              <div className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
                {data.pricingAdvice.rationalStrategyAdvice}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/60 p-3.5 text-xs text-indigo-900 border border-indigo-100 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <BoltIcon className="h-3.5 w-3.5 text-amber-600" />
              <span>投标报价避坑准则：</span>
            </div>
            <p className="text-[11px] text-slate-600">
              ① 下浮超 25% 极易触发评标委员会“成本合理性澄清”甚至一票否决；<br />
              ② 保持在行业让利均值（{data.stats.avgDiscountRate}%）微浮可兼顾技术分权重。
            </p>
          </div>
        </div>
      </div>

      {/* 采购人供应商集中度 (CR3 / CR5) 垄断指数穿透 */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              主要采购单位供应商集中度 (CR3) 垄断穿透大盘
            </h3>
            <p className="text-xs text-slate-500">
              CR3 为该采购人历史采购总额中前 3 名供应商占比；帮助判断其合作体系是充分开放还是高度垄断。
            </p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            活跃采购人 Top 10
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-slate-600">
              <tr>
                <th className="py-2.5 px-3 font-semibold">采购单位名称</th>
                <th className="py-2.5 px-3 font-semibold">发包项目数</th>
                <th className="py-2.5 px-3 font-semibold">累计采购总额</th>
                <th className="py-2.5 px-3 font-semibold">CR3 集中度</th>
                <th className="py-2.5 px-3 font-semibold">市场开放度评定</th>
                <th className="py-2.5 px-3 font-semibold">常选中标供应商 (Top 3)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.topPurchasersConcentration.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    当前筛选条件下暂无集中度样本数据
                  </td>
                </tr>
              ) : (
                data.topPurchasersConcentration.map((p) => {
                  return (
                    <tr key={p.purchaser} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900 max-w-[220px] truncate">
                        <Link
                          href={`/purchasers/${encodeURIComponent(p.purchaser)}`}
                          target="_blank"
                          className="hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          <BuildingIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{p.purchaser}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-3 tnum font-medium text-slate-800">
                        {p.totalProjects} 标段
                      </td>
                      <td className="py-3 px-3 tnum font-bold text-slate-900">
                        ¥{p.totalAwardWan.toLocaleString()} 万元
                      </td>
                      <td className="py-3 px-3 tnum font-bold text-indigo-600">
                        {p.cr3Rate}%
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            p.monopolyType === "OPEN"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.monopolyType === "HIGHLY_CONCENTRATED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {p.monopolyLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <div className="space-y-1">
                          {p.topSuppliers.map((s, sIdx) => (
                            <div
                              key={s.supplier}
                              className="text-[11px] truncate max-w-[260px]"
                            >
                              <span className="text-slate-400">#{sIdx + 1} </span>
                              <span className="font-medium text-slate-800">{s.supplier}</span>
                              <span className="text-slate-400"> ({s.shareRate}%)</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 经典成交标讯档案穿透列表 */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              历史真实成交经典案例明细穿透
            </h3>
            <p className="text-xs text-slate-500">
              真实项目预算、中标金额与实际让利下浮率对照表，点击可查看官方原招标公告与评标详情。
            </p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            展示 {data.recentClassicTransactions.length} 笔经典案例
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-slate-600">
              <tr>
                <th className="py-2.5 px-3 font-semibold">成交项目名称</th>
                <th className="py-2.5 px-3 font-semibold">发包采购单位</th>
                <th className="py-2.5 px-3 font-semibold">最终中标供应商</th>
                <th className="py-2.5 px-3 font-semibold text-right">预算金额</th>
                <th className="py-2.5 px-3 font-semibold text-right">中标金额</th>
                <th className="py-2.5 px-3 font-semibold text-right">让利下浮率</th>
                <th className="py-2.5 px-3 font-semibold text-right">成交日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.recentClassicTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    暂无符合筛选条件的历史成交记录
                  </td>
                </tr>
              ) : (
                data.recentClassicTransactions.map((item) => {
                  const rate = item.discountRate ?? 0;
                  const isPositive = rate >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-900 max-w-[240px]">
                        <Link
                          href={`/tender/${item.id}`}
                          target="_blank"
                          className="hover:text-primary transition-colors line-clamp-2"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[150px] truncate">
                        {item.purchaser || "见公告"}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 max-w-[160px] truncate">
                        <span className="inline-flex items-center gap-1">
                          <TrophyIcon className="h-3 w-3 text-amber-500 shrink-0" />
                          <span>{item.winningSupplier || "见公告"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-500 tnum">
                        {item.budgetAmountWan ? `¥${item.budgetAmountWan.toLocaleString()} 万` : "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tnum">
                        {item.awardAmountWan ? `¥${item.awardAmountWan.toLocaleString()} 万` : "-"}
                      </td>
                      <td className="py-3 px-3 text-right tnum">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isPositive ? `↓ ${rate}%` : `↑ ${Math.abs(rate)}%`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 font-mono text-[11px] tnum">
                        {item.publishDate}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
