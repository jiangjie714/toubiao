"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChartBarIcon,
  TrophyIcon,
  UsersIcon,
  BoltIcon,
  ClipboardIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  PIPELINE_STAGES,
  type PipelineCrmOverview,
  type RawDealItem,
  extractDealAmountWan,
  extractDealWinRate,
} from "@/lib/pipeline-crm";
import {
  claimPublicDealAction,
  returnToPublicPoolAction,
  updateDealCommercialAction,
  getPipelineCrmDataAction,
} from "@/app/actions/pipeline-crm";
import { formatDate } from "@/lib/constants";

interface Props {
  initialData: PipelineCrmOverview & {
    currentMode: "team" | "personal";
    hasTeam: boolean;
    teamName?: string;
    teamMembers: Array<{ userId: number; username: string; role: string }>;
  };
}

export default function PipelineCrmView({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [, startTransition] = useTransition();

  const [mode, setMode] = useState<"team" | "personal">(initialData.currentMode);
  const [timeSpan, setTimeSpan] = useState<"ALL" | "MONTH" | "QUARTER" | "YEAR">("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");

  // Tab 切换: FUNNEL (漏斗视图) | LEADERBOARD (销售琅琊榜) | OPEN_POOL (公海池) | DEALS (商机明细)
  const [activeTab, setActiveTab] = useState<"FUNNEL" | "LEADERBOARD" | "OPEN_POOL" | "DEALS">("FUNNEL");

  // 编辑商机弹窗
  const [editingDeal, setEditingDeal] = useState<RawDealItem | null>(null);
  const [editTargetAmt, setEditTargetAmt] = useState<string>("");
  const [editWinRate, setEditWinRate] = useState<number>(30);
  const [editNotes, setEditNotes] = useState<string>("");

  const refreshData = (
    nextMode = mode,
    nextTimeSpan = timeSpan,
    nextAssignee = selectedAssignee
  ) => {
    startTransition(async () => {
      const res = await getPipelineCrmDataAction({
        mode: nextMode,
        timeSpan: nextTimeSpan,
        assignee: nextAssignee,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  const handleModeChange = (nextMode: "team" | "personal") => {
    setMode(nextMode);
    refreshData(nextMode, timeSpan, selectedAssignee);
  };

  const handleTimeSpanChange = (nextSpan: "ALL" | "MONTH" | "QUARTER" | "YEAR") => {
    setTimeSpan(nextSpan);
    refreshData(mode, nextSpan, selectedAssignee);
  };

  const handleAssigneeChange = (nextAssignee: string) => {
    setSelectedAssignee(nextAssignee);
    refreshData(mode, timeSpan, nextAssignee);
  };

  const handleClaim = (dealId: number) => {
    startTransition(async () => {
      await claimPublicDealAction(dealId);
      refreshData();
    });
  };

  const handleReturnPool = (dealId: number) => {
    if (!window.confirm("确定将该商机退回团队公海池供其他同事认领吗？")) return;
    startTransition(async () => {
      await returnToPublicPoolAction(dealId);
      refreshData();
    });
  };

  const openEditModal = (deal: RawDealItem) => {
    setEditingDeal(deal);
    setEditTargetAmt(extractDealAmountWan(deal).toString());
    setEditWinRate(extractDealWinRate(deal));
    setEditNotes(deal.notes || "");
  };

  const handleSaveDeal = () => {
    if (!editingDeal) return;
    startTransition(async () => {
      await updateDealCommercialAction(editingDeal.id, {
        targetAmount: parseFloat(editTargetAmt) || undefined,
        winRateScore: editWinRate,
        notes: editNotes,
      });
      setEditingDeal(null);
      refreshData();
    });
  };

  const { summary, funnelStages, leaderboard, openPoolDeals, allDeals } = data;

  return (
    <div className="space-y-6">
      {/* 顶部标题与控制面板 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <ChartBarIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                企业销售 CRM 与商机全生命周期漏斗
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                对标 Salesforce / 纷享销客：加权预期营收预测、阶段流转漏斗、销售业绩提成战绩与公海池流转
              </p>
            </div>
          </div>
        </div>

        {/* 顶部全局筛选条 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* 团队 / 个人 模式切换 */}
          {data.hasTeam && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-surface p-0.5">
              <button
                type="button"
                onClick={() => handleModeChange("team")}
                className={`cursor-pointer rounded-md px-3 py-1 font-medium transition ${
                  mode === "team" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                团队全景 ({data.teamName || "我的团队"})
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("personal")}
                className={`cursor-pointer rounded-md px-3 py-1 font-medium transition ${
                  mode === "personal" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                个人商机
              </button>
            </div>
          )}

          {/* 时间跨度 */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-surface p-0.5">
            {(
              [
                { key: "ALL", label: "全部周期" },
                { key: "MONTH", label: "本月" },
                { key: "QUARTER", label: "本季度" },
                { key: "YEAR", label: "本年" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTimeSpanChange(t.key)}
                className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition ${
                  timeSpan === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 责任人筛选 (团队模式下) */}
          {mode === "team" && data.teamMembers.length > 0 && (
            <select
              value={selectedAssignee}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-surface px-2.5 py-1 font-medium text-slate-700 outline-hidden focus:border-primary"
            >
              <option value="ALL">全部销售人员</option>
              <option value="OPEN_POOL">🌊 团队公海池</option>
              {data.teamMembers.map((m) => (
                <option key={m.userId} value={m.username}>
                  👤 {m.username} ({m.role === "OWNER" ? "负责人" : "成员"})
                </option>
              ))}
            </select>
          )}

          <Link
            href="/tracker"
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-surface px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-primary"
          >
            <ClipboardIcon className="h-3.5 w-3.5" />
            <span>推进看板</span>
          </Link>
        </div>
      </div>

      {/* 4 大核心销售 KPI 仪表卡片 */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/* 在途商机总盘 */}
        <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">在途商机总规模 (Pipeline)</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <BoltIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-slate-900 tnum">
              {summary.totalPipelineAmountWan.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">万元</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            涵盖 {summary.activeDeals} 个跟进阶段商机，平均单标 {summary.avgDealAmountWan} 万
          </div>
        </div>

        {/* 加权预期营收 */}
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900">加权预测营收 (Weighted)</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <SparklesIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-indigo-700 tnum">
              {summary.weightedExpectedRevenueWan.toLocaleString()}
            </span>
            <span className="text-xs text-indigo-500">万元</span>
          </div>
          <div className="mt-1 text-[11px] text-indigo-600/80">
            根据阶段概率测算：为管理层提供最准确的季度业绩指引
          </div>
        </div>

        {/* 累计中标赢单 */}
        <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">期内累计中标签约</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrophyIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-emerald-600 tnum">
              {summary.wonAmountWan.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">万元</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            综合中标胜率{" "}
            <span className="font-semibold text-slate-700 tnum">{summary.overallWinRate}%</span>
          </div>
        </div>

        {/* 团队公海池待认领 */}
        <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">销售公海池待认领</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <UsersIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-amber-600 tnum">
              {summary.openPoolCount}
            </span>
            <span className="text-xs text-slate-500">个标讯</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>未分配责任人标讯</span>
            <button
              type="button"
              onClick={() => setActiveTab("OPEN_POOL")}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              一键认领 →
            </button>
          </div>
        </div>
      </section>

      {/* Tab 导航 */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-sm">
          {(
            [
              { id: "FUNNEL", label: "📊 销售漏斗流转与阶段转化", count: null },
              { id: "LEADERBOARD", label: "🏆 销售团队琅琊榜与提成预测", count: leaderboard.length },
              { id: "OPEN_POOL", label: "🌊 商机公海池 (开放抢单)", count: openPoolDeals.length },
              { id: "DEALS", label: "📋 全景商机台账", count: allDeals.length },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex cursor-pointer items-center gap-1.5 border-b-2 py-3 font-semibold transition ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active ? "bg-blue-100 text-primary" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 视图内容区 */}
      {activeTab === "FUNNEL" && (
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">招投标商机销售漏斗分析 (Sales Funnel)</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  各阶段商机存量、预期规模与阶梯转化率（找出团队投标流失的最大环节）
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-blue-500" />
                  阶段项目存量
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-indigo-500" />
                  加权预期金额
                </span>
              </div>
            </div>

            {/* 漏斗层级列表 */}
            <div className="mt-6 space-y-4">
              {funnelStages.map((stage, idx) => {
                const maxCount = Math.max(1, ...funnelStages.map((s) => s.count));
                const widthPercent = Math.max(15, Math.round((stage.count / maxCount) * 100));
                const stageConf = PIPELINE_STAGES.find((s) => s.status === stage.status);

                return (
                  <div key={stage.status} className="relative rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-slate-50">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      {/* 阶段名称与说明 */}
                      <div className="w-48 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${stageConf?.badgeBg}`}>
                            {stage.label}
                          </span>
                          <span className="text-xs text-slate-400">({stageConf?.defaultWinRate}%)</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 truncate">
                          {stageConf?.description}
                        </div>
                      </div>

                      {/* 漏斗横条 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-700">
                            {stage.count} 个项目 · {stage.totalAmountWan.toLocaleString()} 万元
                          </span>
                          <span className="font-medium text-indigo-600 tnum">
                            加权折算: {stage.weightedAmountWan.toLocaleString()} 万元
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* 转化率与滞留周期指标 */}
                      <div className="flex items-center gap-6 shrink-0 md:pl-6 border-slate-200 md:border-l text-center">
                        <div>
                          <div className="text-[11px] text-slate-400">上阶转化</div>
                          <div className={`text-sm font-bold tnum ${idx === 0 ? "text-slate-400" : stage.conversionRateFromPrev >= 60 ? "text-emerald-600" : "text-rose-600"}`}>
                            {idx === 0 ? "100%" : `${stage.conversionRateFromPrev}%`}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">平均滞留</div>
                          <div className="text-sm font-bold text-slate-700 tnum">
                            {stage.avgDurationDays} 天
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeTab === "LEADERBOARD" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">销售代表个人战绩排行榜 (Sales Leaderboard)</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  按销售员汇总跟单体量、中标胜率与预估业务提成（默认提成比率：已赢单 1.8%，加权在途 0.3%）
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                    <th className="px-4 py-3 font-semibold">排名 / 销售员</th>
                    <th className="px-4 py-3 font-semibold text-center">在跟商机</th>
                    <th className="px-4 py-3 font-semibold text-right">在途规模 (万元)</th>
                    <th className="px-4 py-3 font-semibold text-right">加权预期 (万元)</th>
                    <th className="px-4 py-3 font-semibold text-center">赢/输单</th>
                    <th className="px-4 py-3 font-semibold text-right">累计中标额</th>
                    <th className="px-4 py-3 font-semibold text-center">胜率</th>
                    <th className="px-4 py-3 font-semibold text-right text-emerald-600">预估提成</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {leaderboard.map((rep, idx) => (
                    <tr key={rep.assignee} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 font-medium">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              idx === 0
                                ? "bg-amber-100 text-amber-800"
                                : idx === 1
                                ? "bg-slate-200 text-slate-800"
                                : idx === 2
                                ? "bg-orange-100 text-orange-800"
                                : "bg-slate-50 text-slate-500"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className={rep.isUnassigned ? "text-slate-400 italic" : "text-slate-900 font-semibold"}>
                            {rep.assignee}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700 tnum">
                        {rep.activeDealsCount} 个
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-700 tnum">
                        {rep.inPipelineAmountWan.toLocaleString()} 万
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-600 tnum">
                        {rep.weightedAmountWan.toLocaleString()} 万
                      </td>
                      <td className="px-4 py-3.5 text-center tnum">
                        <span className="text-emerald-600 font-semibold">{rep.wonDealsCount}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-rose-600">{rep.lostDealsCount}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 tnum">
                        {rep.totalWonAmountWan.toLocaleString()} 万
                      </td>
                      <td className="px-4 py-3.5 text-center tnum font-semibold">
                        {rep.winRatePercent}%
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 tnum">
                        ¥{(rep.estimatedCommissionWan * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "OPEN_POOL" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">商机公海池 (Open Lead Pool)</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  所有未指派明确销售专员的公开商机，所有成员均可快速“认领抢单”转入个人私海跟进
                </p>
              </div>
              <span className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
                当前公海商机: {openPoolDeals.length} 条
              </span>
            </div>

            {openPoolDeals.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                🎉 公海池已被全部认领完毕，暂无闲置商机！
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                      <th className="px-4 py-3 font-semibold">标讯项目</th>
                      <th className="px-4 py-3 font-semibold">采购人 / 单位</th>
                      <th className="px-4 py-3 font-semibold text-right">预算 / 目标金额</th>
                      <th className="px-4 py-3 font-semibold text-center">状态</th>
                      <th className="px-4 py-3 font-semibold text-center">截标时间</th>
                      <th className="px-4 py-3 font-semibold text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {openPoolDeals.map((deal) => {
                      const stageConf = PIPELINE_STAGES.find((s) => s.status === deal.status);
                      return (
                        <tr key={deal.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3.5 max-w-sm">
                            <Link
                              href={`/tender/${deal.tender.id}`}
                              target="_blank"
                              className="font-medium text-slate-900 hover:text-primary transition line-clamp-1"
                            >
                              {deal.tender.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 truncate max-w-xs">
                            {deal.tender.purchaser || "公开招标单位"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-900 tnum">
                            {extractDealAmountWan(deal)} 万元
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${stageConf?.badgeBg}`}>
                              {stageConf?.shortLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-500 tnum">
                            {deal.tender.expireDate ? formatDate(deal.tender.expireDate) : "待公布"}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleClaim(deal.id)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 py-1 font-semibold text-white shadow-xs transition hover:bg-primary-strong"
                            >
                              <BoltIcon className="h-3 w-3" />
                              <span>立即认领</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "DEALS" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">全量销售商机台账 (Deal Ledger)</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  支持快捷调整预期目标报价、阶段赢率预测，以及退回公海等流转操作
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                    <th className="px-4 py-3 font-semibold">项目名称</th>
                    <th className="px-4 py-3 font-semibold">责任人</th>
                    <th className="px-4 py-3 font-semibold text-right">目标报价 (万)</th>
                    <th className="px-4 py-3 font-semibold text-center">阶段 / 赢率</th>
                    <th className="px-4 py-3 font-semibold text-right">加权折算 (万)</th>
                    <th className="px-4 py-3 font-semibold text-center">截标倒计时</th>
                    <th className="px-4 py-3 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {allDeals.map((deal) => {
                    const stageConf = PIPELINE_STAGES.find((s) => s.status === deal.status);
                    const amt = extractDealAmountWan(deal);
                    const winRate = extractDealWinRate(deal);
                    const weighted = (amt * winRate) / 100;

                    return (
                      <tr key={deal.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5 max-w-sm">
                          <Link
                            href={`/tender/${deal.tender.id}`}
                            target="_blank"
                            className="font-semibold text-slate-900 hover:text-primary transition line-clamp-1"
                          >
                            {deal.tender.title}
                          </Link>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {deal.tender.purchaser || "公开招标"}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700">
                          {deal.assignee || <span className="text-amber-600 italic">公海池待认领</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900 tnum">
                          {amt} 万
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${stageConf?.badgeBg}`}>
                              {stageConf?.shortLabel}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-600 tnum">
                              {winRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-indigo-600 tnum">
                          {weighted.toFixed(1)} 万
                        </td>
                        <td className="px-4 py-3.5 text-center text-slate-500 tnum">
                          {deal.tender.expireDate ? formatDate(deal.tender.expireDate) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(deal)}
                              className="cursor-pointer font-medium text-primary hover:underline"
                            >
                              调商机
                            </button>
                            {deal.assignee && (
                              <button
                                type="button"
                                onClick={() => handleReturnPool(deal.id)}
                                className="cursor-pointer font-medium text-slate-400 hover:text-rose-600"
                              >
                                退公海
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 调整商机目标与赢率弹窗 */}
      {editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              调整商机商业目标 · {editingDeal.tender.title.slice(0, 16)}...
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              修改拟投标报价或赢率预估，系统将实时重算加权预测营收
            </p>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700">拟投标报价 / 目标金额 (万元)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editTargetAmt}
                  onChange={(e) => setEditTargetAmt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-primary outline-hidden"
                  placeholder="例如: 85.5"
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-700">预估中标概率 (赢率 %)</label>
                  <span className="font-bold text-primary tnum">{editWinRate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editWinRate}
                  onChange={(e) => setEditWinRate(parseInt(e.target.value, 10))}
                  className="mt-2 w-full accent-primary"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">阶段备忘与攻防要点</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-primary outline-hidden"
                  placeholder="客情关系、竞对动向、封标降价策略等"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingDeal(null)}
                className="cursor-pointer rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveDeal}
                className="cursor-pointer rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong"
              >
                保存调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
