"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  TrophyIcon,
  SparklesIcon,
  CheckCircleIcon,
  CheckIcon,
  AlertCircleIcon,
  XMarkIcon,
  ClipboardIcon,
  BuildingIcon,
  ArrowRightIcon,
} from "@/components/icons";
import { getMatchedCasesForTenderAction } from "@/app/actions/case";
import {
  type TenderCaseMatchAnalysis,
  type CaseMatchResult,
} from "@/lib/case-matching";

interface Props {
  tenderId: number;
}

export function TenderCaseMatchButton({ tenderId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-colors print:hidden shadow-2xs"
        title="根据本标讯预算与行业品目，自动从企业案例库中智能匹配类似项目业绩加分项"
      >
        <TrophyIcon className="h-3.5 w-3.5 text-amber-600" />
        <span>业绩匹配</span>
      </button>

      <TenderCaseMatchModal
        tenderId={tenderId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

export default function TenderCaseMatchModal({
  tenderId,
  isOpen,
  onClose,
}: {
  tenderId: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<TenderCaseMatchAnalysis | null>(null);
  const [companyName, setCompanyName] = useState<string>("我司");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    startTransition(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getMatchedCasesForTenderAction({ tenderId });
        if (!active) return;
        if (res.success && res.data) {
          setData(res.data);
          if (res.companyName) setCompanyName(res.companyName);
        } else {
          setError(res.error || "获取类似业绩匹配数据失败");
        }
      } catch (err) {
        console.error("Failed to load matched cases:", err);
        if (active) setError("连接服务器超时，请稍后重试");
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [tenderId, isOpen]);

  if (!isOpen) return null;

  const handleCopySummaryTable = () => {
    if (!data || data.bestMatchedCases.length === 0) return;
    let md = "| 序号 | 类似业绩项目名称 | 业主/客户单位 | 合同金额 | 签署日期 | 验收完备度 | 匹配评分 |\n";
    md += "| --- | --- | --- | --- | --- | --- | --- |\n";
    data.bestMatchedCases.forEach((item, idx) => {
      md += `| ${idx + 1} | ${item.caseItem.title} | ${item.caseItem.clientName} | ${item.caseItem.amountWan}万元 | ${item.caseItem.signDate} | ${item.caseItem.hasAcceptanceDoc ? "具备验收单" : "原件"} | ${item.matchScore}分 (${item.matchLevelLabel}) |\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 via-white to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
              <TrophyIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  类似项目业绩证明智能匹配罗盘
                </h3>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  <SparklesIcon className="h-3 w-3" />
                  评标加分项自动筛选
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {companyName} · {data ? `${data.tenderTitle}` : "正在多维核算企业业绩匹配度..."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 顶部统计卡 */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-amber-50/40 border-b border-amber-100 text-xs">
            <div>
              <span className="text-slate-500">企业在库业绩:</span>{" "}
              <span className="font-bold text-slate-900">{data.summary.totalCasesCount} 项</span>
            </div>
            <div>
              <span className="text-slate-500">3年时效合规:</span>{" "}
              <span className="font-bold text-emerald-700">{data.summary.validThreeYearsCount} 项</span>
            </div>
            <div>
              <span className="text-slate-500">首选黄金案例:</span>{" "}
              <span className="font-bold text-amber-700">{data.summary.topMatchCount} 项</span>
            </div>
            <div>
              <span className="text-slate-500">预估业绩加分:</span>{" "}
              <span className="font-bold text-blue-700 font-mono">+{data.summary.estimatedBonusPoints} 分</span>
            </div>
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-amber-600 border-r-transparent" />
              <p className="text-sm font-medium text-slate-600 mt-3">
                正在深度核验合同签署时效、金额门槛与品目语义相似度...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              <AlertCircleIcon className="h-6 w-6 text-red-500 mx-auto mb-2" />
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {data.bestMatchedCases.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <TrophyIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">案例库中暂无录入业绩合同</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    前往企业业绩资产库录入历史签约合同，即可在此一键匹配类似项目加分证明。
                  </p>
                  <Link
                    href="/cases"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    <span>录入企业业绩合同 →</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.bestMatchedCases.map((match: CaseMatchResult) => {
                    const c = match.caseItem;
                    return (
                      <div
                        key={c.id}
                        className={`rounded-xl border p-4 shadow-2xs transition ${
                          match.matchLevel === "TOP_MATCH"
                            ? "border-amber-200 bg-amber-50/20"
                            : match.matchLevel === "RECOMMENDED"
                            ? "border-blue-200 bg-blue-50/20"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                                  match.matchLevel === "TOP_MATCH"
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : match.matchLevel === "RECOMMENDED"
                                    ? "bg-blue-100 text-primary border border-blue-300"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {match.matchLevelLabel}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900">
                                {c.title}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                <BuildingIcon className="h-3 w-3" />
                                {c.clientName}
                              </span>
                              <span>·</span>
                              <span>签署于 {c.signDate}</span>
                              <span>·</span>
                              <span>{c.industryLabel}</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-slate-400">匹配总得分</div>
                            <div className="text-xl font-bold font-mono text-amber-600">
                              {match.matchScore}
                              <span className="text-xs font-normal text-slate-500"> / 100</span>
                            </div>
                          </div>
                        </div>

                        {/* 金额与亮点分析 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs mb-2.5">
                          <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                            <span className="text-slate-400">合同体量:</span>{" "}
                            <span className="font-bold text-slate-800 font-mono">{c.amountWan} 万元</span>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                            <span className="text-slate-400">时效合规:</span>{" "}
                            <span className={`font-semibold ${c.isOverdueThreeYears ? "text-rose-600" : "text-emerald-700"}`}>
                              {c.isOverdueThreeYears ? "超 3 年时效" : "近 3 年内有效"}
                            </span>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                            <span className="text-slate-400">验收凭据:</span>{" "}
                            <span className={`font-semibold ${c.hasAcceptanceDoc ? "text-emerald-700" : "text-slate-500"}`}>
                              {c.hasAcceptanceDoc ? "具备完工单/好评信" : "仅合同"}
                            </span>
                          </div>
                        </div>

                        {/* 契合优势与风险警示 */}
                        <div className="space-y-1 text-xs">
                          {match.matchReasons.map((r, rIdx) => (
                            <div key={rIdx} className="flex items-start gap-1.5 text-emerald-700">
                              <CheckCircleIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span>{r}</span>
                            </div>
                          ))}
                          {match.riskWarnings.map((w, wIdx) => (
                            <div key={wIdx} className="flex items-start gap-1.5 text-rose-600 font-medium">
                              <AlertCircleIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部操作条 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-slate-100 bg-slate-50/90 text-xs">
          <div className="flex items-center gap-2">
            <Link
              href="/cases"
              className="text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1"
            >
              <span>进入企业业绩资产库维护</span>
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummaryTable}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">已复制一览表 Markdown</span>
                </>
              ) : (
                <>
                  <ClipboardIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>复制《业绩汇总一览表》</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 font-semibold text-white hover:bg-indigo-500 transition shadow-2xs"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
