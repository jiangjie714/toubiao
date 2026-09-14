"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ScaleIcon,
  ClockIcon,
  BuildingIcon,
  TrashIcon,
  PlusIcon,
  BookmarkIcon,
  PrinterIcon,
  SparklesIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import {
  type TenderCompareResult,
} from "@/lib/tender-compare";
import {
  searchTendersForCompareAction,
  type TenderCandidate,
} from "@/app/actions/tender-compare";
import { saveTenderFollowAction } from "@/app/actions/tender-follow";
import { tenderTypeLabel, tenderTypeColor } from "@/lib/constants";

interface Props {
  initialData: TenderCompareResult;
  initialIds: number[];
}

export default function TenderCompareView({ initialData, initialIds }: Props) {
  const [data] = useState<TenderCompareResult>(initialData);
  const [activeIds, setActiveIds] = useState<number[]>(initialIds);
  const router = useRouter();

  // 搜索添加标段状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TenderCandidate[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [showSearchBox, setShowSearchBox] = useState(false);

  // 跟进看板加入状态
  const [followedMap, setFollowedMap] = useState<Record<number, boolean>>({});
  const [, startFollow] = useTransition();

  const tenders = data.tenders || [];

  const handleRemoveTender = (id: number) => {
    const nextIds = activeIds.filter((tid) => tid !== id);
    setActiveIds(nextIds);
    if (nextIds.length === 0) {
      router.push("/list");
    } else {
      router.push(`/tenders/compare?ids=${nextIds.join(",")}`);
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    startSearch(async () => {
      const res = await searchTendersForCompareAction(query);
      if (res.success && res.data) {
        setSearchResults(res.data.filter((d) => !activeIds.includes(d.id)));
      }
    });
  };

  const handleAddCandidate = (cand: TenderCandidate) => {
    if (activeIds.length >= data.maxAllowed) {
      alert(`当前最多支持同时对比 ${data.maxAllowed} 个标段。`);
      return;
    }
    const nextIds = [...activeIds, cand.id];
    setActiveIds(nextIds);
    setShowSearchBox(false);
    setSearchQuery("");
    setSearchResults([]);
    router.push(`/tenders/compare?ids=${nextIds.join(",")}`);
  };

  const handleToggleFollow = (tenderId: number) => {
    startFollow(async () => {
      const res = await saveTenderFollowAction({
        tenderId,
        status: "EVALUATING",
        notes: "从多标决策对比罗盘快速加入评估",
      });
      if (res.success) {
        setFollowedMap((prev) => ({ ...prev, [tenderId]: true }));
      } else {
        alert(res.error || "加入看板失败");
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // 渲染星级组件
  const renderStars = (count: number) => {
    return (
      <div className="flex items-center gap-0.5 text-amber-500">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < count ? "text-amber-500" : "text-slate-200"}>
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 顶栏操作与标题 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <ScaleIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  标讯商机多标横向决策对比罗盘
                </h1>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {tenders.length} 标段对比
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {data.planName}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                横向穿透商业体量、截标周期、发包金主偏好、评分办法与一票否决项，辅助决策团队精准选标
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          {/* 添加对比标段下拉 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSearchBox(!showSearchBox)}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <PlusIcon className="h-4 w-4 text-primary" />
              <span>添加比对标段</span>
            </button>

            {showSearchBox && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl z-50">
                <input
                  type="text"
                  placeholder="输入标段 ID 或标题关键词搜索..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-primary focus:outline-hidden"
                  autoFocus
                />
                <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pr-1">
                  {isSearching && (
                    <div className="py-4 text-center text-xs text-slate-400">正在搜索...</div>
                  )}
                  {!isSearching && searchResults.length === 0 && searchQuery.trim() && (
                    <div className="py-4 text-center text-xs text-slate-400">未找到相关标讯</div>
                  )}
                  {searchResults.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => handleAddCandidate(cand)}
                      className="w-full text-left cursor-pointer rounded-xl p-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-900 truncate block">
                          {cand.title}
                        </span>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{tenderTypeLabel(cand.type)}</span>
                          {cand.budgetAmount && (
                            <span className="text-primary font-medium">{cand.budgetAmount} 万元</span>
                          )}
                          <span>{cand.publishDate}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-primary shrink-0">+ 加入</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 打印评审单 */}
          <button
            type="button"
            onClick={handlePrint}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 transition-colors"
          >
            <PrinterIcon className="h-4 w-4 text-slate-500" />
            <span>打印立项评审单</span>
          </button>

          <Link
            href="/list"
            className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            返回列表
          </Link>
        </div>
      </div>

      {/* AI 横向比对汇总与决策导向建议卡片 */}
      {data.comparativeSummary && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white">
              <SparklesIcon className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">
              AI 多标横向决策透视与战略立项建议
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {data.comparativeSummary.strategicAdvice}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2.5 border-t border-blue-100 text-xs">
            <div className="rounded-lg bg-white/80 p-2 border border-blue-100">
              <span className="text-slate-500 text-[11px]">最高预算商机</span>
              <p className="mt-0.5 font-bold text-primary truncate">
                {tenders.find((t) => t.id === data.comparativeSummary?.highestBudgetId)?.title || "-"}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-2 border border-blue-100">
              <span className="text-slate-500 text-[11px]">最迫切截标节点</span>
              <p className="mt-0.5 font-bold text-rose-600 truncate">
                {tenders.find((t) => t.id === data.comparativeSummary?.mostUrgentId)?.title || "-"}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-2 border border-blue-100">
              <span className="text-slate-500 text-[11px]">最开放发包金主</span>
              <p className="mt-0.5 font-bold text-emerald-600 truncate">
                {tenders.find((t) => t.id === data.comparativeSummary?.bestOpennessId)?.purchaser || "-"}
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-2 border border-blue-100">
              <span className="text-slate-500 text-[11px]">首选重点主攻标段</span>
              <p className="mt-0.5 font-bold text-indigo-700 truncate">
                {tenders.find((t) => t.id === data.comparativeSummary?.topRecommendedId)?.title || "-"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 核心多标对比矩阵主体表格 */}
      {tenders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ScaleIcon className="mx-auto h-10 w-10 text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-700">暂无对比标段</p>
          <p className="mt-1 text-xs text-slate-500">
            请前往信息检索列表勾选标段，或在右上角搜索添加标段进行对比
          </p>
          <Link
            href="/list"
            className="mt-4 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs"
          >
            前往检索列表
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="w-44 p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  评审与对比维度
                </th>
                {tenders.map((t) => (
                  <th key={t.id} className="p-4 align-top w-72 max-w-xs border-l border-slate-200">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-bold ring-1 ring-inset ${tenderTypeColor(
                            t.type
                          )}`}
                        >
                          {tenderTypeLabel(t.type)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTender(t.id)}
                          title="从对比中移除"
                          className="cursor-pointer text-slate-400 hover:text-rose-600 p-0.5 print:hidden"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <Link
                        href={`/tender/${t.id}`}
                        target="_blank"
                        className="font-bold text-sm text-slate-900 hover:text-primary leading-snug line-clamp-2 block transition-colors"
                        title={t.title}
                      >
                        {t.title}
                      </Link>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-base font-extrabold text-primary tnum">
                          {t.budgetAmount ? `${t.budgetAmount} 万元` : "未标明预算"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleFollow(t.id)}
                          className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors print:hidden ${
                            followedMap[t.id]
                              ? "bg-blue-100 text-primary"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <BookmarkIcon className="h-3 w-3" />
                          <span>{followedMap[t.id] ? "已在看板" : "加入看板"}</span>
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {/* 1. 🎯 AI 选标综合决策与立项建议 */}
              <tr className="bg-blue-50/20">
                <td className="p-4 font-bold text-slate-900 align-top">
                  <div className="flex items-center gap-1.5 text-primary">
                    <SparklesIcon className="h-4 w-4" />
                    <span>AI 决策矩阵与立项建议</span>
                  </div>
                </td>
                {tenders.map((t) => {
                  const score = t.decisionScores;
                  const isMust = score.recommendLevel === "MUST_TARGET";
                  const isLow = score.recommendLevel === "LOW_PRIORITY";
                  return (
                    <td key={t.id} className="p-4 align-top border-l border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                            isMust
                              ? "bg-emerald-100 text-emerald-800"
                              : isLow
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isMust ? "🌟 重点主攻" : isLow ? "⚠️ 审慎弃标" : "📝 择机跟进"}
                        </span>
                        <span className="font-extrabold text-sm tnum text-slate-900">
                          {score.overallRecommendScore} 分
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">预算吸引力:</span>
                          {renderStars(score.budgetAttractiveness)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">周期宽裕度:</span>
                          {renderStars(score.preparationMargin)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">买方开放度:</span>
                          {renderStars(score.purchaserOpenness)}
                        </div>
                      </div>

                      <p className="mt-1 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 leading-relaxed">
                        {score.recommendReason}
                      </p>
                    </td>
                  );
                })}
              </tr>

              {/* 2. ⏱️ 截标与时间节奏 */}
              <tr>
                <td className="p-4 font-bold text-slate-900 align-top">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <ClockIcon className="h-4 w-4 text-slate-500" />
                    <span>截标倒计时与节点</span>
                  </div>
                </td>
                {tenders.map((t) => (
                  <td key={t.id} className="p-4 align-top border-l border-slate-100 space-y-1.5">
                    {t.deadlineCountdown ? (
                      <div>
                        {t.deadlineCountdown.isDeadlinePassed ? (
                          <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 font-medium">
                            已截标
                          </span>
                        ) : (
                          <div
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border ${t.deadlineCountdown.badgeColor}`}
                          >
                            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{t.deadlineCountdown.badgeLabel}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">未标明具体截标时间</span>
                    )}

                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                      <div>截止日期：{t.expireDate || "未注"}</div>
                      <div>发布日期：{t.publishDate}</div>
                    </div>
                  </td>
                ))}
              </tr>

              {/* 3. 🏛️ 发包单位金主与竞争画像 */}
              <tr>
                <td className="p-4 font-bold text-slate-900 align-top">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <BuildingIcon className="h-4 w-4 text-slate-500" />
                    <span>发包方画像与竞争偏好</span>
                  </div>
                </td>
                {tenders.map((t) => (
                  <td key={t.id} className="p-4 align-top border-l border-slate-100 space-y-2">
                    {t.purchaser ? (
                      <Link
                        href={`/purchasers/${encodeURIComponent(t.purchaser)}`}
                        target="_blank"
                        className="font-bold text-primary hover:underline flex items-center gap-1 leading-snug"
                      >
                        <span>{t.purchaser}</span>
                        <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-slate-400">未注发包单位</span>
                    )}

                    {t.purchaserInsight ? (
                      <div className="rounded-lg bg-slate-50 p-2 text-[11px] space-y-1 border border-slate-100">
                        <div className="flex justify-between text-slate-600">
                          <span>近期待统计发包:</span>
                          <span className="font-bold tnum text-slate-900">
                            {t.purchaserInsight.totalNotices} 笔
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>累计发包预算:</span>
                          <span className="font-bold tnum text-primary">
                            {t.purchaserInsight.totalBudgetWan} 万元
                          </span>
                        </div>
                        {t.purchaserInsight.topSupplier ? (
                          <div className="pt-1 border-t border-slate-200/80">
                            <span className="text-slate-500">首选供应商:</span>
                            <p className="font-medium text-slate-800 truncate" title={t.purchaserInsight.topSupplier.name}>
                              {t.purchaserInsight.topSupplier.name} ({t.purchaserInsight.topSupplier.count}次中标
                              {t.purchaserInsight.supplierConcentrationRate
                                ? `，占比${t.purchaserInsight.supplierConcentrationRate}%`
                                : ""}
                              )
                            </p>
                          </div>
                        ) : (
                          <div className="text-slate-400">中标分布相对分散</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">暂无该买方历史统计</div>
                    )}

                    {t.agency && (
                      <div className="text-[11px] text-slate-500 truncate">
                        代理机构: {t.agency}
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              {/* 4. ⚖️ 评分办法与权重结构 */}
              <tr>
                <td className="p-4 font-bold text-slate-900 align-top">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <ScaleIcon className="h-4 w-4 text-slate-500" />
                    <span>评标办法与权重结构</span>
                  </div>
                </td>
                {tenders.map((t) => (
                  <td key={t.id} className="p-4 align-top border-l border-slate-100 space-y-2">
                    <div className="font-semibold text-slate-900">
                      {t.scoring?.methodType || "综合评分法"}
                    </div>

                    {t.scoring?.weights && (
                      <div className="space-y-1.5">
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            style={{ width: `${t.scoring.weights.technical}%` }}
                            className="bg-blue-600"
                            title={`技术分: ${t.scoring.weights.technical}%`}
                          />
                          <div
                            style={{ width: `${t.scoring.weights.price}%` }}
                            className="bg-amber-500"
                            title={`价格分: ${t.scoring.weights.price}%`}
                          />
                          <div
                            style={{ width: `${t.scoring.weights.business}%` }}
                            className="bg-emerald-500"
                            title={`商务分: ${t.scoring.weights.business}%`}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="text-blue-700 font-medium">技术 {t.scoring.weights.technical}%</span>
                          <span className="text-amber-700 font-medium">价格 {t.scoring.weights.price}%</span>
                          <span className="text-emerald-700 font-medium">商务 {t.scoring.weights.business}%</span>
                        </div>
                      </div>
                    )}

                    {t.scoring?.keyPoints && t.scoring.keyPoints.length > 0 && (
                      <ul className="space-y-1 text-[11px] text-slate-600">
                        {t.scoring.keyPoints.slice(0, 3).map((kp, idx) => (
                          <li key={idx} className="line-clamp-1 truncate" title={kp}>
                            • {kp}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>

              {/* 5. 🚨 资格要求与一票否决红线 */}
              <tr>
                <td className="p-4 font-bold text-slate-900 align-top">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <ShieldCheckIcon className="h-4 w-4 text-rose-600" />
                    <span>资格要求与一票否决</span>
                  </div>
                </td>
                {tenders.map((t) => (
                  <td key={t.id} className="p-4 align-top border-l border-slate-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">官方附件:</span>
                      <span className="font-bold text-slate-800">
                        {t.attachmentsCount > 0 ? `${t.attachmentsCount} 个` : "无附件"}
                      </span>
                    </div>

                    {t.disqualifiedItems.length > 0 ? (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                          <AlertCircleIcon className="h-3.5 w-3.5" />
                          <span>一票否决与资格预警 ({t.disqualifiedItems.length})</span>
                        </span>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {t.disqualifiedItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg bg-rose-50/70 p-2 text-[11px] border border-rose-100"
                            >
                              <div className="font-bold text-rose-900 leading-snug">{item.clause}</div>
                              <p className="mt-0.5 text-rose-700 text-[10px] leading-tight">
                                {item.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800 font-medium">
                        ✓ 未检测到高危一票否决硬性排除条款
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              {/* 6. 🗺️ 地区赛道与所属项目 */}
              <tr>
                <td className="p-4 font-bold text-slate-900 align-top">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span>区域与全生命周期</span>
                  </div>
                </td>
                {tenders.map((t) => (
                  <td key={t.id} className="p-4 align-top border-l border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <div>地区：{t.provinceName ? `${t.provinceName} ${t.cityName || ""}` : "全国"}</div>
                    {t.industryName && <div>赛道：{t.industryName}</div>}
                    {t.projectNo && <div>项目编号：{t.projectNo}</div>}
                    {t.projectId ? (
                      <Link
                        href={`/projects/${t.projectId}`}
                        target="_blank"
                        className="font-semibold text-primary hover:underline block pt-1"
                      >
                        查看关联生命周期 ({t.projectNoticeCount} 篇公告) →
                      </Link>
                    ) : (
                      <span className="text-slate-400">单体独立公告</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 打印专用签字决标栏 (仅打印时展示) */}
      <div className="hidden print:block pt-8 border-t border-slate-300 text-xs">
        <h4 className="font-bold text-sm text-slate-900 mb-4">立项决策评审签字记录</h4>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <span className="text-slate-500">销售负责人意见：</span>
            <div className="h-16 border-b border-dashed border-slate-400 mt-2" />
          </div>
          <div>
            <span className="text-slate-500">技术/方案负责人意见：</span>
            <div className="h-16 border-b border-dashed border-slate-400 mt-2" />
          </div>
          <div>
            <span className="text-slate-500">公司管理层立项决标：</span>
            <div className="h-16 border-b border-dashed border-slate-400 mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
