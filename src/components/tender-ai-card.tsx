"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  SparklesIcon,
  ShieldAlertIcon,
  ScaleIcon,
  DocumentTextIcon,
  LockClosedIcon,
  ClockIcon,
  TargetIcon,
  PrinterIcon,
} from "@/components/icons";
import {
  getTenderAiAnalysisAction,
  type AiAnalysisResponse,
} from "@/app/actions/ai-analysis";
import {
  runEnterpriseFitCheckAction,
  type FitCheckActionResponse,
} from "@/app/actions/fit-check";
import { CompanyProfileModal } from "@/components/company-profile-modal";
import TenderProposalCopilot from "@/components/tender-proposal-copilot";
import type {
  AiExecutiveSummary,
  AiRiskRadar,
  AiScoringMethod,
  AiTimelineAndKey,
} from "@/lib/ai/bid-reader";

interface TenderAiCardProps {
  tenderId: number;
}

type TabType = "summary" | "risk" | "scoring" | "timeline" | "fit" | "proposal";

export function TenderAiCard({ tenderId }: TenderAiCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [loading, setLoading] = useState<boolean>(true);
  const [res, setRes] = useState<AiAnalysisResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  // 资质匹配与赢面测算状态
  const [fitLoading, setFitLoading] = useState<boolean>(false);
  const [fitRes, setFitRes] = useState<FitCheckActionResponse | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleExecuteAi = (force = false) => {
    setLoading(true);
    startTransition(async () => {
      try {
        const response = await getTenderAiAnalysisAction(tenderId, { forceRefresh: force });
        setRes(response);
      } catch (e) {
        console.error("Failed to execute AI analysis", e);
      } finally {
        setLoading(false);
      }
    });
  };

  const loadFitCheck = async () => {
    setFitLoading(true);
    try {
      const response = await runEnterpriseFitCheckAction(tenderId);
      setFitRes(response);
    } catch (e) {
      console.error("Failed to load fit check", e);
    } finally {
      setFitLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    startTransition(async () => {
      try {
        const response = await getTenderAiAnalysisAction(tenderId);
        if (active) {
          setRes(response);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load AI analysis", e);
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [tenderId]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "fit" && !fitRes) {
      loadFitCheck();
    }
  };

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const data = res?.data;
  const execSummary = data?.executiveSummary as AiExecutiveSummary | undefined;
  const riskRadar = data?.riskRadar as AiRiskRadar | undefined;
  const scoring = data?.scoringMethod as AiScoringMethod | undefined;
  const timeline = data?.timelineAndKey as AiTimelineAndKey | undefined;

  const riskScore = riskRadar?.riskScore ?? 30;
  const riskBadge =
    riskScore >= 70
      ? { label: "高危预警", color: "bg-rose-50 text-rose-700 border-rose-200" }
      : riskScore >= 40
        ? { label: "中度风险", color: "bg-amber-50 text-amber-700 border-amber-200" }
        : { label: "合规良好", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-blue-200/90 bg-white shadow-xs transition-all duration-200 print:border-none print:shadow-none">
      {/* 顶部 AI 标识标头 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-slate-50/60 px-6 py-4 print:bg-white print:border-b-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-xs">
            <SparklesIcon className="h-4 w-4 animate-pulse" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                AI 智能标书速读 & 投标风险雷达
              </h3>
              <span className="rounded-md bg-blue-100/80 px-2 py-0.5 text-[11px] font-semibold text-primary print:hidden">
                PRO 商业专享
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {data?.modelUsed
                ? `由 ${data.modelUsed} 生成并持久缓存 · 10秒全景透视`
                : "毫秒级提取一票否决条款、评标权重与行动清单"}
            </p>
          </div>
        </div>

        {/* 顶部右侧：操作按钮与综合风险指数 */}
        <div className="flex items-center gap-2.5 print:hidden">
          {!loading && riskRadar && (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${riskBadge.color}`}
            >
              <ShieldAlertIcon className="h-3.5 w-3.5" />
              <span>风险指数: {riskScore}分</span>
              <span className="opacity-60">|</span>
              <span>{riskBadge.label}</span>
            </div>
          )}

          <button
            onClick={handlePrint}
            title="打印或导出 A4 投标决策简报"
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            <span>打印决策简报</span>
          </button>

          <button
            onClick={() => handleExecuteAi(Boolean(data))}
            disabled={loading || isPending}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong transition-all duration-150 disabled:opacity-50"
          >
            <SparklesIcon className={`h-3.5 w-3.5 ${loading || isPending ? "animate-spin" : ""}`} />
            {loading || isPending
              ? "正在智能速读..."
              : data
                ? "立即智能速读"
                : "立即智能速读"}
          </button>
        </div>
      </div>

      {/* 选项卡导航 */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 text-xs font-medium text-slate-600 print:hidden overflow-x-auto">
        <button
          onClick={() => handleTabChange("summary")}
          className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 transition-colors shrink-0 ${
            activeTab === "summary"
              ? "border-primary font-bold text-primary"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <DocumentTextIcon className="h-4 w-4" />
          一页纸速览
        </button>
        <button
          onClick={() => handleTabChange("risk")}
          className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 transition-colors shrink-0 ${
            activeTab === "risk"
              ? "border-primary font-bold text-primary"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <ShieldAlertIcon className="h-4 w-4" />
          废标与合规风险
          {riskRadar && riskRadar.disqualifiedItems.length > 0 && (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-600">
              {riskRadar.disqualifiedItems.length}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange("scoring")}
          className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 transition-colors shrink-0 ${
            activeTab === "scoring"
              ? "border-primary font-bold text-primary"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <ScaleIcon className="h-4 w-4" />
          评标办法穿透
        </button>
        <button
          onClick={() => handleTabChange("fit")}
          className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 transition-colors shrink-0 ${
            activeTab === "fit"
              ? "border-primary font-bold text-primary"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <TargetIcon className="h-4 w-4" />
          资质匹配与赢面测算
          <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
            白金专属
          </span>
        </button>
        <button
          onClick={() => handleTabChange("proposal")}
          className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 transition-colors shrink-0 ${
            activeTab === "proposal"
              ? "border-primary font-bold text-primary"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <SparklesIcon className="h-4 w-4 text-purple-600" />
          标书编制与合规应答
          <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[9px] font-bold text-purple-800">
            实战利器
          </span>
        </button>
        <button
          onClick={() => handleTabChange("timeline")}
          className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 transition-colors shrink-0 ${
            activeTab === "timeline"
              ? "border-primary font-bold text-primary"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <ClockIcon className="h-4 w-4" />
          备忘与清单
        </button>
      </div>

      {/* 主体内容区 */}
      <div className="relative p-6">
        {loading || isPending ? (
          <div className="space-y-3 py-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <div>
            {/* Tab 1: 一页纸速读 */}
            {activeTab === "summary" && execSummary && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50/50 p-4 border border-blue-100/70">
                  <h4 className="text-xs font-semibold tracking-wide text-blue-900 uppercase">
                    项目核心概况
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">
                    {execSummary.projectOverview}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
                    <span className="text-xs text-slate-500">采购单位</span>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      {execSummary.procuringEntity}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
                    <span className="text-xs text-slate-500">最高限价 / 预算</span>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 tnum">
                      {execSummary.budgetOrPrice}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
                    <span className="text-xs text-slate-500">工期与交付期限</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {execSummary.duration}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
                    <span className="text-xs text-slate-500">付款与结算条件</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {execSummary.paymentTerms}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3.5">
                  <span className="text-xs text-slate-500">采购范围与核心交付要求</span>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">
                    {execSummary.scopeOfWork}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: 废标与合规风险雷达 */}
            {activeTab === "risk" && riskRadar && (
              <div className="space-y-4">
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-rose-700 uppercase tracking-wide">
                    <ShieldAlertIcon className="h-4 w-4" />
                    一票否决 / 实质性废标门槛排查
                  </h4>
                  <div className="mt-2 space-y-2">
                    {riskRadar.disqualifiedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-lg border border-rose-100 bg-rose-50/50 p-3.5"
                      >
                        <span className="mt-0.5 shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {item.level === "CRITICAL" ? "一票否决" : "高危警示"}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-rose-950">
                            {item.clause}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-rose-800/80">
                            {item.explanation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {riskRadar.complianceAlerts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      合规核查警示
                    </h4>
                    <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {riskRadar.complianceAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-amber-100 bg-amber-50/40 p-3"
                        >
                          <span className="text-xs font-bold text-amber-900">
                            {alert.title}
                          </span>
                          <p className="mt-0.5 text-xs text-amber-800/90 leading-relaxed">
                            {alert.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 保证金 */}
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs">
                  <span className="font-semibold text-slate-800">投标保证金要求：</span>
                  <span className="ml-1 text-slate-700">
                    {riskRadar.depositAndFees.depositAmount ?? "免收或详见招标文件"}
                  </span>
                  <span className="ml-3 font-semibold text-slate-800">缴纳截点：</span>
                  <span className="ml-1 text-slate-700">
                    {riskRadar.depositAndFees.depositDeadline ?? "同投标截止时间"}
                  </span>
                </div>
              </div>
            )}

            {/* Tab 3: 评标办法穿透 */}
            {activeTab === "scoring" && scoring && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                  <div>
                    <span className="text-xs text-slate-500">评审方式</span>
                    <p className="text-sm font-bold text-slate-900">
                      {scoring.methodType}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1 text-blue-700">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      技术分: {scoring.weights.technical}%
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      商务分: {scoring.weights.business}%
                    </span>
                    <span className="flex items-center gap-1 text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-600" />
                      价格分: {scoring.weights.price}%
                    </span>
                  </div>
                </div>

                {/* 比例条形图 */}
                <div>
                  <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                    <div
                      style={{ width: `${scoring.weights.technical}%` }}
                      className="bg-blue-600 transition-all duration-300"
                      title={`技术分: ${scoring.weights.technical}%`}
                    />
                    <div
                      style={{ width: `${scoring.weights.business}%` }}
                      className="bg-emerald-500 transition-all duration-300"
                      title={`商务分: ${scoring.weights.business}%`}
                    />
                    <div
                      style={{ width: `${scoring.weights.price}%` }}
                      className="bg-amber-500 transition-all duration-300"
                      title={`价格分: ${scoring.weights.price}%`}
                    />
                  </div>
                </div>

                {/* 核心得分点 */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    核心得分点与评审策略
                  </h4>
                  {scoring.keyScoringPoints.map((pt, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-2xs"
                    >
                      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {pt.category}
                      </span>
                      <p className="text-xs leading-relaxed text-slate-600">
                        {pt.focus}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: 资质匹配与赢面测算 (Phase 2 新增) */}
            {activeTab === "fit" && (
              <div className="space-y-4">
                {fitLoading ? (
                  <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                    <SparklesIcon className="h-6 w-6 text-primary mx-auto animate-spin" />
                    <p>AI 正在对照您的企业资质档案与标段要求进行智能测算...</p>
                  </div>
                ) : fitRes?.isLocked ? (
                  <div className="py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 mx-auto mb-3">
                      <LockClosedIcon className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      升级白金会员解锁「企业赢面自检」
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      {fitRes.lockReason}
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong"
                    >
                      升级至白金会员
                    </Link>
                  </div>
                ) : !fitRes?.hasProfile ? (
                  <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-6 text-center">
                    <TargetIcon className="h-8 w-8 text-primary mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-900">
                      尚未录入您的企业资质画像
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto">
                      录入企业名称、注册资本、ISO认证与类似代表案例后，AI 将自动预测该项目的胜率与优势短板！
                    </p>
                    <button
                      onClick={() => setIsProfileModalOpen(true)}
                      className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-strong transition-colors"
                    >
                      + 录入企业资质画像
                    </button>
                  </div>
                ) : (
                  fitRes?.result && (
                    <div className="space-y-4">
                      {/* 胜率大看板 */}
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 p-4">
                        <div>
                          <span className="text-xs text-slate-500">企业画像：{fitRes.profile?.companyName}</span>
                          <div className="flex items-center gap-3 mt-1">
                            <h3 className="text-2xl font-black text-slate-900 tnum">
                              {fitRes.result.winRateScore}
                              <span className="text-xs font-normal text-slate-500 ml-1">/ 100 分</span>
                            </h3>
                            <span
                              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                                fitRes.result.verdictLevel === "HIGH"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : fitRes.result.verdictLevel === "MEDIUM"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {fitRes.result.verdict}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className="cursor-pointer text-xs text-primary hover:underline"
                          >
                            ✏️ 修改资质档案
                          </button>
                          <button
                            onClick={loadFitCheck}
                            className="cursor-pointer rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
                          >
                            🔄 重新测算
                          </button>
                        </div>
                      </div>

                      {/* 三维打分条 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>资质硬指标符合度</span>
                            <span className="font-semibold text-slate-800">{fitRes.result.dimensionScores.qualification}分</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${fitRes.result.dimensionScores.qualification}%` }}
                              className="h-full bg-primary"
                            />
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>同类业绩丰富度</span>
                            <span className="font-semibold text-slate-800">{fitRes.result.dimensionScores.performance}分</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${fitRes.result.dimensionScores.performance}%` }}
                              className="h-full bg-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>抗风险与履约资金力</span>
                            <span className="font-semibold text-slate-800">{fitRes.result.dimensionScores.capitalStrength}分</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${fitRes.result.dimensionScores.capitalStrength}%` }}
                              className="h-full bg-amber-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 优势点 */}
                      {fitRes.result.strengths.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                            🎯 核心胜算优势点
                          </h5>
                          <ul className="mt-1.5 space-y-1.5 text-xs text-slate-700">
                            {fitRes.result.strengths.map((s, idx) => (
                              <li key={idx} className="flex items-start gap-2 rounded bg-emerald-50/50 p-2 border border-emerald-100/60">
                                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 短板与失分项 */}
                      {fitRes.result.risksAndGaps.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                            ⚠️ 潜在失分短板与缺漏
                          </h5>
                          <ul className="mt-1.5 space-y-1.5 text-xs text-slate-700">
                            {fitRes.result.risksAndGaps.map((r, idx) => (
                              <li key={idx} className="flex items-start gap-2 rounded bg-amber-50/50 p-2 border border-amber-100/60">
                                <span className="text-amber-600 font-bold shrink-0">!</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 投标攻坚策略建议 */}
                      {fitRes.result.actionAdvice.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-xs">
                          <h5 className="font-bold text-slate-900 mb-1.5">
                            💡 AI 投标攻坚策略建议
                          </h5>
                          <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                            {fitRes.result.actionAdvice.map((adv, idx) => (
                              <li key={idx}>{adv}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Tab 5: 备忘与清单 */}
            {activeTab === "timeline" && timeline && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <span className="text-xs text-slate-500">投标递交截止</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800 tnum">
                      {timeline.bidDeadline ?? "详见公告正文"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <span className="text-xs text-slate-500">开标评审时间</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800 tnum">
                      {timeline.bidOpeningTime ?? "与截止时间一致"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <span className="text-xs text-slate-500">文件获取/答疑截止</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800 tnum">
                      {timeline.docObtainDeadline ?? "公告指定时间"}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    投标关键事项自查备忘清单
                  </h4>
                  <div className="mt-2 space-y-2">
                    {timeline.keyChecklist.map((task, idx) => (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                          checkedItems[idx]
                            ? "border-emerald-200 bg-emerald-50/40 text-slate-500 line-through"
                            : "border-slate-100 bg-white hover:bg-slate-50/60 text-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(checkedItems[idx])}
                          onChange={() => toggleCheck(idx)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-medium">{task}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 6: 标书编制与点对点合规应答矩阵 */}
            {activeTab === "proposal" && (
              <div className="pt-2">
                <TenderProposalCopilot tenderId={tenderId} />
              </div>
            )}
          </div>
        )}

        {/* 商业化锁定遮罩 (Monetization Gate Overlay) */}
        {!loading && res?.isLocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-b-xl bg-white/80 p-6 backdrop-blur-xs text-center print:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-xs mb-3">
              <LockClosedIcon className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              升级会员解锁 AI 标书速读与风险雷达
            </h4>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
              {res.lockReason || "免费版仅提供部分试看内容。开通黄金版或白金版套餐，即可享受一票否决条款透视、评分权重分析与全自动备忘清单。"}
            </p>
            <div className="mt-4 flex items-center gap-3">
              {!res.authenticated ? (
                <Link
                  href={`/login?next=/tender/${tenderId}`}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong transition-colors"
                >
                  立即登录
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong transition-colors"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  查看会员套餐并升级
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 企业画像维护弹窗 */}
      <CompanyProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialData={fitRes?.profile}
        onSaved={loadFitCheck}
      />
    </div>
  );
}
