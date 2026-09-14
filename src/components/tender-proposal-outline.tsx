"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  DocumentTextIcon,
  SparklesIcon,
  CheckCircleIcon,
  CheckIcon,
  AlertCircleIcon,
  LockClosedIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ShieldCheckIcon,
  ClipboardIcon,
} from "@/components/icons";
import {
  getProposalOutlineAction,
  type ProposalOutlineActionResponse,
} from "@/app/actions/proposal-generator";
import type { ProposalOutlineResult, PointToPointResponseItem } from "@/lib/proposal-generator";

interface Props {
  tenderId: number;
}

export function TenderProposalOutlineButton({ tenderId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors print:hidden shadow-2xs"
        title="一键解构招标文件、智能生成 7 大章节标书目录与点对点技术应答框架"
      >
        <DocumentTextIcon className="h-3.5 w-3.5 text-indigo-600" />
        <span>标书大纲</span>
      </button>

      <TenderProposalOutlineModal
        tenderId={tenderId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

export default function TenderProposalOutlineModal({
  tenderId,
  isOpen,
  onClose,
}: {
  tenderId: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProposalOutlineResult | null>(null);
  const [isPlatinum, setIsPlatinum] = useState<boolean>(true);
  const [planName, setPlanName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"OUTLINE" | "MATRIX" | "CHECKLIST">("OUTLINE");
  const [matrixFilter, setMatrixFilter] = useState<"ALL" | "STAR" | "TECHNICAL" | "COMMERCIAL" | "QUALIFICATION">("ALL");
  const [copied, setCopied] = useState<boolean>(false);

  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    startTransition(async () => {
      setLoading(true);
      setError("");
      try {
        const res: ProposalOutlineActionResponse = await getProposalOutlineAction({
          tenderId,
        });
        if (!active) return;
        if (res.success && res.data) {
          setData(res.data);
          setIsPlatinum(res.isPlatinumOrAbove);
          setPlanName(res.planName);
        } else {
          setError(res.error || "获取标书大纲数据失败");
        }
      } catch (err) {
        console.error("Failed to fetch proposal outline:", err);
        if (active) {
          setError("连接服务器超时，请稍后重试");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [tenderId, isOpen]);

  if (!isOpen) return null;

  // 复制点对点应答表格为 Markdown
  const handleCopyMatrix = () => {
    if (!data) return;
    let md = "| 序号 | 条款类型 | 招标文件要求 | 投标响应承诺 | 方案与说明 | 佐证支撑索引 |\n";
    md += "| --- | --- | --- | --- | --- | --- |\n";
    for (const item of data.pointToPointMatrix) {
      const typeStr = item.isStarClause ? `${item.typeLabel} (★关键)` : item.typeLabel;
      md += `| ${item.index} | ${typeStr} | ${item.tenderRequirement} | ${item.commitmentLabel} | ${item.responseDetail} | ${item.proofDocGuide} |\n`;
    }

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const filteredMatrix = data?.pointToPointMatrix.filter((item: PointToPointResponseItem) => {
    if (matrixFilter === "STAR") return item.isStarClause;
    if (matrixFilter === "TECHNICAL") return item.clauseType === "TECHNICAL";
    if (matrixFilter === "COMMERCIAL") return item.clauseType === "COMMERCIAL";
    if (matrixFilter === "QUALIFICATION") return item.clauseType === "QUALIFICATION";
    return true;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-surface rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <DocumentTextIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  智能标书大纲与点对点技术应答框架
                </h3>
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  <SparklesIcon className="h-3 w-3" />
                  政府采购标准架构
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {data ? `${data.title}（项目编号: ${data.projectNo || "无"}）` : "正在智能拆解招标文件要点..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 顶部指标统计条 */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-xs text-slate-600">
            <div>
              <span className="text-slate-400">标准章节:</span>{" "}
              <span className="font-bold text-slate-800">{data.summary.totalSections} 大部分</span>
            </div>
            <div>
              <span className="text-slate-400">技术指标:</span>{" "}
              <span className="font-bold text-blue-700">{data.summary.technicalPointsCount} 项</span>
            </div>
            <div>
              <span className="text-slate-400">商务条款:</span>{" "}
              <span className="font-bold text-indigo-700">{data.summary.commercialPointsCount} 项</span>
            </div>
            <div>
              <span className="text-slate-400">资格审查:</span>{" "}
              <span className="font-bold text-emerald-700">{data.summary.qualificationPointsCount} 项</span>
            </div>
            <div>
              <span className="text-slate-400">★星标关键项:</span>{" "}
              <span className="font-bold text-rose-600">{data.summary.starClausesCount} 项</span>
            </div>
          </div>
        )}

        {/* Tab 栏与快捷工具 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("OUTLINE")}
              className={`cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "OUTLINE"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              📑 标准标书 7 大章节大纲
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("MATRIX")}
              className={`cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "MATRIX"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              🎯 点对点逐条响应与偏离表 ({data?.pointToPointMatrix.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CHECKLIST")}
              className={`cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "CHECKLIST"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              📋 编制分工与封标自查清单
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMatrix}
              className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              title="复制全部点对点应答表格文本（Markdown 格式）"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">已复制到剪贴板</span>
                </>
              ) : (
                <>
                  <ClipboardIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>复制点对点表格</span>
                </>
              )}
            </button>

            <a
              href={`/api/tenders/${tenderId}/export/proposal-doc`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-2xs"
              title="一键下载可直接编辑填写的 Microsoft Word (.doc) 标书框架草案"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              <span>导出 Word 标书草案</span>
            </a>
          </div>
        </div>

        {/* 弹窗内容主体 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-r-transparent" />
              <p className="text-sm font-medium text-slate-600 mt-3">
                正在深度解构招标文件资格条件、商务指标与技术规格...
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
              {/* 非白金会员权益提示 */}
              {!isPlatinum && (
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-800">
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      当前为<b>【{planName}】</b>，仅展示前 3 部分章节与部分点对点应答。白金版或企业版可解锁全量 7 大章节及无限次 Word 标书草案导出。
                    </span>
                  </div>
                  <Link
                    href="/pricing"
                    className="cursor-pointer shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-500 transition"
                  >
                    升级白金版 →
                  </Link>
                </div>
              )}

              {/* TAB 1: 标书 7 大章节大纲 */}
              {activeTab === "OUTLINE" && (
                <div className="space-y-3">
                  {data.sections.map((section, sIdx) => (
                    <div
                      key={sIdx}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-100">
                            {section.sectionNumber}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">
                            {section.title}
                          </h4>
                        </div>
                        <span className="text-xs text-slate-400">
                          {section.subSections.length} 个子模块
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mb-3 italic">
                        {section.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {section.subSections.map((sub, subIdx) => (
                          <div
                            key={subIdx}
                            className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 hover:bg-white hover:shadow-xs transition"
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="font-semibold text-xs text-indigo-600">
                                {sub.subNumber}
                              </span>
                              <span className="font-semibold text-xs text-slate-800">
                                {sub.title}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed mb-2">
                              {sub.contentGuide}
                            </p>
                            {sub.suggestedTables && sub.suggestedTables.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                                <span className="text-slate-400">建议表头:</span>
                                {sub.suggestedTables.map((th, thIdx) => (
                                  <span
                                    key={thIdx}
                                    className="rounded bg-slate-200/70 px-1.5 py-0.5 text-slate-700"
                                  >
                                    {th}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 2: 点对点逐条应答表 */}
              {activeTab === "MATRIX" && (
                <div className="space-y-3">
                  {/* 过滤按钮组 */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">筛选维度:</span>
                    <button
                      type="button"
                      onClick={() => setMatrixFilter("ALL")}
                      className={`cursor-pointer px-2.5 py-1 rounded-md transition ${
                        matrixFilter === "ALL"
                          ? "bg-slate-800 text-white font-semibold"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      全部条款 ({data.pointToPointMatrix.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixFilter("STAR")}
                      className={`cursor-pointer px-2.5 py-1 rounded-md transition ${
                        matrixFilter === "STAR"
                          ? "bg-rose-600 text-white font-semibold"
                          : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                    >
                      ★ 关键一票否决项 ({data.summary.starClausesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixFilter("TECHNICAL")}
                      className={`cursor-pointer px-2.5 py-1 rounded-md transition ${
                        matrixFilter === "TECHNICAL"
                          ? "bg-blue-600 text-white font-semibold"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      技术规格 ({data.summary.technicalPointsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixFilter("COMMERCIAL")}
                      className={`cursor-pointer px-2.5 py-1 rounded-md transition ${
                        matrixFilter === "COMMERCIAL"
                          ? "bg-indigo-600 text-white font-semibold"
                          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      商务条款 ({data.summary.commercialPointsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixFilter("QUALIFICATION")}
                      className={`cursor-pointer px-2.5 py-1 rounded-md transition ${
                        matrixFilter === "QUALIFICATION"
                          ? "bg-emerald-600 text-white font-semibold"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      资格审查 ({data.summary.qualificationPointsCount})
                    </button>
                  </div>

                  {/* 表格容器 */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold">
                        <tr>
                          <th className="px-3 py-2.5 text-center w-12">序号</th>
                          <th className="px-3 py-2.5 text-left w-24">条款类型</th>
                          <th className="px-3 py-2.5 text-left">招标文件要求</th>
                          <th className="px-3 py-2.5 text-center w-28">投标应答承诺</th>
                          <th className="px-3 py-2.5 text-left">响应方案与承诺说明</th>
                          <th className="px-3 py-2.5 text-left w-48">佐证材料指引</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredMatrix.map((item: PointToPointResponseItem) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                              {item.index}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                  item.clauseType === "QUALIFICATION"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : item.clauseType === "COMMERCIAL"
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {item.typeLabel}
                              </span>
                              {item.isStarClause && (
                                <span className="ml-1 text-[11px] font-bold text-rose-600">
                                  ★
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {item.tenderRequirement}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                                  item.responseCommitment === "POSITIVE_DEVIATION"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-blue-100 text-primary"
                                }`}
                              >
                                {item.commitmentLabel}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {item.responseDetail}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 text-[11px]">
                              {item.proofDocGuide}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: 编制分工与封标自查清单 */}
              {activeTab === "CHECKLIST" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 分工建议 */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ClipboardIcon className="h-4 w-4 text-indigo-600" />
                      标书编制团队角色分派建议
                    </h4>
                    <ul className="space-y-2.5 text-xs text-slate-600">
                      <li className="flex items-start gap-2">
                        <span className="rounded bg-indigo-100 text-indigo-800 px-1.5 py-0.5 font-bold shrink-0">
                          商务/法务
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">第一部分 & 第二部分（法务与资质）</p>
                          <p className="text-slate-500 mt-0.5">负责营业执照、授权委托书、近 3 年审计报告、纳税社保证明及信用中国截图。</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="rounded bg-blue-100 text-primary px-1.5 py-0.5 font-bold shrink-0">
                          售前技术
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">第五部分 & 第六部分（技术方案与实施）</p>
                          <p className="text-slate-500 mt-0.5">负责技术规格点对点逐条偏离表、系统架构图、产品检验报告及人员驻场排期。</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 font-bold shrink-0">
                          商务报价
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">第三部分 & 第四部分（报价与商务响应）</p>
                          <p className="text-slate-500 mt-0.5">结合下浮率精算罗盘确定开标一览表总价、分项报价明细表及交付付款承诺。</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 font-bold shrink-0">
                          项目总监
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">第七部分 & 封标总审</p>
                          <p className="text-slate-500 mt-0.5">负责售后维保承诺及标前 16 项高频废标红线一票否决合规体检交叉审核。</p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* 封标自查清单 */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                      封标递交前 8 项必检红线清单
                    </h4>
                    <div className="space-y-2 text-xs text-slate-700">
                      {[
                        "所有投标文件的盖章处是否均加盖了与投标主体一致的公章/电子签章？",
                        "法定代表人授权委托书中的委托期限是否覆盖了 90 天投标有效期？",
                        "开标一览表中的大小写金额是否完全一致且未超出最高限价/预算金额？",
                        "技术参数偏离表中所有“★”星标条款是否全部填报为“无偏离”并附带佐证页码？",
                        "社保证明与近 3 年无重大违法记录声明函落款日期是否符合招标文件时效规定？",
                        "若享受中小企业价格扣除，声明函所勾选的企业类型及从业人数是否真实合规？",
                        "投标文件正本、副本及电子 U 盘封装包装是否按照招标文件密封要求单独标记？",
                        "已通过平台【合规体检】模块核查，确认未触发 16 项法定一票否决红线。",
                      ].map((chk, cIdx) => (
                        <div key={cIdx} className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-50">
                          <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{chk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部操作控制台 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-slate-100 bg-slate-50/90 text-xs">
          <div className="text-slate-500">
            提示：导出的 Word 文档包含标准格式目录与预置应答表格，可由项目团队在本地分工协同撰写。
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              关闭
            </button>
            <a
              href={`/api/tenders/${tenderId}/export/proposal-doc`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 font-semibold text-white hover:bg-indigo-500 transition shadow-xs"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>下载 Word 标书草案文档</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
