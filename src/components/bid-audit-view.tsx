"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  ShieldAlertIcon,
  AlertCircleIcon,
  CheckIcon,
  DocumentTextIcon,
  ClipboardIcon,
  TrashIcon,
  ClockIcon,
  ArrowRightIcon,
  XMarkIcon,
} from "@/components/icons";
import {
  runDocumentAuditAction,
  getAuditHistoryAction,
  deleteAuditRecordAction,
  exportAuditReportAction,
  type AuditRecordItem,
} from "@/app/actions/audit";
import {
  AUDIT_CATEGORIES_META,
  type AuditCategory,
  type AuditResultData,
} from "@/lib/audit-manager";

interface Props {
  initialHistory: AuditRecordItem[];
  initialSummary?: {
    totalAudits: number;
    highRiskCount: number;
    avgScore: number;
    fatalIssuesTotal: number;
  };
  hasTeam: boolean;
  followsList: Array<{ id: number; title: string; purchaser?: string | null; budgetAmount?: number | null }>;
}

export default function BidAuditView({
  initialHistory,
  initialSummary,
  hasTeam,
  followsList,
}: Props) {
  const [activeTab, setActiveTab] = useState<"sandbox" | "history">("sandbox");
  const [mode, setMode] = useState<"personal" | "team">(hasTeam ? "team" : "personal");
  const [historyList, setHistoryList] = useState<AuditRecordItem[]>(initialHistory);
  const [summary, setSummary] = useState(initialSummary || {
    totalAudits: initialHistory.length,
    highRiskCount: initialHistory.filter((r) => r.riskLevel === "HIGH").length,
    avgScore: 92,
    fatalIssuesTotal: 0,
  });
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [historyLoading, setHistoryLoading] = useState(false);

  // 送检输入状态
  const [selectedFollowId, setSelectedFollowId] = useState<string>("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [targetPurchaser, setTargetPurchaser] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [inspector, setInspector] = useState("");
  const [content, setContent] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  // 扫描结果展示
  const [currentResult, setCurrentResult] = useState<AuditResultData | null>(null);
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null);

  // 公文报告 Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [copiedReport, setCopiedReport] = useState(false);

  const [, startTransition] = useTransition();

  const handleSelectFollow = (followIdStr: string) => {
    setSelectedFollowId(followIdStr);
    if (!followIdStr) return;
    const f = followsList.find((item) => item.id.toString() === followIdStr);
    if (f) {
      setDocumentTitle(`${f.title} - 投标文件`);
      if (f.purchaser) setTargetPurchaser(f.purchaser);
      if (f.budgetAmount) setBudgetAmount(f.budgetAmount.toString());
    }
  };

  const handleFillSample = () => {
    setDocumentTitle("市自然资源局智能地理空间信息平台 - 投标文件商务技术方案");
    setTargetPurchaser("市自然资源局");
    setBudgetAmount("240");
    setInspector("张工程师 (主笔人)");
    setContent(`一、投标函及投标报价表
致：市教育局政府采购中心（注：此处为遗留错写机构）
我方在此郑重承诺，愿意以投标总报价人民币：壹佰贰拾万元整（小写：¥1,250,000.00元）承接本项目全周期建设与运维工作。
本投标文件投标有效期为 45 日历天。

二、技术方案实质性响应
我方对招标文件第六章全部技术参数逐条核对，除第 4.2 条云端数据灾备系统因第三方环境原因存在负偏离不能提供之外，其余非星号条款均满足要求。
本项目由 [XXX公司] 提供售后常驻保障。

三、法定代表人授权委托书
本标段由项目经理全权代表我公司办理投标与开标事宜。
文档排版工具：WPS Office 2024 专业版，创建者：Administrator。`);
  };

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setScanning(true);
    setScanError("");
    setCurrentResult(null);

    const res = await runDocumentAuditAction({
      content,
      documentTitle: documentTitle.trim() || undefined,
      followId: selectedFollowId ? parseInt(selectedFollowId, 10) : undefined,
      targetPurchaser: targetPurchaser.trim() || undefined,
      budgetAmount: budgetAmount ? parseFloat(budgetAmount) : undefined,
      inspector: inspector.trim() || undefined,
    });

    setScanning(false);
    if (!res.success || !res.data) {
      setScanError(res.error || "清标分析失败");
    } else {
      setCurrentResult(res.data);
      setCurrentRecordId(res.recordId || null);
      // 刷新历史
      refreshHistory();
    }
  };

  const refreshHistory = async (newRisk = riskFilter, newMode = mode) => {
    setHistoryLoading(true);
    const res = await getAuditHistoryAction({
      mode: newMode,
      riskFilter: newRisk,
    });
    if (res.success && res.records && res.summary) {
      setHistoryList(res.records);
      setSummary(res.summary);
    }
    setHistoryLoading(false);
  };

  const handleRiskFilterChange = (newRisk: string) => {
    setRiskFilter(newRisk);
    startTransition(() => {
      refreshHistory(newRisk, mode);
    });
  };

  const handleModeChange = (newMode: "personal" | "team") => {
    setMode(newMode);
    startTransition(() => {
      refreshHistory(riskFilter, newMode);
    });
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm("确定要删除该清标质检记录吗？")) return;
    await deleteAuditRecordAction(id);
    refreshHistory();
  };

  const handleOpenReportModal = async (recordId: number) => {
    setIsReportModalOpen(true);
    setReportMarkdown("");
    const res = await exportAuditReportAction(recordId);
    if (res.success && res.markdown) {
      setReportMarkdown(res.markdown);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题与协同切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheckIcon className="size-6 text-primary" />
              投标文件智能清标查重与合规深度质检罗盘
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              M2 防废标安全气囊
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            封标前全真模拟专家评审清标：穿透排查模板占位符残留、错写非本项目业主、报价大小写不符、星号负偏离与串标特征。
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasTeam && (
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleModeChange("team")}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === "team"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                企业团队质检
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("personal")}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === "personal"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                我负责的送检
              </button>
            </div>
          )}

          <Link
            href="/tracker"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <span>返回看板</span>
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 维核心质检概况卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">累计送检标书数</span>
            <div className="rounded-xl bg-blue-50 p-2 text-primary">
              <DocumentTextIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900 tnum">
              {summary.totalAudits}
            </span>
            <span className="text-xs text-slate-500">份标书卷宗</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">封标前覆盖率持续提升</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">平均清标健康指数</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <ShieldCheckIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900 tnum">
              {summary.avgScore}
            </span>
            <span className="text-xs text-slate-500">分 / 100</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">基准合格线为 85 分</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">累计拦截废标隐患</span>
            <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
              <ShieldAlertIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-rose-600 tnum">
              {summary.fatalIssuesTotal}
            </span>
            <span className="text-xs text-rose-700">项致命隐患</span>
          </div>
          <p className="mt-2 text-[11px] text-rose-500 font-medium">包括模板残留与报价矛盾</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">高危标书及时阻断</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
              <AlertCircleIcon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900 tnum">
              {summary.highRiskCount}
            </span>
            <span className="text-xs text-slate-500">份高危标书</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">避免带伤投标造成巨额损失</p>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("sandbox")}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "sandbox"
              ? "bg-primary text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          即时清标质检沙箱
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("history");
            refreshHistory();
          }}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "history"
              ? "bg-primary text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          历史质检归档台账 ({historyList.length})
        </button>
      </div>

      {/* Tab 1: 即时清标沙箱 */}
      {activeTab === "sandbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧 6 列: 送检表单与文本编辑器 */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <DocumentTextIcon className="size-4 text-primary" />
                送检标书文本与对标参数
              </h2>
              <button
                type="button"
                onClick={handleFillSample}
                className="text-xs text-primary hover:underline font-semibold"
              >
                加载典型错误示例 ⚡
              </button>
            </div>

            <form onSubmit={handleRunAudit} className="space-y-4">
              {/* 关联跟进项目 */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  关联看板项目 (自动带出采购人与预算)
                </label>
                <select
                  value={selectedFollowId}
                  onChange={(e) => handleSelectFollow(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-primary focus:outline-hidden"
                >
                  <option value="">手动录入参数 (不关联已有标段)</option>
                  {followsList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    送检文档名称 / 章节
                  </label>
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="例如: 智慧应急方案-商务及技术标全本"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    清标复核责任人
                  </label>
                  <input
                    type="text"
                    value={inspector}
                    onChange={(e) => setInspector(e.target.value)}
                    placeholder="例如: 方案经理 / 商务主管"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    目标采购单位全称 (用于检测残留错写)
                  </label>
                  <input
                    type="text"
                    value={targetPurchaser}
                    onChange={(e) => setTargetPurchaser(e.target.value)}
                    placeholder="例如: 市自然资源局"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    最高采购限价 / 预算 (万元)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="例如: 240 (用于排查超限价)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 送检文本 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    投标文件正文文本 (支持粘贴商务标/技术标要点) *
                  </label>
                  <span className="text-[11px] text-slate-400 tnum">
                    已输入 {content.length} 字符
                  </span>
                </div>
                <textarea
                  required
                  rows={12}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="在此直接粘贴待封标的投标文件章节内容（如投标函、分项报价明细表、实质性技术指标应答说明、服务承诺等）..."
                  className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              {scanError && <p className="text-xs text-rose-600">{scanError}</p>}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  ⚡ 涵盖模板占位符、报价大小写、负偏离、有效性六大维度排查
                </span>

                <button
                  type="submit"
                  disabled={scanning || !content.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {scanning ? (
                    <>
                      <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>正在六维深度扫描...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="size-4" />
                      <span>开始智能清标质检</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* 右侧 6 列: 实时扫描结果与诊断卡片 */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlertIcon className="size-4 text-primary" />
                清标质检诊断结论
              </h2>

              {currentRecordId && (
                <button
                  type="button"
                  onClick={() => handleOpenReportModal(currentRecordId)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
                >
                  <DocumentTextIcon className="size-3.5 text-primary" />
                  <span>公文报告预览</span>
                </button>
              )}
            </div>

            {!currentResult ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-slate-400 gap-3">
                <ShieldCheckIcon className="size-12 stroke-1 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">等待送检分析</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  请在左侧填入或粘贴标书内容，点击【开始智能清标质检】即可获得六维穿透排查报告。
                </p>
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[680px] pr-1">
                {/* 评分横幅 */}
                <div
                  className={`rounded-2xl border p-4 flex items-center justify-between ${
                    currentResult.riskLevel === "HIGH"
                      ? "border-rose-300 bg-rose-50/80 text-rose-900"
                      : currentResult.riskLevel === "MEDIUM"
                      ? "border-amber-300 bg-amber-50/80 text-amber-900"
                      : "border-emerald-300 bg-emerald-50/80 text-emerald-900"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        清标综合健康分
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          currentResult.riskLevel === "HIGH"
                            ? "bg-rose-200 text-rose-900"
                            : currentResult.riskLevel === "MEDIUM"
                            ? "bg-amber-200 text-amber-900"
                            : "bg-emerald-200 text-emerald-900"
                        }`}
                      >
                        {currentResult.riskLevel === "HIGH"
                          ? "🔴 高危废标风险"
                          : currentResult.riskLevel === "MEDIUM"
                          ? "🟡 存在扣分风险"
                          : "🟢 健康通过"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      送检长度 {currentResult.auditedLength} 字 · 拦截 {currentResult.fatalCount} 项一票否决 · {currentResult.warningCount} 项扣分预警
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-4xl font-extrabold tnum">
                      {currentResult.auditScore}
                    </span>
                    <span className="text-xs font-normal text-slate-500 block">/ 100 分</span>
                  </div>
                </div>

                {/* 六维维度得分清单 */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">六维清标细项判定:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(AUDIT_CATEGORIES_META) as AuditCategory[]).map((cat) => {
                      const meta = AUDIT_CATEGORIES_META[cat];
                      const score = currentResult.categoryScores[cat];
                      const hasFail = score < 80;
                      return (
                        <div
                          key={cat}
                          className={`rounded-lg border p-2 bg-white flex items-center justify-between ${
                            hasFail ? "border-rose-200 text-rose-800" : "border-slate-200 text-slate-700"
                          }`}
                        >
                          <span className="font-semibold text-[11px]">{meta.shortLabel}</span>
                          <span className={`text-[10px] font-bold ${hasFail ? "text-rose-600" : "text-emerald-600"}`}>
                            {hasFail ? "⚠️ 发现隐患" : "✅ 达标"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 隐患与整改卡片列表 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-800">
                    隐患排查详情清单 ({currentResult.issues.length})
                  </h3>

                  {currentResult.issues.length === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckIcon className="size-4 text-emerald-600 shrink-0" />
                      <span>未检测出明显的模板残留与一票否决隐患，格式规范良好！</span>
                    </div>
                  ) : (
                    currentResult.issues.map((issue) => {
                      const meta = AUDIT_CATEGORIES_META[issue.category];
                      const isFatal = issue.severity === "FATAL";
                      return (
                        <div
                          key={issue.id}
                          className={`rounded-xl border p-3.5 space-y-2 text-xs transition ${
                            isFatal
                              ? "border-rose-200 bg-rose-50/30"
                              : "border-amber-200 bg-amber-50/30"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${meta.badgeColor}`}
                            >
                              {meta.shortLabel}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isFatal
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {isFatal ? "🔴 一票否决/废标" : "🟡 扣分警告"}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 leading-snug">{issue.title}</h4>
                          <p className="text-slate-600 leading-relaxed">{issue.description}</p>

                          {issue.excerpt && (
                            <div className="rounded bg-slate-100 p-2 font-mono text-[11px] text-slate-800 break-all">
                              原文定位：<span className="text-rose-600 font-semibold">{issue.excerpt}</span>
                            </div>
                          )}

                          <div className="rounded-lg bg-white p-2 border border-slate-200 text-slate-700 font-medium">
                            💡 <strong>整改对策</strong>: {issue.suggestion}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: 历史质检台账 */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* 筛选工具栏 */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/60">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClockIcon className="size-4 text-primary" />
              历史投标文件清标质检台账
            </h3>

            <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleRiskFilterChange("ALL")}
                className={`rounded-md px-2.5 py-1 transition ${
                  riskFilter === "ALL" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600"
                }`}
              >
                全部级别
              </button>
              <button
                type="button"
                onClick={() => handleRiskFilterChange("HIGH")}
                className={`rounded-md px-2.5 py-1 transition ${
                  riskFilter === "HIGH" ? "bg-white text-rose-800 font-bold shadow-xs" : "text-slate-600"
                }`}
              >
                高危废标风险
              </button>
              <button
                type="button"
                onClick={() => handleRiskFilterChange("MEDIUM")}
                className={`rounded-md px-2.5 py-1 transition ${
                  riskFilter === "MEDIUM" ? "bg-white text-amber-800 font-bold shadow-xs" : "text-slate-600"
                }`}
              >
                中度扣分风险
              </button>
              <button
                type="button"
                onClick={() => handleRiskFilterChange("LOW")}
                className={`rounded-md px-2.5 py-1 transition ${
                  riskFilter === "LOW" ? "bg-white text-emerald-800 font-bold shadow-xs" : "text-slate-600"
                }`}
              >
                健康通过
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs">加载质检历史中...</p>
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              暂无符合条件的清标质检归档记录。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyList.map((rec) => {
                const isHigh = rec.riskLevel === "HIGH";
                const isMed = rec.riskLevel === "MEDIUM";

                return (
                  <div
                    key={rec.id}
                    className="p-5 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            isHigh
                              ? "bg-rose-100 text-rose-800"
                              : isMed
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isHigh ? "🔴 高危废标隐患" : isMed ? "🟡 扣分预警" : "🟢 健康达标"}
                        </span>

                        <span className="text-xs font-bold text-slate-800 font-mono">
                          {rec.auditScore} 分
                        </span>

                        {rec.fatalIssuesCount > 0 && (
                          <span className="rounded bg-rose-50 text-rose-700 px-1.5 py-0.2 text-[10px] font-bold">
                            {rec.fatalIssuesCount} 处一票否决
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400">
                          复核人: {rec.inspector || "项目组"} · {rec.createdAt.slice(0, 10)}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {rec.documentTitle}
                      </h4>

                      {rec.tender && (
                        <p className="text-xs text-slate-500">
                          关联标讯: {rec.tender.title} {rec.tender.purchaser ? `(${rec.tender.purchaser})` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenReportModal(rec.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                      >
                        <DocumentTextIcon className="size-3.5 text-primary" />
                        <span>报告公文</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(rec.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="删除记录"
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 公文报告预览 Modal */}
      {isReportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setIsReportModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  《投标文件清标自查与深度质检报告》
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  公文级 Markdown 格式，含六维排查结论与封标前四方交叉复核打勾确认表
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(reportMarkdown);
                    setCopiedReport(true);
                    setTimeout(() => setCopiedReport(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <ClipboardIcon className="size-3.5" />
                  <span>{copiedReport ? "已复制" : "复制全文"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
                >
                  <XMarkIcon className="size-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {reportMarkdown || "正在生成质检报告公文..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
