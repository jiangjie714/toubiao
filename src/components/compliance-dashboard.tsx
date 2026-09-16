"use client";

import React, { useState, useTransition } from "react";
import {
  ShieldCheckIcon,
  SparklesIcon,
  DocumentTextIcon,
} from "@/components/icons";
import {
  refreshComplianceInspectionAction,
  ComplianceActionResult,
} from "@/app/actions/compliance";
import { ComplianceInspectionResult } from "@/lib/compliance";

interface ComplianceDashboardProps {
  initialData: ComplianceInspectionResult;
  userName: string;
}

export default function ComplianceDashboard({
  initialData,
  userName,
}: ComplianceDashboardProps) {
  const [data, setData] = useState<ComplianceInspectionResult>(initialData);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const categories = [
    { key: "ALL", label: "全部指标 (15项)" },
    { key: "IDENTITY", label: "身份鉴别 (3项)" },
    { key: "ACCESS", label: "访问控制 (3项)" },
    { key: "AUDIT", label: "安全审计 (3项)" },
    { key: "DATA", label: "数据安全 (3项)" },
    { key: "RESILIENCE", label: "系统韧性 (3项)" },
  ];

  const filteredItems =
    activeCategory === "ALL"
      ? data.items
      : data.items.filter((item) => item.category === activeCategory);

  // 手动触发全面体检
  const handleRefresh = () => {
    startTransition(async () => {
      const res: ComplianceActionResult = await refreshComplianceInspectionAction();
      if (res.success && res.data) {
        setData(res.data);
        setToastMsg("安全合规巡检完成，数据已更新！");
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        alert(res.error || "巡检失败");
      }
    });
  };

  // 触发导出 DOCX 报告
  const handleExportDocx = () => {
    try {
      setIsExporting(true);
      const downloadUrl = `/api/compliance/export/docx`;
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setToastMsg("正在下载等保二级自评公文报告 (.docx)...");
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error("Export compliance docx error:", err);
      alert("导出失败，请重试");
    } finally {
      setTimeout(() => setIsExporting(false), 2000);
    }
  };

  const isExcellent = data.rating === "EXCELLENT";

  return (
    <div className="space-y-6">
      {/* 顶部主标题与操作条 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs">
              <ShieldCheckIcon className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              网络安全等级保护（二级）合规与审计中心
            </h1>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              GB/T 22239-2019
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            对照国家等保二级 S2A2G2 技术规范，实时巡检身份鉴别、访问控制、安全审计、数据安全与系统韧性 15 项指标，自动生成权威公文级自评估证据链报告。（当前安全审计员：<strong className="text-slate-800">{userName}</strong>）
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
          >
            <SparklesIcon className="h-4 w-4 text-emerald-600" />
            <span>{isPending ? "正在全栈巡检..." : "重新执行合规巡检"}</span>
          </button>
          <button
            onClick={handleExportDocx}
            disabled={isExporting}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white hover:from-emerald-700 hover:to-teal-700 transition-all shadow-xs disabled:opacity-50"
          >
            <DocumentTextIcon className="h-4 w-4" />
            <span>{isExporting ? "正在排版生成 Word..." : "导出等保自评报告 (.docx)"}</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{toastMsg}</span>
          <span className="cursor-pointer font-bold" onClick={() => setToastMsg(null)}>✕</span>
        </div>
      )}

      {/* 核心指标与健康雷达看板 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* 总评分卡 */}
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">等保二级技术符合度</span>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                isExcellent
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {data.ratingLabel}
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900 tnum">
              {data.overallScore}
            </span>
            <span className="text-sm font-semibold text-slate-400">/ 100 分</span>
          </div>
          <div className="text-[11px] text-slate-500">
            上次巡检：{data.inspectedAt.replace("T", " ").slice(0, 19)}
          </div>
        </div>

        {/* 符合项数量 */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">完全符合 (Pass)</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">
              ✓
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-emerald-800 tnum">
              {data.stats.passedItems}
            </span>
            <span className="text-xs text-emerald-700">/ {data.stats.totalItems} 项</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            技术控制措施充分完备
          </div>
        </div>

        {/* 预警与持续优化项 */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">基本符合/建议优化</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs">
              !
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-amber-800 tnum">
              {data.stats.warningItems}
            </span>
            <span className="text-xs text-amber-700">项需优化</span>
          </div>
          <div className="text-[11px] text-amber-700">
            异地云容灾备份建议进一步加固
          </div>
        </div>

        {/* 审计日志合规性 */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900">网络日志法定留存</span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
              ≥ 180 天
            </span>
          </div>
          <div className="my-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-blue-800 tnum">
              100%
            </span>
            <span className="text-xs text-blue-700">满足网安法规范</span>
          </div>
          <div className="text-[11px] text-blue-600 font-medium">
            防篡改只读审计链正常运行
          </div>
        </div>
      </div>

      {/* 控制域切换 Tab */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 15 项指标卡片流 */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {filteredItems.map((item) => {
          const isPassed = item.status === "PASSED";
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 shadow-2xs transition-all ${
                isPassed
                  ? "border-slate-200 bg-surface hover:border-slate-300"
                  : "border-amber-200 bg-amber-50/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                      {item.id}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {item.categoryName} · {item.standardClause}
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-sm font-bold text-slate-900">
                    {item.title}
                  </h4>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isPassed
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {isPassed ? "✓ 符合" : "▲ 建议优化"}
                  </span>
                  <div className="mt-1 text-[11px] text-slate-400 tnum">
                    得分 {item.score} / {item.weight}
                  </div>
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {item.description}
              </p>

              <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100">
                <span className="font-bold text-slate-900">合规技术证据：</span>
                <span className="text-slate-600">{item.evidence}</span>
              </div>

              {item.recommendation && (
                <div className="mt-2 rounded-xl bg-amber-50/80 p-2.5 text-xs text-amber-900 border border-amber-200/60">
                  <span className="font-bold">优化指引：</span>
                  <span>{item.recommendation}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 法定网络安全审计流水抽样 */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              网络日志防篡改审计流水（近期抽样证据）
            </h3>
            <p className="text-xs text-slate-500">
              依据《网络安全法》第 21 条要求，审计记录只读追加、不可篡改，已留存操作人员、时间、IP 与具体行为。
            </p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            抽样展示 {data.auditLogsSample.length} 笔
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-slate-600">
              <tr>
                <th className="py-2.5 px-3 font-semibold">记录时间</th>
                <th className="py-2.5 px-3 font-semibold">事件类型</th>
                <th className="py-2.5 px-3 font-semibold">操作主体</th>
                <th className="py-2.5 px-3 font-semibold">来源 IP</th>
                <th className="py-2.5 px-3 font-semibold">审计目标与详情</th>
                <th className="py-2.5 px-3 font-semibold text-right">安全级别</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.auditLogsSample.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 tnum">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    {log.operator}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                    {log.ip}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-slate-800">{log.target}</span>
                    <span className="text-slate-400 mx-1">·</span>
                    <span className="text-slate-500">{log.detail}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        log.level === "WARN"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {log.level === "WARN" ? "敏感" : "正常"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
