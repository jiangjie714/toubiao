"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ShieldAlertIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  LockClosedIcon,
  PrinterIcon,
  SparklesIcon,
  XMarkIcon,
} from "@/components/icons";
import {
  getTenderComplianceReportAction,
  type ComplianceActionResult,
} from "@/app/actions/tender-compliance";
import type {
  ComplianceCategory,
  ComplianceCheckStatus,
} from "@/lib/tender-compliance";

interface Props {
  tenderId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function TenderComplianceDialog({ tenderId, isOpen, onClose }: Props) {
  const [data, setData] = useState<ComplianceActionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // 状态筛选
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | ComplianceCategory>("ALL");
  const [onlyFatal, setOnlyFatal] = useState(false);

  // 用户自查勾选状态（本地记录）
  const [checkedMap, setCheckedMap] = useState<Record<string, ComplianceCheckStatus>>({});

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    startTransition(async () => {
      setLoading(true);
      const res = await getTenderComplianceReportAction(tenderId);
      if (!active) return;
      setData(res);
      setLoading(false);

      // 初始化勾选状态：优先采用 autoCheckResult
      if (res.success && res.report) {
        const initialMap: Record<string, ComplianceCheckStatus> = {};
        for (const r of res.report.rules) {
          if (r.autoCheckResult?.status) {
            initialMap[r.id] = r.autoCheckResult.status;
          } else {
            initialMap[r.id] = "PENDING";
          }
        }
        setCheckedMap(initialMap);
      }
    });

    return () => {
      active = false;
    };
  }, [tenderId, isOpen]);

  if (!isOpen) return null;

  const report = data?.report;
  const isPremium = data?.isPremium ?? false;

  const handleToggleStatus = (ruleId: string, status: ComplianceCheckStatus) => {
    setCheckedMap((prev) => ({
      ...prev,
      [ruleId]: prev[ruleId] === status ? "PENDING" : status,
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  // 过滤展示规则
  const rules = (report?.rules || []).filter((r) => {
    if (onlyFatal && !r.isFatal) return false;
    if (selectedCategory !== "ALL" && r.category !== selectedCategory) return false;
    return true;
  });

  const categories: Array<{ id: "ALL" | ComplianceCategory; label: string }> = [
    { id: "ALL", label: "全部雷区" },
    { id: "QUALIFICATION", label: "资格前置" },
    { id: "COMMERCIAL", label: "商务与报价" },
    { id: "TECHNICAL", label: "技术实质" },
    { id: "SEALING_SIGN", label: "装订盖章" },
    { id: "ELECTRONIC_CA", label: "电子CA" },
  ];

  // 计算当前用户标记通过数与标记疑虑数
  const userPassedCount = Object.values(checkedMap).filter((s) => s === "PASSED").length;
  const userFlaggedCount = Object.values(checkedMap).filter((s) => s === "FLAGGED").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden print:m-0 print:max-h-none print:w-full print:rounded-none print:shadow-none">
        
        {/* 弹窗顶栏 */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ShieldAlertIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  标书合规体检与防废标自查扫描仪
                </h2>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                  16 项一票否决红线
                </span>
                {!isPremium && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    免费试用模式（仅显示前5项）
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                标段：{report?.tenderTitle || "正在加载标讯要求..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <PrinterIcon className="h-4 w-4 text-slate-500" />
              <span>打印交底表</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 弹窗主体滚动区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-medium text-slate-500">
                正在深度扫描标讯实质性条款、资质底线与一票否决项...
              </p>
            </div>
          ) : !report ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              {data?.error || "扫描报告生成失败，请刷新重试"}
            </div>
          ) : (
            <>
              {/* 合规健康分与概览指示横幅 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 综合健康分卡片 */}
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500">合规健康指数</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-extrabold tracking-tight tnum ${
                        report.complianceScore >= 80
                          ? "text-emerald-600"
                          : report.complianceScore >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {report.complianceScore}
                    </span>
                    <span className="text-xs font-medium text-slate-500">/ 100</span>
                    <span
                      className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        report.riskLevel === "LOW"
                          ? "bg-emerald-100 text-emerald-800"
                          : report.riskLevel === "MEDIUM"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {report.riskLevel === "LOW"
                        ? "低废标风险"
                        : report.riskLevel === "MEDIUM"
                        ? "中度合规风险"
                        : "高危废标隐患"}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    基于标书红线条款与企业资质库自动测算
                  </p>
                </div>

                {/* 致命红线项 */}
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                  <div className="text-xs font-semibold text-red-800">一票否决法定红线</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-red-700 tnum">
                      {report.fatalChecksCount}
                    </span>
                    <span className="text-xs text-red-600">项关键指标</span>
                  </div>
                  <p className="mt-2 text-[11px] text-red-600/80">
                    任何一项不满足均将直接被评标委员会判定废标
                  </p>
                </div>

                {/* 智能预警自检命中 */}
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="text-xs font-semibold text-amber-800">AI 检测待重点排查</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-amber-700 tnum">
                      {report.autoFlaggedCount}
                    </span>
                    <span className="text-xs text-amber-600">处潜在缺漏/雷区</span>
                  </div>
                  <p className="mt-2 text-[11px] text-amber-700/80">
                    建议封标前重点复核保证金与原件证明
                  </p>
                </div>

                {/* 团队自查协同进度 */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="text-xs font-semibold text-primary">团队自查完成度</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-primary tnum">
                      {userPassedCount}
                    </span>
                    <span className="text-xs text-slate-500">/ {report.totalChecks} 已复核</span>
                    {userFlaggedCount > 0 && (
                      <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        {userFlaggedCount} 项存疑
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((userPassedCount / report.totalChecks) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 标讯显性红线原句抽取出示 */}
              {report.extractedClausesSummary.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <SparklesIcon className="h-4 w-4 text-amber-500" />
                    <span>招标文件显性一票否决/强制实质性要求节选</span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {report.extractedClausesSummary.map((clause, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100"
                      >
                        <span className="text-red-500 font-bold">●</span>
                        <span className="line-clamp-2">“{clause}”</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 过滤控制栏 */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 print:hidden">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.id)}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedCategory === c.id
                          ? "bg-slate-900 text-white font-semibold"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={onlyFatal}
                      onChange={(e) => setOnlyFatal(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>仅看一票否决项</span>
                  </label>
                </div>
              </div>

              {/* 16 项雷区清单列表 */}
              <div className="space-y-4">
                {rules.map((rule, idx) => {
                  const currentStatus = checkedMap[rule.id] || "PENDING";
                  const isLocked = !isPremium && idx >= 5;

                  return (
                    <div
                      key={rule.id}
                      className={`relative rounded-xl border p-4 transition-all duration-150 ${
                        isLocked
                          ? "border-slate-200 bg-slate-50/70"
                          : currentStatus === "PASSED"
                          ? "border-emerald-200 bg-emerald-50/20"
                          : currentStatus === "FLAGGED"
                          ? "border-amber-300 bg-amber-50/30"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {rule.categoryLabel}
                            </span>
                            {rule.isFatal && (
                              <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                一票否决
                              </span>
                            )}
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              责任人：{rule.assignedRole}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">
                              {rule.title}
                            </h3>
                          </div>

                          <p className="text-xs text-slate-700 font-medium pt-1">
                            {rule.checkPoint}
                          </p>

                          {!isLocked && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
                              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                <span className="font-semibold text-slate-700 block mb-1">
                                  📌 标准编制与应答应答策略：
                                </span>
                                <span className="text-slate-600 leading-relaxed">
                                  {rule.responseRequirement}
                                </span>
                              </div>
                              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                <span className="font-semibold text-slate-700 block mb-1">
                                  📋 封标必备原件与证明佐证：
                                </span>
                                <span className="text-slate-600 leading-relaxed">
                                  {rule.evidenceRequired}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 标讯正文原文相关摘录 */}
                          {!isLocked && rule.detectedTenderClauses.length > 0 && (
                            <div className="mt-2 text-[11px] text-slate-500 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                              <span className="font-semibold text-blue-700">标讯原文：</span>
                              {rule.detectedTenderClauses.map((c, i) => (
                                <span key={i} className="mr-2">“{c}”</span>
                              ))}
                            </div>
                          )}

                          {/* AI 预审诊断提示 */}
                          {!isLocked && rule.autoCheckResult && (
                            <div
                              className={`mt-2 flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 ${
                                rule.autoCheckResult.status === "FLAGGED"
                                  ? "bg-amber-100/70 text-amber-900"
                                  : rule.autoCheckResult.status === "PASSED"
                                  ? "bg-emerald-100/70 text-emerald-900"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {rule.autoCheckResult.status === "FLAGGED" ? (
                                <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0" />
                              ) : (
                                <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                              )}
                              <span>AI 档案比对：{rule.autoCheckResult.reason}</span>
                            </div>
                          )}
                        </div>

                        {/* 右侧自查操作按钮组 */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5 print:hidden">
                          {isLocked ? (
                            <Link
                              href="/pricing"
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-amber-600 transition-colors"
                            >
                              <LockClosedIcon className="h-3 w-3" />
                              <span>升级解锁</span>
                            </Link>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(rule.id, "PASSED")}
                                className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  currentStatus === "PASSED"
                                    ? "bg-emerald-600 text-white"
                                    : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                                }`}
                              >
                                <CheckIcon className="h-3.5 w-3.5" />
                                <span>已核验通过</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(rule.id, "FLAGGED")}
                                className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  currentStatus === "FLAGGED"
                                    ? "bg-amber-600 text-white"
                                    : "border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700"
                                }`}
                              >
                                <AlertCircleIcon className="h-3.5 w-3.5" />
                                <span>存在疑问</span>
                              </button>
                            </>
                          )}
                        </div>

                        {/* 打印版式的复核签字横线 */}
                        <div className="hidden print:block text-xs text-slate-600">
                          核验人：____________ 状态：[ ]通过 [ ]异常
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 打印专用的交接签字区 */}
              <div className="hidden print:block border-t-2 border-slate-800 pt-6 mt-8">
                <h4 className="text-sm font-bold text-slate-900 mb-4">
                  标书编制与封标交接确认签署（开标前必须双人复核）：
                </h4>
                <div className="grid grid-cols-3 gap-6 text-xs text-slate-800">
                  <div>商务标负责人签字：____________ 日期：____年__月__日</div>
                  <div>技术标负责人签字：____________ 日期：____年__月__日</div>
                  <div>最终封标复核人签字：____________ 日期：____年__月__日</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 弹窗底栏 */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 print:hidden">
          <div className="text-xs text-slate-500">
            {isPremium
              ? "已激活企业全量深度防废标扫描能力，支持打印出单交底备查"
              : "升级至白金版或企业版，解锁全部 16 大深度废标红线与企业资质自查"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
