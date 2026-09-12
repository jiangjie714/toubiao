"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  type PreSubmissionCheckItem,
  type ProposalKitData,
} from "@/lib/ai/proposal-generator";
import { getProposalKitAction } from "@/app/actions/proposal-copilot";
import {
  ClipboardIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  DocumentTextIcon,
  LockClosedIcon,
} from "@/components/icons";

interface Props {
  tenderId: number;
}

export default function TenderProposalCopilot({ tenderId }: Props) {
  const [data, setData] = useState<
    | (ProposalKitData & {
        isPremium: boolean;
        planCode: string;
        lockedMatrixCount: number;
      })
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<"matrix" | "outline" | "checks">("matrix");
  const [onlyFatal, setOnlyFatal] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    getProposalKitAction(tenderId).then((res) => {
      if (!mounted) return;
      setLoading(false);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "无法加载标书编制方案");
      }
    });
    return () => {
      mounted = false;
    };
  }, [tenderId]);

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyOutlineText = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`# ${data.projectName} - 投标文件编制大纲\n`);

    lines.push(`## 第一部分 商务标`);
    data.outline.businessPart.forEach((sec) => {
      lines.push(`### ${sec.title}`);
      sec.items.forEach((item) => lines.push(`- ${item}`));
    });

    lines.push(`\n## 第二部分 技术方案标`);
    data.outline.technicalPart.forEach((sec) => {
      lines.push(`### ${sec.title}`);
      sec.items.forEach((item) => lines.push(`- ${item}`));
    });

    lines.push(`\n## 第三部分 投标报价标`);
    data.outline.pricingPart.forEach((sec) => {
      lines.push(`### ${sec.title}`);
      sec.items.forEach((item) => lines.push(`- ${item}`));
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-slate-500">
        <span className="inline-block animate-spin mr-2">⏳</span>
        正在提炼标书编制大纲与点对点合规应答矩阵...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error || "加载失败"}
      </div>
    );
  }

  const isPremium = data.isPremium;
  const fatalCount = data.complianceMatrix.filter((m) => m.isFatal).length;
  const filteredMatrix = onlyFatal
    ? data.complianceMatrix.filter((m) => m.isFatal)
    : data.complianceMatrix;

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* 头部控制卡片 */}
      <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-linear-to-r from-blue-50/60 via-white to-indigo-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-white">
              <DocumentTextIcon className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              AI 标书编制助手与点对点合规应答矩阵
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isPremium
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isPremium ? `${data.planCode} 专享` : "基础体验版"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            逐条提炼招标文件响应要求，制定应答策略、必备材料清单与开标前自查防废标备忘
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyOutlineText}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-primary hover:text-primary transition"
          >
            <ClipboardIcon className="h-3.5 w-3.5" />
            {copied ? "已复制 Markdown！" : "复制标书大纲"}
          </button>
        </div>
      </div>

      {/* 升级提示 Banner */}
      {!isPremium && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <SparklesIcon className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">当前仅展示前 2 条合规矩阵。</span>
              升级白金版解锁全量 {data.complianceMatrix.length} 项点对点应答策略、必备附件清单及 Word 大纲导出。
            </div>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
          >
            解锁完整矩阵
          </Link>
        </div>
      )}

      {/* 子功能导航 Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("matrix")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === "matrix"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            点对点合规应答矩阵 ({data.complianceMatrix.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("outline")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === "outline"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <DocumentTextIcon className="h-3.5 w-3.5" />
            投标文件标准大纲 (三部分)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("checks")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === "checks"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShieldAlertIcon className="h-3.5 w-3.5" />
            开标前防废标 10 项自查清单
          </button>
        </div>

        {activeSubTab === "matrix" && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 tnum">
              已自查核对: {checkedCount}/{data.complianceMatrix.length}
            </span>
            <label className="flex items-center gap-1 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={onlyFatal}
                onChange={(e) => setOnlyFatal(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-rose-600 font-bold">仅看实质性废标项 ({fatalCount})</span>
            </label>
          </div>
        )}
      </div>

      {/* 内容 1：点对点合规应答矩阵 */}
      {activeSubTab === "matrix" && (
        <div className="space-y-3">
          {filteredMatrix.map((item) => {
            const isChecked = !!checkedItems[item.id];
            const isLocked = (item as unknown as { isLocked?: boolean }).isLocked;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition ${
                  isChecked
                    ? "border-emerald-200 bg-emerald-50/30"
                    : item.isFatal
                    ? "border-rose-200/80 bg-rose-50/20"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(item.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            item.category === "实质性条款"
                              ? "bg-rose-100 text-rose-800"
                              : item.category === "资格条件"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.category}
                        </span>

                        {item.isFatal && (
                          <span className="rounded bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                            ★ 一票否决项
                          </span>
                        )}

                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
                          责任人：{item.assignedRole}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        招标要求：{item.requirement}
                      </div>

                      {isLocked ? (
                        <div className="flex items-center gap-1 text-xs text-amber-700 pt-1">
                          <LockClosedIcon className="h-3 w-3" />
                          <span>应答策略与必备证明材料清单已锁定（升级白金版解锁）</span>
                        </div>
                      ) : (
                        <div className="space-y-1 pt-1 text-xs">
                          <div className="text-slate-700">
                            <span className="font-semibold text-primary">💡 应答策略：</span>
                            {item.responseStrategy}
                          </div>
                          <div className="text-slate-600">
                            <span className="font-semibold text-emerald-700">📁 必备附件：</span>
                            {item.evidenceRequired}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`text-[11px] font-semibold ${
                        isChecked ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {isChecked ? "✓ 已就绪" : "待准备"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 内容 2：投标文件标准编制大纲 */}
      {activeSubTab === "outline" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 商务标 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-primary">
                  第一部分
                </span>
                <h4 className="mt-1 text-sm font-bold text-slate-900">商务标架构</h4>
              </div>
              <div className="space-y-3">
                {data.outline.businessPart.map((sec) => (
                  <div key={sec.title} className="space-y-1">
                    <div className="text-xs font-semibold text-slate-800">{sec.title}</div>
                    <ul className="space-y-0.5 text-[11px] text-slate-600">
                      {sec.items.map((it) => (
                        <li key={it} className="pl-2 border-l-2 border-slate-100">
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 技术标 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <span className="rounded bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">
                  第二部分
                </span>
                <h4 className="mt-1 text-sm font-bold text-slate-900">技术方案标架构</h4>
              </div>
              <div className="space-y-3">
                {data.outline.technicalPart.map((sec) => (
                  <div key={sec.title} className="space-y-1">
                    <div className="text-xs font-semibold text-slate-800">{sec.title}</div>
                    <ul className="space-y-0.5 text-[11px] text-slate-600">
                      {sec.items.map((it) => (
                        <li key={it} className="pl-2 border-l-2 border-slate-100">
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 报价标 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                  第三部分
                </span>
                <h4 className="mt-1 text-sm font-bold text-slate-900">投标报价标架构</h4>
              </div>
              <div className="space-y-3">
                {data.outline.pricingPart.map((sec) => (
                  <div key={sec.title} className="space-y-1">
                    <div className="text-xs font-semibold text-slate-800">{sec.title}</div>
                    <ul className="space-y-0.5 text-[11px] text-slate-600">
                      {sec.items.map((it) => (
                        <li key={it} className="pl-2 border-l-2 border-slate-100">
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 内容 3：开标前 10 项防废标自查清单 */}
      {activeSubTab === "checks" && (
        <div className="space-y-3">
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
            <span className="font-bold">⚠️ 终极避坑军规：</span>
            以下 10 项为历年投标中最常见的低级废标重灾区。封标装箱前，建议由商务负责人与项目经理双人复核并签字确认！
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {data.preSubmissionChecks.map((chk: PreSubmissionCheckItem, idx: number) => {
              const isChecked = !!checkedItems[chk.id];
              const isLocked = (chk as unknown as { isLocked?: boolean }).isLocked;

              return (
                <div
                  key={chk.id}
                  className={`flex items-start justify-between p-3.5 text-xs transition ${
                    isChecked ? "bg-emerald-50/40" : "hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(chk.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {idx + 1}. {chk.item}
                        </span>
                        {chk.critical && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                            致命核心
                          </span>
                        )}
                      </div>
                      <div className={isLocked ? "text-amber-700" : "text-slate-600"}>
                        {chk.checkPoint}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`text-[11px] font-bold ${
                        isChecked ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {isChecked ? "✓ 已复核" : "待复核"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
