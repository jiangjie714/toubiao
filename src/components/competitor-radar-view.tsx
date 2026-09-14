"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  RadarIcon,
  TargetIcon,
  TrophyIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
  ArrowDownTrayIcon,
  ClipboardIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  SparklesIcon,
  BuildingIcon,
  ClockIcon,
  MapPinIcon,
  ArrowRightIcon,
} from "@/components/icons";
import {
  addCompetitorWatchAction,
  removeCompetitorWatchAction,
  updateCompetitorWatchAction,
  getHeadToHeadAction,
  exportCompetitorBriefingAction,
} from "@/app/actions/competitor-radar";
import {
  COMPETITOR_TAG_METAS,
  type CompetitorTag,
  type CompetitorRadarOverview,
  type HeadToHeadReport,
} from "@/lib/competitor-radar";

interface CompetitorRadarViewProps {
  initialOverview: CompetitorRadarOverview;
  userName: string;
}

export default function CompetitorRadarView({
  initialOverview,
  userName,
}: CompetitorRadarViewProps) {
  const [overview, setOverview] = useState<CompetitorRadarOverview>(initialOverview);
  const [activeTab, setActiveTab] = useState<"feed" | "watchlist" | "h2h" | "briefing">("feed");
  const [isPending, startTransition] = useTransition();

  // 弹窗与表单状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newTag, setNewTag] = useState<CompetitorTag>("CORE");
  const [newNotes, setNewNotes] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);

  // 正在编辑的对手备忘
  const [editingWatchId, setEditingWatchId] = useState<number | null>(null);
  const [editTag, setEditTag] = useState<CompetitorTag>("CORE");
  const [editNotes, setEditNotes] = useState("");

  // 同场遭遇战沙箱状态
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>(
    overview.watchlist[0]?.competitorName || ""
  );
  const [h2hReport, setH2HReport] = useState<HeadToHeadReport | null>(null);
  const [loadingH2H, setLoadingH2H] = useState(false);

  // 态势简报预览与导出
  const [briefingMd, setBriefingMd] = useState<string | null>(null);
  const [copyingBriefing, setCopyingBriefing] = useState(false);
  const [briefingMsg, setBriefingMsg] = useState<string | null>(null);

  // 筛选情报流
  const [feedFilter, setFeedFilter] = useState<"ALL" | "ALERTS" | "MEGA">("ALL");

  // 执行同场交锋分析
  const handleLoadH2H = (compName: string) => {
    setSelectedCompetitor(compName);
    setLoadingH2H(true);
    startTransition(async () => {
      const res = await getHeadToHeadAction(compName);
      if (res.success && res.data) {
        setH2HReport(res.data);
      }
      setLoadingH2H(false);
    });
  };

  // 添加新对手
  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) {
      setFormMsg("请输入企业名称");
      return;
    }
    setFormMsg(null);
    startTransition(async () => {
      const res = await addCompetitorWatchAction({
        competitorName: newCompName.trim(),
        tag: newTag,
        notes: newNotes,
      });

      if (!res.success) {
        setFormMsg(res.error || "添加失败");
        return;
      }

      setShowAddModal(false);
      setNewCompName("");
      setNewNotes("");
      // 重新刷新页面以获取更新的大盘
      window.location.reload();
    });
  };

  // 删除监控对手
  const handleRemove = (watchId: number, name: string) => {
    if (!confirm(`确定要取消对「${name}」的监控吗？`)) return;
    startTransition(async () => {
      const res = await removeCompetitorWatchAction(watchId);
      if (res.success) {
        setOverview((prev) => ({
          ...prev,
          totalWatchedCount: Math.max(0, prev.totalWatchedCount - 1),
          watchlist: prev.watchlist.filter((w) => w.id !== watchId),
        }));
      }
    });
  };

  // 保存备忘更新
  const handleSaveEdit = (watchId: number) => {
    startTransition(async () => {
      const res = await updateCompetitorWatchAction(watchId, {
        tag: editTag,
        notes: editNotes,
      });
      if (res.success) {
        setOverview((prev) => ({
          ...prev,
          watchlist: prev.watchlist.map((w) =>
            w.id === watchId ? { ...w, tag: editTag, notes: editNotes } : w
          ),
        }));
        setEditingWatchId(null);
      }
    });
  };

  // 导出/加载简报
  const handleLoadBriefing = () => {
    startTransition(async () => {
      const res = await exportCompetitorBriefingAction();
      if (res.success && res.content) {
        setBriefingMd(res.content);
      }
    });
  };

  // 复制简报
  const handleCopyBriefing = () => {
    if (!briefingMd) return;
    navigator.clipboard.writeText(briefingMd);
    setCopyingBriefing(true);
    setBriefingMsg("简报 Markdown 已成功复制到剪贴板");
    setTimeout(() => {
      setCopyingBriefing(false);
      setBriefingMsg(null);
    }, 2500);
  };

  // 下载简报为 .md 文件
  const handleDownloadBriefing = () => {
    if (!briefingMd) return;
    const blob = new Blob([briefingMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `竞对态势战略攻防简报_${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 过滤后的动态流
  const filteredFeeds = overview.recentFeeds.filter((f) => {
    if (feedFilter === "ALERTS") {
      return f.eventKind === "ENCROACHMENT" || f.eventKind === "DEEP_DISCOUNT";
    }
    if (feedFilter === "MEGA") {
      return f.eventKind === "MEGA_PROJECT";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 顶部标题栏与操作区 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white shadow-xs">
              <RadarIcon className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              企业招投标核心竞对动向雷达
            </h1>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
              M2 战略版
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            全网毫秒级捕获竞争对手中标态势、后院起火客户渗透警报、低价突袭折扣与同场竞技攻防沙箱。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/suppliers"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 transition-colors"
          >
            <BuildingIcon className="h-4 w-4 text-slate-500" />
            <span>全网供应商库</span>
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>添加监控对手</span>
          </button>
        </div>
      </div>

      {/* 核心大盘 KPI 卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">重点监控对手</span>
            <TargetIcon className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {overview.totalWatchedCount}
            </span>
            <span className="text-xs text-slate-500">家企业</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            我方企业：{overview.myCompanyName || "未完善企业档案"} · 席位: {userName}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">近30天对手中标总额</span>
            <TrophyIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              ¥{overview.last30DaysCompWinAmount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">万元</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            新增斩获标段 {overview.last30DaysTotalWins} 标
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">高危渗透/后院起火警报</span>
            <ShieldAlertIcon className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-rose-600 tnum">
              {overview.totalEncroachmentAlerts}
            </span>
            <span className="text-xs text-rose-600 font-medium">起严重渗透</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-600/90">
            对手中标您跟踪的重点发包单位
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">已捕获异动情报</span>
            <SparklesIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {overview.recentFeeds.length}
            </span>
            <span className="text-xs text-slate-500">条最新战报</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            支持一键导出公文级战略简报
          </div>
        </div>
      </div>

      {/* 选项卡导航 */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("feed")}
          className={`cursor-pointer flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "feed"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ClockIcon className="h-4 w-4" />
          <span>实时异动情报流</span>
          {overview.totalEncroachmentAlerts > 0 && (
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] text-white font-bold">
              {overview.totalEncroachmentAlerts} 警报
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("watchlist")}
          className={`cursor-pointer flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "watchlist"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <TargetIcon className="h-4 w-4" />
          <span>重点监控矩阵 ({overview.watchlist.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("h2h");
            if (!h2hReport && overview.watchlist[0]?.competitorName) {
              handleLoadH2H(overview.watchlist[0].competitorName);
            }
          }}
          className={`cursor-pointer flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "h2h"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowsRightLeftIcon className="h-4 w-4" />
          <span>同场遭遇战攻防沙箱</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("briefing");
            if (!briefingMd) {
              handleLoadBriefing();
            }
          }}
          className={`cursor-pointer flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "briefing"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ClipboardIcon className="h-4 w-4" />
          <span>战略态势周报导出</span>
        </button>
      </div>

      {/* Tab 1: 实时异动情报流 */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          {/* 筛选过滤条 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">情报类型筛选：</span>
              <button
                onClick={() => setFeedFilter("ALL")}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  feedFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                全部情报 ({overview.recentFeeds.length})
              </button>
              <button
                onClick={() => setFeedFilter("ALERTS")}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  feedFilter === "ALERTS"
                    ? "bg-rose-600 text-white font-semibold"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                高危警报 (后院起火/低价突袭)
              </button>
              <button
                onClick={() => setFeedFilter("MEGA")}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  feedFilter === "MEGA"
                    ? "bg-purple-600 text-white font-semibold"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                }`}
              >
                千万级/亿元大标
              </button>
            </div>
            <span className="text-xs text-slate-500">
              数据每日随全网采集任务自动更新
            </span>
          </div>

          {filteredFeeds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-12 text-center">
              <RadarIcon className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800">
                暂未检索到符合条件的动态情报
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                请在【重点监控矩阵】中添加核心关注的竞争对手，系统将自动穿透其中标记录。
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>立即添加监控对手</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeeds.map((feed) => (
                <div
                  key={feed.id}
                  className={`rounded-2xl border p-4 shadow-2xs transition-all ${
                    feed.eventKind === "ENCROACHMENT"
                      ? "border-rose-300 bg-rose-50/40"
                      : "border-slate-200 bg-surface hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${feed.eventBadgeCls}`}
                      >
                        {feed.eventBadgeText}
                      </span>
                      <Link
                        href={`/suppliers/${encodeURIComponent(feed.competitorName)}`}
                        className="cursor-pointer font-bold text-slate-900 hover:text-primary transition-colors text-sm"
                      >
                        {feed.competitorName}
                      </Link>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>发布日期：{feed.publishDate}</span>
                      {feed.provinceCode && (
                        <span className="flex items-center gap-0.5">
                          <MapPinIcon className="h-3 w-3 text-slate-400" />
                          <span>地区编码 {feed.provinceCode}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 标段名称与发包方 */}
                  <div className="mt-2.5">
                    <Link
                      href={`/tender/${feed.id}`}
                      className="cursor-pointer text-sm font-medium text-slate-800 hover:text-primary transition-colors line-clamp-2"
                    >
                      {feed.tenderTitle}
                    </Link>
                  </div>

                  {/* 后院起火特别提示卡 */}
                  {feed.encroachmentReason && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-100/60 px-3 py-2 text-xs font-semibold text-rose-800">
                      <ShieldAlertIcon className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>{feed.encroachmentReason}</span>
                    </div>
                  )}

                  {/* 商务标价与下浮率 */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-2.5 text-xs">
                    <div className="flex items-center gap-4 text-slate-600">
                      <span>
                        发包单位：
                        <strong className="text-slate-800">{feed.purchaser}</strong>
                      </span>
                      <span>
                        中标金额：
                        <strong className="text-amber-600 font-bold tnum">
                          {feed.awardAmount ? `¥${feed.awardAmount} 万元` : "未公示"}
                        </strong>
                      </span>
                      {feed.budgetAmount && (
                        <span>
                          最高限价：¥{feed.budgetAmount} 万元
                        </span>
                      )}
                      {feed.discountRate && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          折扣率：{feed.discountRate}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveTab("h2h");
                          handleLoadH2H(feed.competitorName);
                        }}
                        className="cursor-pointer text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <ArrowsRightLeftIcon className="h-3 w-3" />
                        <span>同场攻防PK</span>
                      </button>
                      <Link
                        href={`/tender/${feed.id}`}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span>查看公告详情</span>
                        <ArrowRightIcon className="h-3 w-3 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 重点监控矩阵 */}
      {activeTab === "watchlist" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              共监控 <strong>{overview.watchlist.length}</strong> 家竞争对手，可为对手打标签、记录内部战术备忘及查看战力全景。
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>添加对手</span>
            </button>
          </div>

          {overview.watchlist.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-12 text-center">
              <TargetIcon className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800">
                暂未添加重点监控对手
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                输入对手企业全称即可建立全天候雷达监控档案。
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>立即添加监控对手</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {overview.watchlist.map((item) => {
                const tagMeta = COMPETITOR_TAG_METAS[item.tag];
                const isEditing = editingWatchId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* 顶部标签与威胁徽章 */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-xs font-bold ${tagMeta.badgeCls}`}
                            >
                              {tagMeta.label}
                            </span>
                            {item.threatLevel === "HIGH" && (
                              <span className="rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 flex items-center gap-0.5">
                                <ShieldAlertIcon className="h-3 w-3" />
                                <span>高危威胁</span>
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/suppliers/${encodeURIComponent(item.competitorName)}`}
                            className="mt-2 block text-base font-bold text-slate-900 hover:text-primary transition-colors line-clamp-1"
                          >
                            {item.competitorName}
                          </Link>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setActiveTab("h2h");
                              handleLoadH2H(item.competitorName);
                            }}
                            title="同场攻防PK"
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary transition-colors"
                          >
                            <ArrowsRightLeftIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemove(item.id, item.competitorName)}
                            title="取消监控"
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* 关键战绩数据 */}
                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-2.5 text-center border border-slate-100">
                        <div>
                          <div className="text-[11px] text-slate-500">历史总中标</div>
                          <div className="mt-0.5 text-sm font-bold text-slate-800 tnum">
                            {item.totalWinsCount} 标
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">累计中标总额</div>
                          <div className="mt-0.5 text-sm font-bold text-amber-600 tnum">
                            ¥{item.totalWinAmount.toLocaleString()}万
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">近30天斩获</div>
                          <div className="mt-0.5 text-sm font-bold text-slate-900 tnum">
                            {item.last30DaysWinsCount} 标 / ¥{item.last30DaysWinAmount}万
                          </div>
                        </div>
                      </div>

                      {/* 客户渗透与战区说明 */}
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">客户渗透冲突：</span>
                          {item.encroachmentCount > 0 ? (
                            <span className="font-bold text-rose-600 flex items-center gap-1">
                              <ShieldAlertIcon className="h-3.5 w-3.5" />
                              <span>已渗透我方客户 {item.encroachmentCount} 次</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">暂无冲突</span>
                          )}
                        </div>
                        {item.topPurchasers.length > 0 && (
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="shrink-0 text-slate-500">主要发包方：</span>
                            <span className="truncate text-slate-800">
                              {item.topPurchasers.join("、")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 内部攻防战术备忘 */}
                      <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                对手标签分类
                              </label>
                              <select
                                value={editTag}
                                onChange={(e) => setEditTag(e.target.value as CompetitorTag)}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                              >
                                {Object.values(COMPETITOR_TAG_METAS).map((m) => (
                                  <option key={m.tag} value={m.tag}>
                                    {m.label} ({m.shortLabel})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                攻防备忘与对手打法记录
                              </label>
                              <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                rows={2}
                                placeholder="输入内部调研打法，如：常联络特定设计院控标、投标价格习惯紧贴预算等"
                                className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-primary focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingWatchId(null)}
                                className="cursor-pointer rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                className="cursor-pointer rounded bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-hover"
                              >
                                保存备忘
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-500 italic line-clamp-2">
                              战术备忘：{item.notes || "暂无内部备忘，点击编辑补充"}
                            </span>
                            <button
                              onClick={() => {
                                setEditingWatchId(item.id);
                                setEditTag(item.tag);
                                setEditNotes(item.notes || "");
                              }}
                              className="cursor-pointer shrink-0 text-xs font-medium text-primary hover:underline"
                            >
                              编辑备忘
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 卡片底栏操作按钮 */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <Link
                        href={`/suppliers/${encodeURIComponent(item.competitorName)}`}
                        className="cursor-pointer text-xs font-medium text-slate-600 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <span>穿透企业画像档案</span>
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>

                      <button
                        onClick={() => {
                          setActiveTab("h2h");
                          handleLoadH2H(item.competitorName);
                        }}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ArrowsRightLeftIcon className="h-3 w-3" />
                        <span>同场竞技PK</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: 同场遭遇战攻防沙箱 */}
      {activeTab === "h2h" && (
        <div className="space-y-5">
          {/* 选择对手选择器 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">目标竞技对手：</span>
                <select
                  value={selectedCompetitor}
                  onChange={(e) => handleLoadH2H(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-primary focus:outline-none"
                >
                  {overview.watchlist.map((w) => (
                    <option key={w.id} value={w.competitorName}>
                      {w.competitorName} ({COMPETITOR_TAG_METAS[w.tag].label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  我方对标主体：<strong>{overview.myCompanyName || "我方企业"}</strong>
                </span>
                <button
                  onClick={() => handleLoadH2H(selectedCompetitor)}
                  disabled={loadingH2H}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
                  <span>{loadingH2H ? "正在穿透交锋战报..." : "重新对标"}</span>
                </button>
              </div>
            </div>
          </div>

          {loadingH2H ? (
            <div className="rounded-2xl border border-slate-200 bg-surface p-12 text-center text-slate-500 text-sm">
              正在穿透全网公共资源交易库，计算双方交锋与客户重合数据...
            </div>
          ) : h2hReport ? (
            <div className="space-y-5">
              {/* 双方战绩对比卡 */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary uppercase">我方战绩</span>
                    <ShieldCheckIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {h2hReport.myCompanyName}
                  </div>
                  <div className="mt-3 flex items-baseline gap-4">
                    <div>
                      <div className="text-xs text-slate-500">历史中标数</div>
                      <div className="text-xl font-bold text-slate-800 tnum">
                        {h2hReport.myTotalWins} 标
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">中标累计总额</div>
                      <div className="text-xl font-bold text-primary tnum">
                        ¥{h2hReport.myTotalAmount.toLocaleString()} 万元
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-700 uppercase">目标对手战绩</span>
                    <ShieldAlertIcon className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {h2hReport.competitorName}
                  </div>
                  <div className="mt-3 flex items-baseline gap-4">
                    <div>
                      <div className="text-xs text-slate-500">历史中标数</div>
                      <div className="text-xl font-bold text-slate-800 tnum">
                        {h2hReport.compTotalWins} 标
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">中标累计总额</div>
                      <div className="text-xl font-bold text-rose-600 tnum">
                        ¥{h2hReport.compTotalAmount.toLocaleString()} 万元
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 共同争夺的发包方客群分析 */}
              <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="h-4.5 w-4.5 text-primary" />
                    <h3 className="text-sm font-bold text-slate-900">
                      正面交锋客群：共同争夺的发包方单位 ({h2hReport.totalSharedPurchasersCount})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    双方均在此采购机构处斩获过标段
                  </span>
                </div>

                {h2hReport.sharedPurchasers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    暂未在历史开标记录中发现两家企业直接重叠的采购人，当前两家处于错位竞争态势。
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-slate-100">
                    {h2hReport.sharedPurchasers.map((sp, idx) => (
                      <div key={idx} className="py-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-slate-800">
                            {sp.purchaser}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                            对手近期中标标段：{sp.latestTenderTitle}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span className="text-primary">我方获标 {sp.myWins} 次</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-rose-600">对手获标 {sp.compWins} 次</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium">
                            {sp.myWins > sp.compWins
                              ? "我方主场占优"
                              : sp.myWins === sp.compWins
                              ? "旗鼓相当"
                              : "对手处于上风"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 战术攻防建议 */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-2xs">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <SparklesIcon className="h-4.5 w-4.5 text-amber-600" />
                  <span>智能推演：针对该对手的招投标攻防建议</span>
                </div>
                <div className="mt-3 space-y-2 text-xs text-amber-950">
                  {h2hReport.tacticalSuggestions.map((sug, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-800">
                        {i + 1}
                      </span>
                      <p className="leading-relaxed">{sug}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Tab 4: 战略态势周报 */}
      {activeTab === "briefing" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                公文级竞对态势战略攻防简报
              </h3>
              <p className="text-xs text-slate-500">
                自动聚合全部监控对手的中标趋势、后院起火严重渗透与攻防建议，供销售例会与高管决策。
              </p>
            </div>

            <div className="flex items-center gap-2">
              {briefingMsg && (
                <span className="text-xs text-emerald-600 font-medium">
                  {briefingMsg}
                </span>
              )}
              <button
                onClick={handleCopyBriefing}
                className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <ClipboardIcon className="h-3.5 w-3.5" />
                <span>{copyingBriefing ? "已复制" : "复制简报 Markdown"}</span>
              </button>
              <button
                onClick={handleDownloadBriefing}
                className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover transition-colors"
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                <span>下载 .md 简报文件</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-slate-100 shadow-inner overflow-x-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {briefingMd || "正在生成公文级态势简报..."}
            </pre>
          </div>
        </div>
      )}

      {/* 添加监控对手弹窗 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <TargetIcon className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900">
                  添加重点监控竞争对手
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCompetitor} className="mt-4 space-y-4">
              {formMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                  {formMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  对手企业全称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="例如：东软集团股份有限公司、华为技术有限公司"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  建议使用企业工商核准登记全称，以便高精度匹配全网中标结果。
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  竞争对手战术分类
                </label>
                <select
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value as CompetitorTag)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {Object.values(COMPETITOR_TAG_METAS).map((m) => (
                    <option key={m.tag} value={m.tag}>
                      {m.label} - {m.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  内部战术备忘 / 对手打法特征 (选填)
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="记录该对手的常见联合体搭档、投标下浮折扣率、公关习惯或我方应对策略"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>{isPending ? "正在添加..." : "确认添加监控"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
