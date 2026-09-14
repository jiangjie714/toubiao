"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  TrophyIcon,
  ScaleIcon,
  SparklesIcon,
  AlertCircleIcon,
  CheckIcon,
  XMarkIcon,
  ClipboardIcon,
  ArrowRightIcon,
} from "@/components/icons";
import {
  getWarRoomDetailAction,
  saveProjectEvaluationAction,
  generateDossierAction,
} from "@/app/actions/war-room";
import {
  calculateGoNoGoDecision,
  DECISION_META,
  type WarRoomDetailData,
} from "@/lib/war-room-manager";
import { addFollowCommentAction, type CommentCategory } from "@/app/actions/tender-follow";

interface Props {
  followId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function BidWarRoomModal({ followId, isOpen, onClose, onSaved }: Props) {
  const [data, setData] = useState<WarRoomDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"review" | "assets" | "comments" | "dossier">("review");

  // 立项评审打分状态
  const [marketScore, setMarketScore] = useState(80);
  const [techScore, setTechScore] = useState(80);
  const [commercialScore, setCommercialScore] = useState(80);
  const [financialScore, setFinancialScore] = useState(80);
  const [decisionReason, setDecisionReason] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [leadEvaluator, setLeadEvaluator] = useState("");

  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 协同讨论留言
  const [commentInput, setCommentInput] = useState("");
  const [commentCat, setCommentCat] = useState<CommentCategory>("GENERAL");
  const [commentPending, setCommentPending] = useState(false);

  // 公文复制
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const [, startTransition] = useTransition();

  // 实时推演 Go/No-Go 结论
  const currentCalculated = calculateGoNoGoDecision({
    marketScore,
    techScore,
    commercialScore,
    financialScore,
  });

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    startTransition(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getWarRoomDetailAction(followId);
        if (!active) return;
        if (res.success && res.data) {
          setData(res.data);
          const ev = res.data.evaluation;
          setMarketScore(ev.marketScore);
          setTechScore(ev.techScore);
          setCommercialScore(ev.commercialScore);
          setFinancialScore(ev.financialScore);
          setDecisionReason(ev.decisionReason || "");
          setRiskNotes(ev.riskNotes || "");
          setLeadEvaluator(ev.leadEvaluator || res.data.assignee || res.data.creatorName);
        } else {
          setError(res.error || "获取作战指挥室数据失败");
        }
      } catch (err) {
        console.error("Failed to fetch war room data:", err);
        if (active) setError("网络连接超时，请重试");
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [followId, isOpen]);

  if (!isOpen) return null;

  const handleSaveEvaluation = async () => {
    setSavingEvaluation(true);
    try {
      const res = await saveProjectEvaluationAction(followId, {
        marketScore,
        techScore,
        commercialScore,
        financialScore,
        decisionReason,
        riskNotes,
        leadEvaluator,
      });

      if (res.success && res.evaluation) {
        setSaveSuccess(true);
        if (data) {
          setData({
            ...data,
            evaluation: res.evaluation,
          });
        }
        if (onSaved) onSaved();
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        alert(res.error || "保存失败");
      }
    } finally {
      setSavingEvaluation(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentInput.trim()) return;
    setCommentPending(true);
    try {
      const res = await addFollowCommentAction({
        followId,
        content: commentInput.trim(),
        category: commentCat,
      });
      if (res.success) {
        setCommentInput("");
        // 重新拉取
        const fresh = await getWarRoomDetailAction(followId);
        if (fresh.success && fresh.data) setData(fresh.data);
      } else {
        alert(res.error || "发表失败");
      }
    } finally {
      setCommentPending(false);
    }
  };

  const handleCopyDossier = async (format: "markdown" | "html") => {
    const res = await generateDossierAction(followId, format);
    if (res.success && res.content) {
      navigator.clipboard.writeText(res.content).then(() => {
        if (format === "markdown") {
          setCopiedMd(true);
          setTimeout(() => setCopiedMd(false), 2000);
        } else {
          setCopiedHtml(true);
          setTimeout(() => setCopiedHtml(false), 2000);
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-surface rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* 头部：标题与项目基本面 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 shadow-sm">
              <SparklesIcon className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  投标项目协同作战指挥室 (War Room)
                </h3>
                {data && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border ${DECISION_META[data.evaluation.decision].badgeColor}`}
                  >
                    {DECISION_META[data.evaluation.decision].shortLabel} · {data.evaluation.overallScore}分
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                {data ? `${data.tenderTitle}` : "正在多维核算三流资产与立项决策..."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 导航 Tab 条 */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("review")}
            className={`cursor-pointer flex items-center gap-1.5 py-3 border-b-2 px-4 transition ${
              activeTab === "review"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>⚖️ Go/No-Go 立项评审决策</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`cursor-pointer flex items-center gap-1.5 py-3 border-b-2 px-4 transition ${
              activeTab === "assets"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🛡️ 三流合一资产体检</span>
            {data && (
              <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.2 text-2xs">
                资质+业绩+资金
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={`cursor-pointer flex items-center gap-1.5 py-3 border-b-2 px-4 transition ${
              activeTab === "comments"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>💬 团队协同批注与分派</span>
            {data && data.commentsCount > 0 && (
              <span className="rounded-full bg-slate-200 text-slate-700 px-1.5 py-0.2 text-2xs">
                {data.commentsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dossier")}
            className={`cursor-pointer flex items-center gap-1.5 py-3 border-b-2 px-4 transition ${
              activeTab === "dossier"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📄 立项决议公文导出</span>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-24 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-r-transparent" />
              <p className="text-xs font-medium text-slate-600 mt-3">
                正在深度调取资质库对标、业绩库加分与资金流占用数据...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircleIcon className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* TAB 1: Go/No-Go 立项评审决策 */}
              {activeTab === "review" && (
                <div className="space-y-6">
                  {/* 实时决策推演横幅 */}
                  <div
                    className={`rounded-2xl border p-5 transition-all shadow-xs ${
                      currentCalculated.hasFatalVeto
                        ? "border-rose-300 bg-rose-50/70"
                        : currentCalculated.decision === "GO"
                        ? "border-emerald-300 bg-emerald-50/70"
                        : "border-amber-300 bg-amber-50/70"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold border ${currentCalculated.decisionBadgeColor}`}
                          >
                            {currentCalculated.decisionLabel}
                          </span>
                          <span className="text-xs text-slate-500">
                            综合评分：
                            <strong className="text-base text-slate-900 font-mono">
                              {currentCalculated.overallScore}
                            </strong>{" "}
                            分
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-700">
                          {currentCalculated.advice}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveEvaluation}
                        disabled={savingEvaluation}
                        className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                      >
                        {savingEvaluation ? "正在保存..." : "保存立项决议"}
                      </button>
                    </div>

                    {saveSuccess && (
                      <div className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckIcon className="h-4 w-4 text-emerald-600" />
                        <span>立项决议已成功更新并归档至跟进看板！</span>
                      </div>
                    )}
                  </div>

                  {/* 4 维量化滑块评分矩阵 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. 市场与客户关系 (30%) */}
                    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          1. 市场与客户关系 (权重 30%)
                        </span>
                        <span className="font-mono text-sm font-bold text-blue-600">
                          {marketScore} 分
                        </span>
                      </div>
                      <p className="text-2xs text-slate-400">
                        考量：客户前期技术引导、客情深度、控标倾向、竞对壁垒
                      </p>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={marketScore}
                        onChange={(e) => setMarketScore(Number(e.target.value))}
                        className="w-full cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-2xs text-slate-400">
                        <span>0分 (严重排他控标)</span>
                        <span>60分及格</span>
                        <span>100分 (绝对优势)</span>
                      </div>
                    </div>

                    {/* 2. 技术方案与交付 (25%) */}
                    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          2. 技术方案与交付可行性 (权重 25%)
                        </span>
                        <span className="font-mono text-sm font-bold text-indigo-600">
                          {techScore} 分
                        </span>
                      </div>
                      <p className="text-2xs text-slate-400">
                        考量：技术参数响应偏离度、实施周期、技术团队资源保障
                      </p>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={techScore}
                        onChange={(e) => setTechScore(Number(e.target.value))}
                        className="w-full cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-2xs text-slate-400">
                        <span>0分 (技术不可达)</span>
                        <span>60分及格</span>
                        <span>100分 (完全胜任)</span>
                      </div>
                    </div>

                    {/* 3. 商务资质与类似业绩 (25%) */}
                    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          3. 商务资质与业绩满足度 (权重 25%)
                        </span>
                        <span className="font-mono text-sm font-bold text-purple-600">
                          {commercialScore} 分
                        </span>
                      </div>
                      <p className="text-2xs text-slate-400">
                        考量：ISO/CMMI资质齐备度、近3年类似项目业绩加分满足度
                      </p>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={commercialScore}
                        onChange={(e) => setCommercialScore(Number(e.target.value))}
                        className="w-full cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-2xs text-slate-400">
                        <span>0分 (资质一票否决)</span>
                        <span>60分及格</span>
                        <span>100分 (商务满分)</span>
                      </div>
                    </div>

                    {/* 4. 资金占用与回款风险 (20%) */}
                    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          4. 资金占用与回款风险 (权重 20%)
                        </span>
                        <span className="font-mono text-sm font-bold text-amber-600">
                          {financialScore} 分
                        </span>
                      </div>
                      <p className="text-2xs text-slate-400">
                        考量：投标保证金在途沉淀、项目垫资要求、财政付款周期
                      </p>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={financialScore}
                        onChange={(e) => setFinancialScore(Number(e.target.value))}
                        className="w-full cursor-pointer accent-amber-600"
                      />
                      <div className="flex justify-between text-2xs text-slate-400">
                        <span>0分 (垫资爆仓高危)</span>
                        <span>60分及格</span>
                        <span>100分 (现款现结)</span>
                      </div>
                    </div>
                  </div>

                  {/* 决策理由与风险防范输入 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        立项决策结论与核心理由 (将写入公文决议)
                      </label>
                      <textarea
                        rows={3}
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        placeholder="例如：该项目属于我司医疗信息化核心阵地，业主前期已认可方案，类似业绩加分项齐备，建议重点攻坚保中标。"
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        关键风险要点与应对防范预案
                      </label>
                      <textarea
                        rows={3}
                        value={riskNotes}
                        onChange={(e) => setRiskNotes(e.target.value)}
                        placeholder="例如：需在开标前加急办理 ISO27001 换发；要求销售跟进财政第一笔 30% 预付款到位节点；防止竞对通过参数提异议。"
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">牵头评审人 / 主持会签人:</span>
                        <input
                          type="text"
                          value={leadEvaluator}
                          onChange={(e) => setLeadEvaluator(e.target.value)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-slate-900 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveEvaluation}
                        disabled={savingEvaluation}
                        className="cursor-pointer rounded-xl bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                      >
                        {savingEvaluation ? "正在保存..." : "提交立项决议"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 三流合一资产体检 */}
              {activeTab === "assets" && (
                <div className="space-y-4">
                  {/* 1. 资质审查对标体检 */}
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white">
                          <ShieldCheckIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">
                            资质门槛与认证对标检查
                          </h4>
                          <span className="text-2xs text-slate-500">
                            已检测到标讯门槛要求 {data.qualificationOverview.totalRequired} 项
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${data.qualificationOverview.fitBadgeColor}`}
                      >
                        {data.qualificationOverview.fitLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-purple-100 text-xs">
                      <div>
                        <span className="text-slate-400 text-2xs">有效满足:</span>{" "}
                        <span className="font-bold text-emerald-700">
                          {data.qualificationOverview.matchedCount} 项
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-2xs">临期换证:</span>{" "}
                        <span className="font-bold text-amber-700">
                          {data.qualificationOverview.expiringCount} 项
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-2xs">逾期失效:</span>{" "}
                        <span className="font-bold text-rose-700">
                          {data.qualificationOverview.expiredCount} 项
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-2xs">缺项警告:</span>{" "}
                        <span className="font-bold text-rose-700">
                          {data.qualificationOverview.missingCount} 项
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <Link
                        href={`/tender/${data.tenderId}`}
                        className="text-2xs font-semibold text-purple-700 hover:underline"
                      >
                        查看详细资格初审报告与逐条条款对标 →
                      </Link>
                    </div>
                  </div>

                  {/* 2. 类似业绩支撑体检 */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
                          <TrophyIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">
                            类似项目业绩支撑与加分测算
                          </h4>
                          <span className="text-2xs text-slate-500">
                            企业归档签约业绩资产库多维精算
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                        预估加分 +{data.caseOverview.estimatedBonusPoints} 分
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-amber-100 text-xs">
                      <div>
                        <span className="text-slate-400 text-2xs">在库合格案例:</span>{" "}
                        <span className="font-bold text-slate-900">
                          {data.caseOverview.totalCasesCount} 项
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-2xs">3年时效合规:</span>{" "}
                        <span className="font-bold text-emerald-700">
                          {data.caseOverview.validThreeYearsCount} 项
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-2xs">首选黄金案例:</span>{" "}
                        <span className="font-bold text-amber-700">
                          {data.caseOverview.topMatchCount} 项
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <Link
                        href="/cases"
                        className="text-2xs font-semibold text-amber-700 hover:underline"
                      >
                        前往企业业绩案例库补充标杆合同与验收证书 →
                      </Link>
                    </div>
                  </div>

                  {/* 3. 投标保证金流转监控 */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                          <ScaleIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">
                            投标保证金资金沉淀与退还监控
                          </h4>
                          <span className="text-2xs text-slate-500">
                            法定 5 个工作日退还时效严控
                          </span>
                        </div>
                      </div>

                      {data.depositOverview.hasDeposit ? (
                        <span
                          className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${
                            data.depositOverview.isOverdueRisk
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-blue-100 text-blue-800 border-blue-300"
                          }`}
                        >
                          {data.depositOverview.statusLabel}
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-2xs text-slate-500">
                          未关联出账记录
                        </span>
                      )}
                    </div>

                    {data.depositOverview.hasDeposit ? (
                      <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-blue-100 text-xs">
                        <div>
                          <span className="text-slate-400 text-2xs">已缴存金额:</span>{" "}
                          <span className="font-mono font-bold text-slate-900">
                            ¥{data.depositOverview.amount}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-2xs">收款交易机构:</span>{" "}
                          <span className="font-medium text-slate-700 truncate max-w-[120px]">
                            {data.depositOverview.payeeName || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-2xs">法定应退截止:</span>{" "}
                          <span
                            className={`font-mono ${
                              data.depositOverview.isOverdueRisk
                                ? "font-bold text-rose-600"
                                : "text-slate-700"
                            }`}
                          >
                            {data.depositOverview.refundDeadline || "待开标确定"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                        <span>本项目尚未登记出账保证金台账</span>
                        <Link
                          href="/deposits"
                          className="font-bold text-blue-600 hover:underline"
                        >
                          立即录入保证金出账 →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: 团队协同讨论与批注 */}
              {activeTab === "comments" && (
                <div className="space-y-4">
                  {/* 发表讨论 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">发表团队协同研判意见</span>
                      <div className="flex items-center gap-1.5">
                        {(["GENERAL", "RISK", "COMPLIANCE", "ASSIGNMENT"] as CommentCategory[]).map(
                          (cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setCommentCat(cat)}
                              className={`cursor-pointer rounded px-2 py-0.5 text-2xs font-semibold transition ${
                                commentCat === cat
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {cat === "GENERAL" && "普通备忘"}
                              {cat === "RISK" && "风险预警"}
                              {cat === "COMPLIANCE" && "合规一票否决"}
                              {cat === "ASSIGNMENT" && "任务分派"}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="输入协同研讨意见、分派技术方案章节或商务风险批注..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                    />

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={handleAddComment}
                        disabled={commentPending || !commentInput.trim()}
                        className="cursor-pointer rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {commentPending ? "发送中..." : "发表批注"}
                      </button>
                    </div>
                  </div>

                  {/* 批注流展示 */}
                  <div className="space-y-2">
                    <h5 className="text-2xs font-bold uppercase text-slate-400 tracking-wider">
                      项目协同讨论历史
                    </h5>
                    {data.commentsCount === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">暂无协同批注记录</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        <p className="text-2xs text-slate-500">
                          共有 {data.commentsCount} 条跨部门协同记录，可前往看板右侧抽屉查看全部历史讨论。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: 立项决议公文导出 */}
              {activeTab === "dossier" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        《投标项目立项评审与投标决策书》标准公文
                      </h4>
                      <p className="text-2xs text-slate-500">
                        包含项目全景基本面、四维立项打分表、三流资产准备与部门会签审批栏
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyDossier("markdown")}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                      >
                        {copiedMd ? (
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ClipboardIcon className="h-3.5 w-3.5 text-slate-500" />
                        )}
                        <span>{copiedMd ? "已复制 Markdown" : "复制 MD 公文"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyDossier("html")}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                      >
                        {copiedHtml ? (
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ClipboardIcon className="h-3.5 w-3.5 text-blue-600" />
                        )}
                        <span>{copiedHtml ? "已复制 Word 表格" : "复制 Word 公文"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 公文预览框 */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 max-h-[350px] overflow-y-auto font-mono text-2xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {`# 投标项目立项评审与投标决策书\n> 生成时间：${data.generatedAt} | 主持评审人：${data.evaluation.leadEvaluator || data.assignee || "未指定"}\n\n## 一、项目基础信息\n- 项目名称：${data.tenderTitle}\n- 采购单位：${data.purchaser || "详见标书"}\n- 预算金额：${data.budgetAmount ? `${data.budgetAmount} 万元` : "未公开"}\n- 截标时间：${data.expireDate || "详见招标文件"} (距今约 ${data.daysToDeadline ?? "未知"} 天)\n\n## 二、四维立项量化评审结论\n- 市场与客户关系 (30%)：${data.evaluation.marketScore}分\n- 技术方案与交付 (25%)：${data.evaluation.techScore}分\n- 商务资质与业绩 (25%)：${data.evaluation.commercialScore}分\n- 资金与回款风险 (20%)：${data.evaluation.financialScore}分\n- 综合加权评分：${data.evaluation.overallScore}分\n- 最终立项决策结论：${data.evaluation.decisionLabel}\n\n## 三、三流合一资产配套支持\n- 资质审查：门槛 ${data.qualificationOverview.totalRequired} 项，满足 ${data.qualificationOverview.matchedCount} 项 (${data.qualificationOverview.fitLabel})\n- 类似业绩：在库有效业绩 ${data.caseOverview.validThreeYearsCount} 项，预计加分 +${data.caseOverview.estimatedBonusPoints} 分\n- 保证金安排：${data.depositOverview.hasDeposit ? `出账 ¥${data.depositOverview.amount} (${data.depositOverview.statusLabel})` : "待录入出账"}\n\n## 四、立项理由与风险防范预案\n${data.evaluation.decisionReason || "多部门联合评审，业务匹配，准予立项开展投标。"}\n\n会签人：${data.evaluation.leadEvaluator || "____________________"}  日期：${data.evaluation.evaluatedAt}`}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部导航 */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs">
          {data ? (
            <Link
              href={`/tender/${data.tenderId}`}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              <span>前往标讯详情页与全案应答编制</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
