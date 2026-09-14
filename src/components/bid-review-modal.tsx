"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  TrophyIcon,
  ScaleIcon,
  ClipboardIcon,
  CheckIcon,
  XMarkIcon,
  AlertCircleIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
} from "@/components/icons";
import {
  getProjectReviewDetailAction,
  saveProjectReviewAction,
  exportReviewReportAction,
} from "@/app/actions/review";
import {
  PRIMARY_CAUSES_META,
  COMMON_SECONDARY_TAGS,
  calculatePriceGapPercent,
  formatCurrencyWan,
  type PrimaryCauseType,
  type ReviewItemData,
  type ReviewOutcome,
} from "@/lib/review-manager";

interface Props {
  followId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function BidReviewModal({ followId, isOpen, onClose, onSaved }: Props) {
  const [data, setData] = useState<ReviewItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"form" | "report">("form");

  // 表单状态
  const [outcome, setOutcome] = useState<ReviewOutcome>("LOST");
  const [winningSupplier, setWinningSupplier] = useState("");
  const [winningAmount, setWinningAmount] = useState<string>("");
  const [myBidAmount, setMyBidAmount] = useState<string>("");
  const [ranking, setRanking] = useState<string>("");
  const [scoreGap, setScoreGap] = useState<string>("");
  const [primaryCause, setPrimaryCause] = useState<PrimaryCauseType>("PRICE");
  const [secondaryCauses, setSecondaryCauses] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [strengths, setStrengths] = useState("");
  const [shortcomings, setShortcomings] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [reviewer, setReviewer] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 报告预览与复制
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [copiedReport, setCopiedReport] = useState(false);

  const [, startTransition] = useTransition();

  // 实时价差计算
  const winningNum = winningAmount ? parseFloat(winningAmount) : null;
  const myBidNum = myBidAmount ? parseFloat(myBidAmount) : null;
  const priceGapInfo = calculatePriceGapPercent(myBidNum, winningNum);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      setSaveSuccess(false);

      const res = await getProjectReviewDetailAction(followId);
      if (!active) return;

      if (!res.success) {
        setError(res.error || "获取复盘详情失败");
      } else if (res.data) {
        const item = res.data;
        setData(item);
        setOutcome(item.outcome);
        setWinningSupplier(item.winningSupplier || "");
        setWinningAmount(item.winningAmount ? item.winningAmount.toString() : "");
        setMyBidAmount(item.myBidAmount ? item.myBidAmount.toString() : "");
        setRanking(item.ranking ? item.ranking.toString() : "");
        setScoreGap(item.scoreGap !== null && item.scoreGap !== undefined ? item.scoreGap.toString() : "");
        setPrimaryCause(item.primaryCause);
        setSecondaryCauses(item.secondaryCauses || []);
        setStrengths(item.strengths || "");
        setShortcomings(item.shortcomings || "");
        setActionItems(item.actionItems || "");
        setReviewer(item.reviewer || "");
      }
      setLoading(false);
    }

    loadData();
    return () => {
      active = false;
    };
  }, [followId, isOpen]);

  // 加载 Markdown 报告文本
  useEffect(() => {
    if (activeTab === "report" && followId) {
      exportReviewReportAction(followId).then((res) => {
        if (res.success && res.markdown) {
          setReportMarkdown(res.markdown);
        }
      });
    }
  }, [activeTab, followId]);

  if (!isOpen) return null;

  const handleToggleSecondaryTag = (tag: string) => {
    if (secondaryCauses.includes(tag)) {
      setSecondaryCauses(secondaryCauses.filter((t) => t !== tag));
    } else {
      setSecondaryCauses([...secondaryCauses, tag]);
    }
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!secondaryCauses.includes(trimmed)) {
      setSecondaryCauses([...secondaryCauses, trimmed]);
    }
    setCustomTagInput("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    const res = await saveProjectReviewAction({
      followId,
      outcome,
      winningSupplier: winningSupplier.trim() || undefined,
      winningAmount: winningNum && !isNaN(winningNum) ? winningNum : undefined,
      myBidAmount: myBidNum && !isNaN(myBidNum) ? myBidNum : undefined,
      ranking: ranking ? parseInt(ranking, 10) : undefined,
      scoreGap: scoreGap ? parseFloat(scoreGap) : undefined,
      primaryCause,
      secondaryCauses,
      strengths: strengths.trim() || undefined,
      shortcomings: shortcomings.trim() || undefined,
      actionItems: actionItems.trim() || undefined,
      reviewer: reviewer.trim() || undefined,
    });

    setSaving(false);
    if (!res.success) {
      setError(res.error || "保存复盘失败");
    } else {
      setSaveSuccess(true);
      startTransition(() => {
        onSaved?.();
      });
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    }
  };

  const handleCopyReport = async () => {
    if (!reportMarkdown) return;
    await navigator.clipboard.writeText(reportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!reportMarkdown) return;
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `投标复盘归因总结_${data?.projectInfo.title || "项目"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentCauseMeta = PRIMARY_CAUSES_META[primaryCause] || PRIMARY_CAUSES_META.OTHER;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl text-white ${outcome === "WON" ? "bg-emerald-600 shadow-emerald-200 shadow-sm" : "bg-primary shadow-primary/20 shadow-sm"}`}>
              <ScaleIcon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  投标复盘与胜败归因诊断
                </h2>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${outcome === "WON" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  {outcome === "WON" ? "中标复盘 (WON)" : "失标归因 (LOST)"}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 max-w-xl mt-0.5">
                {data?.projectInfo.title ? `项目：${data.projectInfo.title}` : "正在加载项目档案..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="inline-flex rounded-lg bg-slate-200/80 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`rounded-md px-3 py-1 transition-all ${
                  activeTab === "form"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                复盘归因录入
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("report")}
                className={`rounded-md px-3 py-1 transition-all flex items-center gap-1 ${
                  activeTab === "report"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <DocumentTextIcon className="size-3.5" />
                总结公文报告
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
              title="关闭"
            >
              <XMarkIcon className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm">正在加载复盘归因档案...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
              <AlertCircleIcon className="size-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : activeTab === "form" ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* 开标结果切换 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  1. 本次投标开标结果与成败判定
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setOutcome("WON")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${
                      outcome === "WON"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <TrophyIcon className={`size-4 ${outcome === "WON" ? "text-emerald-600" : "text-slate-400"}`} />
                    <span>中标落地 (WON)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome("LOST")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${
                      outcome === "LOST"
                        ? "border-rose-500 bg-rose-50 text-rose-900 shadow-xs ring-2 ring-rose-500/20"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <AlertCircleIcon className={`size-4 ${outcome === "LOST" ? "text-rose-600" : "text-slate-400"}`} />
                    <span>失标检讨 (LOST)</span>
                  </button>
                </div>
              </div>

              {/* 核心比对数据 */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ScaleIcon className="size-4 text-primary" />
                    2. 最终开标数据与价格对标
                  </h3>
                  {data?.projectInfo.budgetAmount && (
                    <span className="text-xs text-slate-500">
                      项目预算: <span className="font-semibold text-slate-700">{formatCurrencyWan(data.projectInfo.budgetAmount)}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      最终中标单位名称
                    </label>
                    <input
                      type="text"
                      value={winningSupplier}
                      onChange={(e) => setWinningSupplier(e.target.value)}
                      placeholder={outcome === "WON" ? "我方企业全称" : "例如: 某某中电信息科技有限公司"}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      复盘主持 / 主笔人
                    </label>
                    <input
                      type="text"
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                      placeholder="例如: 张工 (解决方案经理)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      最终中标成交金额 (元)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={winningAmount}
                      onChange={(e) => setWinningAmount(e.target.value)}
                      placeholder="例如: 1280000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary tnum"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      我方最终封标报价 (元)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={myBidAmount}
                      onChange={(e) => setMyBidAmount(e.target.value)}
                      placeholder="例如: 1350000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary tnum"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      综合评标得分排名 (选填)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={ranking}
                      onChange={(e) => setRanking(e.target.value)}
                      placeholder="例如: 2 (代表第二名)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      与第一名总分差 (分, 选填)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={scoreGap}
                      onChange={(e) => setScoreGap(e.target.value)}
                      placeholder="例如: 1.85 (以0分表示同分)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* 报价偏离度分析横幅 */}
                {winningNum && myBidNum ? (
                  <div className={`mt-3 flex items-center justify-between rounded-lg p-3 text-xs border ${
                    priceGapInfo.status === "higher"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : priceGapInfo.status === "lower"
                      ? "border-sky-200 bg-sky-50 text-sky-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}>
                    <div className="flex items-center gap-2 font-medium">
                      <ScaleIcon className="size-4" />
                      <span>价格偏离度精算: <strong>{priceGapInfo.text}</strong></span>
                      <span className="text-slate-500">
                        (绝对差额: {formatCurrencyWan(Math.abs(myBidNum - winningNum))})
                      </span>
                    </div>
                    <span className="font-semibold text-slate-600">
                      我方占中标额比: {((myBidNum / winningNum) * 100).toFixed(1)}%
                    </span>
                  </div>
                ) : null}
              </div>

              {/* 核心主因判定 (单选网格) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    3. 核心主因判定 (Primary Cause)
                  </h3>
                  <span className="text-xs text-slate-400">选择对最终成败起决定性作用的一项</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(Object.keys(PRIMARY_CAUSES_META) as PrimaryCauseType[]).map((code) => {
                    const meta = PRIMARY_CAUSES_META[code];
                    const isSelected = primaryCause === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setPrimaryCause(code)}
                        className={`text-left rounded-xl border p-3 transition-all ${
                          isSelected
                            ? `border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs`
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {meta.shortLabel}
                          </span>
                          <span className={`inline-block size-2 rounded-full ${isSelected ? "bg-primary" : "bg-slate-300"}`} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {meta.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* 选中因由的说明与专家锦囊 */}
                <div className={`rounded-xl border p-3 text-xs leading-relaxed ${currentCauseMeta.bgColor} ${currentCauseMeta.borderColor}`}>
                  <p className={`font-semibold ${currentCauseMeta.textColor} mb-1 flex items-center gap-1.5`}>
                    <AlertCircleIcon className="size-4" />
                    【{currentCauseMeta.shortLabel}】归因诊断与专家锦囊建议:
                  </p>
                  <p className="text-slate-700 mb-2">{currentCauseMeta.description}</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    {currentCauseMeta.defaultSuggestions.map((sug, i) => (
                      <li key={i}>{sug}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 次要诱因标签选择 */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    4. 次要诱因与失误标签 (多选)
                  </h3>
                  <span className="text-xs text-slate-400">勾选或补充具体失误细节</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {COMMON_SECONDARY_TAGS.map((tag) => {
                    const active = secondaryCauses.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleSecondaryTag(tag)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all ${
                          active
                            ? "bg-primary text-white font-medium shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                        }`}
                      >
                        {active && <CheckIcon className="size-3" />}
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    placeholder="输入自定义失误诱因标签按回车添加..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    添加标签
                  </button>
                </div>
              </div>

              {/* 经验亮点与检讨整改 (三段论) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  5. 实战经验沉淀与长效整改 (PDCA 复盘三段论)
                </h3>

                <div>
                  <label className="text-xs font-medium text-emerald-800 flex items-center gap-1.5 mb-1">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    亮点与优势沉淀 (Keep Doing - 值得发扬和沉淀的打法)
                  </label>
                  <textarea
                    rows={2}
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    placeholder="例如: 技术方案编写响应高效，现场述标对业主业务痛点理解深刻，获专家技术评分第一..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-rose-800 flex items-center gap-1.5 mb-1">
                    <span className="size-2 rounded-full bg-rose-500" />
                    短板与失误教训检讨 (Stop Doing - 本次掉入的误区/致命问题)
                  </label>
                  <textarea
                    rows={2}
                    value={shortcomings}
                    onChange={(e) => setShortcomings(e.target.value)}
                    placeholder="例如: 商务报价测算偏保守，低估了第二梯队竞对的降价决心；某子系统缺少针对性拓扑图..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-primary flex items-center gap-1.5 mb-1">
                    <span className="size-2 rounded-full bg-primary" />
                    长效防范整改措施 (Start Doing - 针对性落实与固化规则)
                  </label>
                  <textarea
                    rows={2}
                    value={actionItems}
                    onChange={(e) => setActionItems(e.target.value)}
                    placeholder="例如: 1. 建立区域同类项目报价区间库；2. 启动CMMI3级认证申报；3. 标书封标前增加一票否决双人交叉审核..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* 底部保存条 */}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs py-3 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 animate-in fade-in">
                      <CheckIcon className="size-4" />
                      复盘档案与归因已成功保存！
                    </span>
                  )}
                  {error && (
                    <span className="text-xs text-rose-600 line-clamp-1">{error}</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>正在保存...</span>
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="size-4" />
                        <span>保存归因复盘</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* 总结公文报告 Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    《投标项目开标复盘与胜败归因总结报告》公文预览
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    标准 Markdown 格式公文，可直接归档沉淀或同步企微/钉钉群与高管汇报
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    {copiedReport ? (
                      <>
                        <CheckIcon className="size-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">已复制</span>
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="size-3.5" />
                        <span>复制全文</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition"
                  >
                    <ArrowDownTrayIcon className="size-3.5" />
                    <span>下载 .md</span>
                  </button>
                </div>
              </div>

              {reportMarkdown ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                  {reportMarkdown}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-xs">正在根据最新复盘数据生成公文报告...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
