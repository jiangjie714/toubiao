"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  type MarketOverviewData,
  type DailyTrendPoint,
} from "@/lib/analytics";
import { getMarketIntelligenceAction } from "@/app/actions/analytics";
import {
  ChartBarIcon,
  BuildingIcon,
  TrophyIcon,
  MapPinIcon,
  ArrowRightIcon,
  LockClosedIcon,
  ExternalLinkIcon,
  SparklesIcon,
  PrinterIcon,
} from "@/components/icons";

interface Props {
  initialData: MarketOverviewData & {
    isPremium: boolean;
    planCode: string;
    lockedPurchasersCount: number;
    lockedSuppliersCount: number;
  };
  provinces: { code: string; name: string }[];
}

export default function AnalyticsDashboard({ initialData, provinces }: Props) {
  const [data, setData] = useState(initialData);
  const [days, setDays] = useState<number>(initialData.timeframeDays || 30);
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPremium = data.isPremium;

  const handleTimeframeChange = (newDays: number) => {
    if (!isPremium && newDays > 7) {
      setShowUpgradeModal(true);
      return;
    }
    setDays(newDays);
    loadData(newDays, selectedProvince);
  };

  const handleProvinceChange = (provCode: string) => {
    setSelectedProvince(provCode);
    loadData(days, provCode);
  };

  const loadData = (d: number, prov: string) => {
    startTransition(async () => {
      const res = await getMarketIntelligenceAction({
        days: d,
        provinceCode: prov || undefined,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  // SVG 趋势图计算
  const trendPoints: DailyTrendPoint[] = data.dailyTrend.slice(-15);
  const maxCount = Math.max(...trendPoints.map((p) => p.count), 1);
  const maxBudget = Math.max(...trendPoints.map((p) => p.budgetWan), 1);

  return (
    <div className="space-y-6">
      {/* 顶部控制栏与周报入口 */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              行业标讯大数据情报大盘
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isPremium
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isPremium ? `${data.planCode} 会员专享` : "免费版 (已脱敏)"}
            </span>
            {isPending && (
              <span className="text-xs text-primary animate-pulse font-medium">
                正在刷新数据...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            全网招标发包趋势、买方大金主画像、竞争对手中标网络及亿元级超级标王透视
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 时间周期切换 */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-600">
            {[
              { label: "近7天", val: 7 },
              { label: "近30天", val: 30 },
              { label: "近90天", val: 90 },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => handleTimeframeChange(item.val)}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
                  days === item.val
                    ? "bg-white font-semibold text-primary shadow-xs"
                    : "hover:text-slate-900"
                }`}
              >
                {!isPremium && item.val > 7 && <LockClosedIcon className="h-3 w-3 text-slate-400" />}
                {item.label}
              </button>
            ))}
          </div>

          {/* 省份筛选 */}
          <select
            value={selectedProvince}
            onChange={(e) => handleProvinceChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs focus:border-primary focus:outline-none"
          >
            <option value="">全国范围</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          {/* 生成商机周报按钮 */}
          <Link
            href="/brief"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <PrinterIcon className="h-4 w-4" />
            生成商机决策周报
          </Link>
        </div>
      </div>

      {/* 免费版升级提示 Banner */}
      {!isPremium && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500 p-2 text-white">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                升级白金会员，解锁全量 10 强采购业主与竞争对手中标穿透
              </div>
              <p className="text-xs text-slate-600">
                当前仅展示部分脱敏数据。升级可穿透近 90 天所有招标业主、友商拿单底牌及超级标王详情。
              </p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
          >
            立即解锁特权
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* 4 大核心指标卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">监测项目总量</span>
            <ChartBarIcon className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 tnum">
              {data.totalTenders.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">篇公告</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">覆盖全网公开招标、成交、更正</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">招标预算资金池</span>
            <SparklesIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-600 tnum">
              {data.totalBudgetWan.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">万元</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            折合约 {(data.totalBudgetWan / 10000).toFixed(2)} 亿元
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">活跃采购业主 (买方)</span>
            <BuildingIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 tnum">
              {data.activePurchasersCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">家机构</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">机关事业单位、高校、国央企</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">活跃中标供应商 (友商)</span>
            <TrophyIcon className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 tnum">
              {data.winningSuppliersCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">家企业</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">已解析真实中标先锋企业</div>
        </div>
      </div>

      {/* 趋势图与类型分布 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 每日发标与预算趋势图 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">标讯发布与预算趋势</h2>
              <p className="text-xs text-slate-500">
                近 {days || "全量"} 天公告发布数量与预算资金波动态势
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                标讯数 (篇)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                预算 (万元)
              </span>
            </div>
          </div>

          <div className="mt-6">
            {trendPoints.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">所选范围内暂无走势数据</div>
            ) : (
              <div className="space-y-2">
                {/* 简易纯 SVG 柱线混排图 */}
                <div className="relative h-44 w-full">
                  <div className="flex h-36 items-end gap-1.5 sm:gap-2">
                    {trendPoints.map((pt, i) => {
                      const countHeight = Math.max(8, (pt.count / maxCount) * 100);
                      const budgetHeight = Math.max(4, (pt.budgetWan / maxBudget) * 100);
                      return (
                        <div
                          key={pt.date}
                          className="group relative flex h-full flex-1 flex-col items-center justify-end"
                        >
                          {/* 悬停信息浮层 */}
                          <div className="pointer-events-none absolute bottom-full mb-2 hidden -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] text-white opacity-0 shadow-lg transition group-hover:block group-hover:opacity-100 z-10 whitespace-nowrap">
                            <div className="font-bold">{pt.date}</div>
                            <div>标讯发布: {pt.count} 篇</div>
                            <div>预算总额: {pt.budgetWan} 万元</div>
                          </div>

                          <div className="flex w-full items-end justify-center gap-0.5">
                            {/* 标讯数柱子 */}
                            <div
                              style={{ height: `${countHeight}%` }}
                              className="w-full max-w-[12px] rounded-t-xs bg-blue-500/80 transition-all hover:bg-blue-600"
                            />
                            {/* 预算柱子 */}
                            <div
                              style={{ height: `${budgetHeight}%` }}
                              className="w-full max-w-[12px] rounded-t-xs bg-amber-400/80 transition-all hover:bg-amber-500"
                            />
                          </div>
                          <div className="mt-2 text-[10px] text-slate-400 truncate w-full text-center">
                            {i % 2 === 0 ? pt.date.slice(5) : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 业务类型分布 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">标讯类型占比</h2>
          <p className="text-xs text-slate-500">业务类型多维分布结构</p>

          <div className="mt-6 space-y-4">
            {data.typeDistribution.map((item) => (
              <div key={item.type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-2 tnum">
                    <span className="font-semibold text-slate-900">{item.count} 篇</span>
                    <span className="text-slate-400">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">💡 投标策略洞察：</span>
            公开招标与竞争性磋商通常具有完整的招标文件编制期（15-20天），适合重点跟进策划。
          </div>
        </div>
      </div>

      {/* 买方大金主雷达 vs 竞争对手先锋榜 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 采购业主排行榜 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BuildingIcon className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">采购业主实力榜 (买方金主雷达)</h2>
                <p className="text-xs text-slate-500">近阶段发包项目数量与预算规模 TOP 10</p>
              </div>
            </div>
            {data.lockedPurchasersCount > 0 && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                <LockClosedIcon className="h-3 w-3" />
                解锁后7席
              </Link>
            )}
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {data.topPurchasers.map((p, idx) => {
              const isLocked = !isPremium && idx >= 3;
              return (
                <div
                  key={`${p.purchaser}-${idx}`}
                  className="flex items-center justify-between py-2.5 text-xs transition hover:bg-slate-50/80 px-2 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        idx === 0
                          ? "bg-amber-500 text-white"
                          : idx === 1
                          ? "bg-slate-400 text-white"
                          : idx === 2
                          ? "bg-amber-700/70 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      {isLocked ? (
                        <div className="flex items-center gap-1.5 font-medium text-slate-400">
                          <span>{p.purchaser}</span>
                          <span className="rounded bg-amber-100 px-1 py-0.2 text-[10px] text-amber-700">
                            会员解锁
                          </span>
                        </div>
                      ) : (
                        <Link
                          href={`/list?purchaser=${encodeURIComponent(p.purchaser)}`}
                          className="font-medium text-slate-900 hover:text-primary truncate block hover:underline"
                          title="点击查看该单位所有发包项目"
                        >
                          {p.purchaser}
                        </Link>
                      )}
                      <div className="text-[10px] text-slate-400">最近发包: {p.latestDate}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right tnum">
                    <div>
                      <div className="font-semibold text-slate-900">{p.count} 标</div>
                      <div className="text-[10px] text-slate-400">
                        {p.totalBudgetWan > 0 ? `${p.totalBudgetWan}万预算` : "未公开限价"}
                      </div>
                    </div>
                    {!isLocked && (
                      <Link
                        href={`/list?purchaser=${encodeURIComponent(p.purchaser)}`}
                        className="text-slate-400 hover:text-primary"
                        title="穿透至标讯检索"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 中标供应商排行榜 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrophyIcon className="h-5 w-5 text-purple-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">中标供应商先锋榜 (竞争对手雷达)</h2>
                <p className="text-xs text-slate-500">中标笔数与金额领跑企业 TOP 10</p>
              </div>
            </div>
            {data.lockedSuppliersCount > 0 && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                <LockClosedIcon className="h-3 w-3" />
                解锁后7席
              </Link>
            )}
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {data.topSuppliers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">暂无已解析中标供应商数据</div>
            ) : (
              data.topSuppliers.map((s, idx) => {
                const isLocked = !isPremium && idx >= 3;
                return (
                  <div
                    key={`${s.supplier}-${idx}`}
                    className="flex items-center justify-between py-2.5 text-xs transition hover:bg-slate-50/80 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          idx === 0
                            ? "bg-purple-600 text-white"
                            : idx === 1
                            ? "bg-purple-400 text-white"
                            : idx === 2
                            ? "bg-purple-300 text-purple-900"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {idx + 1}
                      </span>

                      <div className="min-w-0">
                        {isLocked ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-400">
                            <span>{s.supplier}</span>
                            <span className="rounded bg-amber-100 px-1 py-0.2 text-[10px] text-amber-700">
                              会员解锁
                            </span>
                          </div>
                        ) : (
                          <Link
                            href={`/list?winningSupplier=${encodeURIComponent(s.supplier)}`}
                            className="font-medium text-slate-900 hover:text-primary truncate block hover:underline"
                            title="点击查看该企业中标项目清单"
                          >
                            {s.supplier}
                          </Link>
                        )}
                        <div className="text-[10px] text-slate-400">最近中标: {s.latestDate}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right tnum">
                      <div>
                        <div className="font-semibold text-purple-700">{s.count} 次中标</div>
                        <div className="text-[10px] text-slate-400">
                          {s.totalAwardWan > 0 ? `${s.totalAwardWan}万总额` : "金额未披露"}
                        </div>
                      </div>
                      {!isLocked && (
                        <Link
                          href={`/list?winningSupplier=${encodeURIComponent(s.supplier)}`}
                          className="text-slate-400 hover:text-primary"
                          title="穿透至标讯检索"
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 核心省份预算分布与超级标王透视 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 省份分布 TOP 8 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">核心省市采购活跃度</h2>
              <p className="text-xs text-slate-500">标讯发布与预算分布 TOP 8</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {data.provinceDistribution.map((item) => (
              <div key={item.code} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  <span className="font-semibold text-slate-900 tnum">
                    {item.count} 篇
                    {item.totalBudgetWan > 0 ? ` (${item.totalBudgetWan}万)` : ""}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${Math.min(100, (item.count / (data.totalTenders || 1)) * 100 * 2)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 重点超级标王透视 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">重点超级标王项目透视</h2>
              <p className="text-xs text-slate-500">单标最高预算规模项目雷达</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              亿元级高价值商机
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {data.topBudgetTenders.map((p, idx) => {
              const isLocked = !isPremium && idx >= 2;
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        TOP {idx + 1}
                      </span>
                      {isLocked ? (
                        <span className="font-medium text-slate-400 text-xs">{p.title}</span>
                      ) : (
                        <Link
                          href={`/tender/${p.id}`}
                          className="font-semibold text-slate-900 text-xs hover:text-primary hover:underline line-clamp-1"
                        >
                          {p.title}
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>买方: {p.purchaser || "未明确"}</span>
                      {p.provinceName && <span>地区: {p.provinceName}</span>}
                      <span>发布: {p.publishDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right tnum">
                      <div className="text-sm font-black text-amber-600">
                        {p.budgetAmountWan.toLocaleString()} 万元
                      </div>
                      <div className="text-[10px] text-slate-400">预算控制价</div>
                    </div>
                    {!isLocked ? (
                      <Link
                        href={`/tender/${p.id}`}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-primary hover:text-primary"
                      >
                        详情
                      </Link>
                    ) : (
                      <Link
                        href="/pricing"
                        className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        解锁
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 升级弹窗 */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-500 p-2 text-white">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900">升级会员解锁 30/90 天长周期大盘</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              免费版仅开放近 7 天宏观数据。升级至黄金版或白金版，即可解锁近 30 天 / 近 90 天全周期行业走势、全国 10 强发包买方大金主穿透、友商竞争情报及商机周报生成特权。
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                暂不需要
              </button>
              <Link
                href="/pricing"
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
              >
                前往升级方案
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
