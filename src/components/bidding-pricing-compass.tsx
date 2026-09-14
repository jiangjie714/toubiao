"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ScaleIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SparklesIcon,
  LockClosedIcon,
  PrinterIcon,
  XMarkIcon,
} from "@/components/icons";
import {
  getBiddingPricingCompassAction,
  type BiddingPricingActionResponse,
} from "@/app/actions/bidding-pricing";
import type { BiddingPricingAnalysis } from "@/lib/bidding-pricing";

export default function BiddingPricingCompassModal({
  tenderId,
  isOpen,
  onClose,
}: {
  tenderId: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<BiddingPricingAnalysis | null>(null);
  const [isPlatinum, setIsPlatinum] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // 用户互动调整
  const [simQuote, setSimQuote] = useState<number>(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    startTransition(async () => {
      setLoading(true);
      setError("");
      try {
        const res: BiddingPricingActionResponse = await getBiddingPricingCompassAction({
          tenderId,
        });
        if (!active) return;
        if (res.success && res.data) {
          setData(res.data);
          setIsPlatinum(res.isPlatinumOrAbove);
          setSimQuote(res.data.currentSimulation.quoteWan);
        } else {
          setError(res.error || "获取报价博弈数据失败");
        }
      } catch (err) {
        console.error("Failed to load bidding pricing compass:", err);
        if (active) {
          setError("连接服务器超时，请稍后重试");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [tenderId, isOpen]);

  // 当用户调整拟报价时，本地即时重算下浮率与得分
  const budget = data?.budgetAmountWan || 100;
  const priceWeight = data?.priceWeight || 30;
  const currentDiscountRate =
    budget > 0 ? Math.round(((budget - simQuote) / budget) * 1000) / 10 : 0;

  // 假设进攻价拿满分
  const baseQuote = data?.recommendedStrategies.aggressive.quoteWan || budget * 0.88;
  const currentEstimatedScore =
    simQuote <= baseQuote
      ? priceWeight
      : Math.round(((baseQuote / simQuote) * priceWeight) * 10) / 10;

  const isAnomalousLow = currentDiscountRate >= (data?.abnormalLowThresholdRate || 25);
  const isOverpriced = currentDiscountRate <= 3.0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
              <ScaleIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>AI 投标报价博弈与下浮率精算罗盘</span>
                <span className="rounded-full bg-blue-400/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                  专业版
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                穿透采购人历史成交下浮率，精准推演商务价格分与异常低价红线
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 内容主体 */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <div className="text-sm font-medium text-slate-600">
                正在深度挖掘采购人历史成交数据并计算最佳报价博弈策略…
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              {error}
            </div>
          ) : data ? (
            <>
              {/* 关键基准指标卡片组 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <div className="text-xs font-medium text-slate-500">标的预算金额</div>
                  <div className="mt-1 text-xl font-bold text-slate-900 tnum">
                    ¥{data.budgetAmountWan.toLocaleString("zh-CN")}
                    <span className="ml-1 text-xs font-normal text-slate-500">万元</span>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
                  <div className="text-xs font-medium text-blue-700">历史成交均值下浮</div>
                  <div className="mt-1 text-xl font-bold text-primary tnum">
                    {data.benchmark.avgDiscountRate}%
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400 truncate" title={data.benchmark.sourceLabel}>
                    {data.benchmark.sourceLabel}
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
                  <div className="text-xs font-medium text-indigo-700">核心黄金成交带</div>
                  <div className="mt-1 text-xl font-bold text-indigo-900 tnum">
                    {data.benchmark.preferredBand[0]}% ~ {data.benchmark.preferredBand[1]}%
                  </div>
                  <div className="mt-0.5 text-[10px] text-indigo-500">25%~75%高频中标区间</div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5">
                  <div className="text-xs font-medium text-amber-700">异常低价审查警戒线</div>
                  <div className="mt-1 text-xl font-bold text-amber-800 tnum">
                    ≥ {data.abnormalLowThresholdRate}%
                  </div>
                  <div className="mt-0.5 text-[10px] text-amber-600">政采 87 号令第六十条</div>
                </div>
              </div>

              {/* 动态出价模拟器 */}
              <div className="rounded-xl border border-slate-200 bg-surface p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-slate-900">
                      实时报价滑块与商务价格分测算器
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    采用政府采购标准【低价优先法】（基准价得满分 {priceWeight} 分）
                  </span>
                </div>

                {/* 滑块与数值输入 */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px] items-center pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>下浮率调整: <strong className="text-slate-900 tnum">{currentDiscountRate}%</strong></span>
                      <span>当前拟报总价: <strong className="text-primary tnum">¥{simQuote.toFixed(2)} 万元</strong></span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="32"
                      step="0.5"
                      value={currentDiscountRate}
                      onChange={(e) => {
                        const r = parseFloat(e.target.value);
                        const q = Math.round(budget * (1 - r / 100) * 100) / 100;
                        setSimQuote(q);
                      }}
                      className="w-full accent-primary h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0% (平价报预算)</span>
                      <span>10% (黄金成交带)</span>
                      <span>20% (激进冲锋)</span>
                      <span className="text-red-500 font-semibold">25%+ (低价澄清红线)</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <div className="text-xs text-slate-500">预估商务价格分</div>
                    <div className="mt-1 text-2xl font-black text-primary tnum">
                      {currentEstimatedScore}
                      <span className="text-xs font-normal text-slate-500"> / {priceWeight}分</span>
                    </div>
                  </div>
                </div>

                {/* 状态徽章与评估提示 */}
                <div
                  className={`rounded-lg p-3 text-xs flex items-start gap-2.5 ${
                    isAnomalousLow
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : isOverpriced
                      ? "bg-amber-50 border border-amber-200 text-amber-800"
                      : "bg-blue-50 border border-blue-200 text-blue-900"
                  }`}
                >
                  {isAnomalousLow ? (
                    <AlertCircleIcon className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  ) : isOverpriced ? (
                    <AlertCircleIcon className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  ) : (
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      {isAnomalousLow
                        ? "🚨 异常低价澄清风险预警"
                        : isOverpriced
                        ? "⚠️ 报价偏高提醒"
                        : "✅ 出价合理，处于良性博弈区间"}
                    </div>
                    <div>
                      {isAnomalousLow
                        ? `下浮率已达到 ${currentDiscountRate}%（超 25% 红线），极易被评标专家判定为恶性低价竞争，必须提前准备降本工艺说明与原厂授权，否则面临废标风险！`
                        : isOverpriced
                        ? `当前仅下浮 ${currentDiscountRate}%，价格分预计仅得 ${currentEstimatedScore} 分，相比竞争对手将落后 ${(priceWeight - currentEstimatedScore).toFixed(1)} 分，需靠技术加分扳回。`
                        : `当前报价下浮 ${currentDiscountRate}%，在保证价格分拿到 ${currentEstimatedScore} 分的同时，为项目预留了健康的实施利润空间。`}
                    </div>
                  </div>
                </div>
              </div>

              {/* 三大出价推荐策略卡片 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheckIcon className="h-4 w-4 text-primary" />
                    <span>AI 推荐三大梯度出价策略</span>
                  </h4>
                  {!isPlatinum && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <LockClosedIcon className="h-3 w-3" />
                      白金/企业版专属深度测算
                    </span>
                  )}
                </div>

                <div className={`grid grid-cols-1 gap-3.5 sm:grid-cols-3 ${!isPlatinum ? "relative" : ""}`}>
                  {/* 1. 进攻型 */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          {data.recommendedStrategies.aggressive.name}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 tnum">
                          下浮 {data.recommendedStrategies.aggressive.discountRate}%
                        </span>
                      </div>
                      <div className="text-xl font-bold text-slate-900 tnum">
                        ¥{data.recommendedStrategies.aggressive.quoteWan.toLocaleString("zh-CN")}{" "}
                        <span className="text-xs font-normal text-slate-500">万元</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {data.recommendedStrategies.aggressive.rationale}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSimQuote(data.recommendedStrategies.aggressive.quoteWan)}
                      className="w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      应用此出价测算
                    </button>
                  </div>

                  {/* 2. 稳健型 */}
                  <div className="rounded-xl border-2 border-primary bg-blue-50/40 p-4 flex flex-col justify-between space-y-3 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                          🌟 {data.recommendedStrategies.balanced.name}
                        </span>
                        <span className="text-xs font-bold text-primary tnum">
                          下浮 {data.recommendedStrategies.balanced.discountRate}%
                        </span>
                      </div>
                      <div className="text-xl font-bold text-slate-900 tnum">
                        ¥{data.recommendedStrategies.balanced.quoteWan.toLocaleString("zh-CN")}{" "}
                        <span className="text-xs font-normal text-slate-500">万元</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {data.recommendedStrategies.balanced.rationale}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSimQuote(data.recommendedStrategies.balanced.quoteWan)}
                      className="w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-white hover:bg-primary-strong transition-colors cursor-pointer"
                    >
                      应用推荐平衡价
                    </button>
                  </div>

                  {/* 3. 防御型 */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                          {data.recommendedStrategies.conservative.name}
                        </span>
                        <span className="text-xs font-bold text-indigo-700 tnum">
                          下浮 {data.recommendedStrategies.conservative.discountRate}%
                        </span>
                      </div>
                      <div className="text-xl font-bold text-slate-900 tnum">
                        ¥{data.recommendedStrategies.conservative.quoteWan.toLocaleString("zh-CN")}{" "}
                        <span className="text-xs font-normal text-slate-500">万元</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {data.recommendedStrategies.conservative.rationale}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSimQuote(data.recommendedStrategies.conservative.quoteWan)}
                      className="w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      应用高毛利价
                    </button>
                  </div>

                  {/* 免费版遮罩 */}
                  {!isPlatinum && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/70 backdrop-blur-xs p-6 text-center">
                      <LockClosedIcon className="h-8 w-8 text-primary" />
                      <div className="mt-2 text-sm font-bold text-slate-900">
                        三档出价推演为【白金版 / 企业定制版】专属特权
                      </div>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm">
                        升级后即可查看进攻型、稳健型与防御型精算数值，并自动导出报价博弈报告。
                      </p>
                      <Link
                        href="/pricing"
                        className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-strong shadow-xs"
                      >
                        立即升级解锁特权
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <PrinterIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>打印出价决策单</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            完成决策返回
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 标讯详情页独立触发按钮
 */
export function TenderPricingCompassButton({
  tenderId,
}: {
  tenderId: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-primary hover:bg-blue-100 transition-colors shadow-2xs"
        title="测算该项目采购人历史成交下浮率与最佳报价博弈策略"
      >
        <ScaleIcon className="w-3.5 h-3.5 text-primary" />
        <span>出价博弈罗盘</span>
      </button>

      <BiddingPricingCompassModal
        tenderId={tenderId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
