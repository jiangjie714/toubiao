"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  SparklesIcon,
  CheckCircleIcon,
  CheckIcon,
  AlertCircleIcon,
  XMarkIcon,
  ClipboardIcon,
  BuildingIcon,
  ArrowRightIcon,
  LockClosedIcon,
} from "@/components/icons";
import { getTenderQualificationMatchAction } from "@/app/actions/qualification";
import {
  generateQualificationSummaryTable,
  type TenderQualificationMatchAnalysis,
  type CompanyQualificationItem,
} from "@/lib/qualification-manager";

interface Props {
  tenderId: number;
}

export function TenderQualificationMatchButton({ tenderId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors print:hidden shadow-2xs"
        title="根据本标讯资质与认证门槛，自动对标企业在库资质证书与临期废标排查"
      >
        <ShieldCheckIcon className="h-3.5 w-3.5 text-purple-600" />
        <span>资格初审</span>
      </button>

      <TenderQualificationMatchModal
        tenderId={tenderId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

export default function TenderQualificationMatchModal({
  tenderId,
  isOpen,
  onClose,
}: {
  tenderId: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<TenderQualificationMatchAnalysis | null>(null);
  const [companyName, setCompanyName] = useState<string>("我司");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [copiedMd, setCopiedMd] = useState<boolean>(false);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);

  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    startTransition(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getTenderQualificationMatchAction({ tenderId });
        if (!active) return;
        if (res.success && res.data) {
          setData(res.data);
          if (res.companyName) setCompanyName(res.companyName);
        } else {
          setError(res.error || "获取资格初审对标数据失败");
        }
      } catch (err) {
        console.error("Failed to load qualification match:", err);
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

  const getMatchedQualificationsList = (): CompanyQualificationItem[] => {
    if (!data) return [];
    const list: CompanyQualificationItem[] = [];
    data.items.forEach((it) => {
      if (it.matchedCert) {
        list.push(it.matchedCert);
      }
    });
    return list;
  };

  const handleCopyMarkdown = () => {
    const list = getMatchedQualificationsList();
    if (list.length === 0) return;
    const md = generateQualificationSummaryTable(list, "markdown");
    navigator.clipboard.writeText(md).then(() => {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    });
  };

  const handleCopyHtml = () => {
    const list = getMatchedQualificationsList();
    if (list.length === 0) return;
    const html = generateQualificationSummaryTable(list, "html");
    navigator.clipboard.writeText(html).then(() => {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/80 via-white to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  标讯资质资格要求智能初审罗盘
                </h3>
                {data && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border ${data.fitBadgeColor}`}
                  >
                    <SparklesIcon className="h-3 w-3" />
                    {data.fitLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {companyName} · {data ? data.tenderTitle : "正在全网深度扫描标讯资格门槛与证书有效期..."}
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

        {/* 顶部指标卡 */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 bg-purple-50/40 border-b border-purple-100 text-xs">
            <div>
              <span className="text-slate-500">检测门槛项:</span>{" "}
              <span className="font-bold text-slate-900">{data.totalRequired} 项</span>
            </div>
            <div>
              <span className="text-slate-500">有效符合:</span>{" "}
              <span className="font-bold text-emerald-700">{data.matchedCount} 项</span>
            </div>
            <div>
              <span className="text-slate-500">临期换证:</span>{" "}
              <span className="font-bold text-amber-700">{data.expiringCount} 项</span>
            </div>
            <div>
              <span className="text-slate-500">过期/缺项:</span>{" "}
              <span className="font-bold text-rose-700">
                {data.expiredCount + data.missingCount} 项
              </span>
            </div>
            <div>
              <span className="text-slate-500">预估加分:</span>{" "}
              <span className="font-bold text-purple-700 font-mono">
                +{data.estimatedBonusPoints} 分
              </span>
            </div>
          </div>
        )}

        {/* 内容主体 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-r-transparent" />
              <p className="text-sm font-medium text-slate-600 mt-3">
                正在深度核验招标文件资格条款、企业证书库与过期废标风险...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircleIcon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">资格初审核验遇到异常</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}

          {data && (
            <>
              {/* 审核建议横幅 */}
              <div
                className={`rounded-xl border p-4 text-xs flex items-start gap-3 ${
                  data.overallQualificationFit === "FATAL_RISK"
                    ? "border-rose-300 bg-rose-50/80 text-rose-900"
                    : data.overallQualificationFit === "RISKY"
                    ? "border-amber-300 bg-amber-50/80 text-amber-900"
                    : "border-purple-200 bg-purple-50/60 text-purple-900"
                }`}
              >
                {data.overallQualificationFit === "FATAL_RISK" ? (
                  <AlertCircleIcon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircleIcon className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-sm">{data.fitLabel}</p>
                  <p className="mt-1 leading-relaxed">{data.fitAdvice}</p>
                </div>
              </div>

              {/* 资格项对标清单 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    招标文件资格/认证条款智能对标清单 ({data.items.length})
                  </h4>
                  {data.items.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyMarkdown}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-2xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        {copiedMd ? (
                          <CheckIcon className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ClipboardIcon className="h-3 w-3 text-slate-500" />
                        )}
                        <span>{copiedMd ? "已复制 MD" : "复制 MD 汇总表"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyHtml}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-2xs font-semibold text-purple-700 hover:bg-purple-100 transition"
                      >
                        {copiedHtml ? (
                          <CheckIcon className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ClipboardIcon className="h-3 w-3 text-purple-600" />
                        )}
                        <span>{copiedHtml ? "已复制表格" : "复制 Word 表格"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {data.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                    <BuildingIcon className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="text-xs font-medium text-slate-600 mt-2">
                      未在标讯文本中扫描到特定行业资质/管理体系认证门槛要求
                    </p>
                    <p className="text-2xs text-slate-400 mt-1">
                      通常满足《政府采购法》第二十二条通用法人资格条件即可参与投标
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.items.map((item, idx) => {
                      const isFatal = item.rule.importance === "FATAL";
                      const isExpired = item.matchStatus === "MATCHED_EXPIRED";
                      const isExpiring = item.matchStatus === "MATCHED_EXPIRING";
                      const isMissing = item.matchStatus === "MISSING";
                      const isValid = item.matchStatus === "MATCHED_VALID";

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-4 transition-all ${
                            isExpired || (isMissing && isFatal)
                              ? "border-rose-300 bg-rose-50/40"
                              : isExpiring || isMissing
                              ? "border-amber-200 bg-amber-50/30"
                              : "border-slate-200 bg-white hover:border-purple-200 shadow-2xs"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {item.rule.name}
                                </span>
                                {isFatal ? (
                                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-2xs font-bold text-rose-700">
                                    一票否决资格项
                                  </span>
                                ) : (
                                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-2xs font-semibold text-blue-700">
                                    加分项 (+{item.rule.estimatedPoints}分)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 状态徽章 */}
                            <div>
                              {isValid && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                                  已匹配有效证书
                                </span>
                              )}
                              {isExpiring && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                                  <AlertCircleIcon className="h-3.5 w-3.5 text-amber-600" />
                                  30天高危临期
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                                  <AlertCircleIcon className="h-3.5 w-3.5 text-rose-600" />
                                  已过期失效 (严禁选送)
                                </span>
                              )}
                              {isMissing && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                                  <LockClosedIcon className="h-3.5 w-3.5 text-slate-500" />
                                  企业资质库缺失
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 标讯原文条款证据 */}
                          {item.detectedClauses.length > 0 && (
                            <div className="mt-2.5 rounded-lg bg-slate-50/80 p-2 text-2xs text-slate-600 border border-slate-100">
                              <span className="font-semibold text-slate-700">标讯条款原文：</span>
                              {item.detectedClauses.map((clause, cIdx) => (
                                <p key={cIdx} className="mt-0.5 italic text-slate-500">
                                  “{clause}”
                                </p>
                              ))}
                            </div>
                          )}

                          {/* 对标结果或风险警告 */}
                          {item.matchedCert && (
                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">对标在库证书：</span>
                                <span className="font-bold text-slate-800">
                                  {item.matchedCert.name}
                                </span>
                                {item.matchedCert.certNo && (
                                  <span className="font-mono text-slate-500 text-2xs">
                                    (No.{item.matchedCert.certNo})
                                  </span>
                                )}
                              </div>
                              <div className="text-2xs text-slate-500">
                                有效期至：
                                <span
                                  className={`font-semibold ${
                                    isExpired
                                      ? "text-rose-600 font-bold"
                                      : isExpiring
                                      ? "text-amber-600 font-bold"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {item.matchedCert.expiryDate} (剩 {item.matchedCert.daysRemaining} 天)
                                </span>
                              </div>
                            </div>
                          )}

                          {item.riskMessage && (
                            <div
                              className={`mt-2 rounded-lg p-2 text-2xs leading-relaxed ${
                                isExpired || (isMissing && isFatal)
                                  ? "bg-rose-100/70 text-rose-800 font-medium"
                                  : isExpiring || isMissing
                                  ? "bg-amber-100/70 text-amber-800"
                                  : "bg-blue-50 text-blue-800"
                              }`}
                            >
                              {item.riskMessage}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 底部导航与操作 */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs">
          <Link
            href="/qualifications"
            className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:text-purple-900 transition"
          >
            <span>维护企业资质证书台账</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
