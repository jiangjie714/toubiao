"use client";

import React, { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  BookmarkIcon,
  ClockIcon,
  BuildingIcon,
  TrashIcon,
  UsersIcon,
  ChatBubbleIcon,
  PlusIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  SparklesIcon,
  ScaleIcon,
} from "@/components/icons";
import BidWarRoomModal from "@/components/bid-war-room-modal";
import BidReviewModal from "@/components/bid-review-modal";
import {
  getTrackerBoardAction,
  updateFollowStatusAction,
  deleteFollowAction,
  assignFollowMemberAction,
  addFollowCommentAction,
  type FollowStatus,
  type TrackerBoardData,
  type TenderFollowItem,
  type CommentCategory,
} from "@/app/actions/tender-follow";
import { tenderTypeLabel, tenderTypeColor, formatDate } from "@/lib/constants";

const LANES: Array<{ status: FollowStatus; title: string; color: string; desc: string }> = [
  { status: "EVALUATING", title: "🔍 线索评估中", color: "border-blue-300 bg-blue-50/40 text-blue-900", desc: "商机初筛与可行性论证" },
  { status: "DECIDED", title: "📝 决定投标", color: "border-indigo-300 bg-indigo-50/40 text-indigo-900", desc: "已立项并启动商务技术筹备" },
  { status: "DRAFTING", title: "🛠️ 标书编制中", color: "border-amber-300 bg-amber-50/40 text-amber-900", desc: "撰写技术方案与商务封标" },
  { status: "SUBMITTED", title: "📤 已递交待开标", color: "border-purple-300 bg-purple-50/40 text-purple-900", desc: "已送达/上传，等待唱标" },
  { status: "WON", title: "🏆 中标喜报", color: "border-emerald-300 bg-emerald-50/40 text-emerald-900", desc: "成功中标落地签约" },
];

const CATEGORY_MAP: Record<CommentCategory, { label: string; color: string }> = {
  GENERAL: { label: "普通备忘", color: "bg-slate-100 text-slate-700" },
  RISK: { label: "⚠️ 风险预警", color: "bg-amber-100 text-amber-800" },
  COMPLIANCE: { label: "🚨 合规一票否决", color: "bg-rose-100 text-rose-800" },
  ASSIGNMENT: { label: "📌 任务分派", color: "bg-blue-100 text-primary" },
};

interface Props {
  initialData: TrackerBoardData;
}

export default function TrackerKanbanView({ initialData }: Props) {
  const [boardData, setBoardData] = useState<TrackerBoardData>(initialData);
  const [isPending, startTransition] = useTransition();

  // 看板模式: "team" (团队共享) | "personal" (个人看板)
  const [viewMode, setViewMode] = useState<"team" | "personal">(initialData.currentMode);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");

  // 协同批注与详情抽屉
  const [activeItem, setActiveItem] = useState<TenderFollowItem | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [commentCat, setCommentCat] = useState<CommentCategory>("GENERAL");
  const [commentError, setCommentError] = useState("");

  // 预警筛选: "ALL" | "CRITICAL_DEADLINE" | "LIFECYCLE_UPDATE"
  const [filterAlert, setFilterAlert] = useState<"ALL" | "CRITICAL_DEADLINE" | "LIFECYCLE_UPDATE">("ALL");

  // 作战指挥室 Modal
  const [warRoomFollowId, setWarRoomFollowId] = useState<number | null>(null);

  // 复盘归因 Modal
  const [reviewFollowId, setReviewFollowId] = useState<number | null>(null);

  const fetchBoard = useCallback(
    (mode: "team" | "personal" = viewMode, assignee: string = selectedAssignee) => {
      startTransition(async () => {
        try {
          const res = await getTrackerBoardAction({
            mode,
            assigneeFilter: assignee,
          });
          if (res.success && res.data) {
            setBoardData(res.data);
            if (activeItem) {
              const refreshed = res.data.items.find((i) => i.id === activeItem.id);
              if (refreshed) setActiveItem(refreshed);
            }
          }
        } catch (err) {
          console.error("Failed to load tracker board", err);
        }
      });
    },
    [activeItem, viewMode, selectedAssignee],
  );

  const handleModeChange = (nextMode: "team" | "personal") => {
    setViewMode(nextMode);
    setSelectedAssignee("ALL");
    fetchBoard(nextMode, "ALL");
  };

  const handleAssigneeFilter = (assignee: string) => {
    setSelectedAssignee(assignee);
    fetchBoard(viewMode, assignee);
  };

  const handleStatusChange = (followId: number, nextStatus: FollowStatus) => {
    startTransition(async () => {
      await updateFollowStatusAction(followId, nextStatus);
      fetchBoard();
    });
  };

  const handleAssignMember = (followId: number, memberName: string) => {
    startTransition(async () => {
      await assignFollowMemberAction(followId, memberName);
      fetchBoard();
    });
  };

  const handleAddComment = () => {
    if (!activeItem || !commentInput.trim()) return;
    setCommentError("");

    startTransition(async () => {
      const res = await addFollowCommentAction({
        followId: activeItem.id,
        content: commentInput.trim(),
        category: commentCat,
      });

      if (!res.success) {
        setCommentError(res.error || "发表批注失败");
        return;
      }

      setCommentInput("");
      fetchBoard();
    });
  };

  const handleDelete = (followId: number) => {
    if (!confirm("确定将该标段从看板移除吗？")) return;
    startTransition(async () => {
      await deleteFollowAction(followId);
      if (activeItem?.id === followId) setActiveItem(null);
      fetchBoard();
    });
  };

  const stats = boardData.stats;
  const items = boardData.items || [];
  const teamMembers = boardData.teamMembers || [];
  const alertSummary = boardData.alertSummary || {
    criticalDeadlinesCount: 0,
    warningDeadlinesCount: 0,
    newClarificationsCount: 0,
    convertedIntentionsCount: 0,
    newResultsCount: 0,
  };
  const totalLifecycleAlerts =
    alertSummary.newClarificationsCount +
    alertSummary.convertedIntentionsCount +
    alertSummary.newResultsCount;

  const filteredItems = items.filter((it) => {
    if (filterAlert === "CRITICAL_DEADLINE") {
      return it.deadlineCountdown?.urgency === "CRITICAL";
    }
    if (filterAlert === "LIFECYCLE_UPDATE") {
      return Boolean(it.lifecycleAlert?.hasUpdate);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 顶栏标题与协同模式切换 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              投标商机协同推进看板 (Pipeline)
            </h1>
            {boardData.hasTeam ? (
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-primary">
                团队协同版
              </span>
            ) : (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                个人版
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            全生命周期推进商机：从线索评估、成员指派、标书编写到递交唱标与中标复盘，拒绝漏标
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/reviews"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            title="查看企业投标复盘与失标归因诊断罗盘"
          >
            <ScaleIcon className="h-3.5 w-3.5 text-primary" />
            <span>复盘归因大盘</span>
          </Link>
          <Link
            href="/list"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>发现新标讯</span>
          </Link>
        </div>
      </div>

      {/* 团队协同看板 vs 个人看板切换 & 成员筛选 */}
      {boardData.hasTeam && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleModeChange("team")}
              className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "team"
                  ? "bg-primary text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              <span>团队共享看板 ({boardData.teamName})</span>
            </button>

            <button
              onClick={() => handleModeChange("personal")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "personal"
                  ? "bg-primary text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              我的个人跟进
            </button>
          </div>

          {viewMode === "team" && teamMembers.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">负责人筛选:</span>
              <select
                value={selectedAssignee}
                onChange={(e) => handleAssigneeFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                <option value="ALL">全部团队成员 ({teamMembers.length} 人)</option>
                {teamMembers.map((m) => (
                  <option key={m.userId} value={m.username}>
                    {m.username} {m.title ? `(${m.title})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* 关键统计指标卡片 */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500">跟进标段总数</span>
            <p className="mt-1 text-xl font-bold text-slate-900 tnum">{stats.totalCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500">商机预算总池</span>
            <p className="mt-1 text-xl font-bold text-primary tnum">
              {stats.totalBudget >= 10000
                ? `${(stats.totalBudget / 10000).toFixed(2)} 亿元`
                : `${stats.totalBudget} 万元`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500">线索评估中</span>
            <p className="mt-1 text-xl font-bold text-blue-700 tnum">{stats.evaluatingCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500">标书编制中</span>
            <p className="mt-1 text-xl font-bold text-amber-700 tnum">{stats.draftingCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500">已递交待开标</span>
            <p className="mt-1 text-xl font-bold text-purple-700 tnum">{stats.submittedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs text-slate-500">成功中标</span>
            <p className="mt-1 text-xl font-bold text-emerald-700 tnum">{stats.wonCount}</p>
          </div>
        </div>
      )}

      {/* 截标倒计时与全生命周期变更即时预警中枢横幅 */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <AlertCircleIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm text-slate-900">
                截标倒计时与变更即时预警中枢
              </span>
              {alertSummary.criticalDeadlinesCount > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 animate-pulse">
                  🚨 {alertSummary.criticalDeadlinesCount} 个标段 ≤48h 截标冲刺
                </span>
              )}
              {totalLifecycleAlerts > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  📢 {totalLifecycleAlerts} 项捕获澄清答疑/变更
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              系统自动联动关联项目公告流：毫秒级捕获答疑澄清与最新补遗，动态监控封标截标时间节点
            </p>
          </div>
        </div>

        {/* 预警快筛切换器 */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterAlert("ALL")}
            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              filterAlert === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            全部 ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterAlert("CRITICAL_DEADLINE")}
            className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              filterAlert === "CRITICAL_DEADLINE"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            <span>🚨 48h 临期冲刺</span>
            <span className="rounded-full bg-rose-200/60 px-1.5 py-0.2 text-[10px] tnum">
              {alertSummary.criticalDeadlinesCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterAlert("LIFECYCLE_UPDATE")}
            className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              filterAlert === "LIFECYCLE_UPDATE"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <span>📢 澄清与答疑动态</span>
            <span className="rounded-full bg-amber-200/60 px-1.5 py-0.2 text-[10px] tnum">
              {totalLifecycleAlerts}
            </span>
          </button>
        </div>
      </div>

      {/* 敏捷看板泳道主体 */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary mb-3">
            <BookmarkIcon className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {viewMode === "team" ? "团队共享看板暂无标段" : "个人跟进暂无标段"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            在浏览招标公告详情时，点击右上角【加入投标跟进看板】，即可在团队内部共享并协同指派！
          </p>
          <div className="mt-5">
            <Link
              href="/list"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90"
            >
              立即前往检索标讯
            </Link>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2">
            <AlertCircleIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            当前筛选条件下暂无匹配标段
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            可点击上方“全部 ({items.length})”查看所有推进中的商机标段
          </p>
          <button
            type="button"
            onClick={() => setFilterAlert("ALL")}
            className="mt-4 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            清除预警筛选
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 items-start">
          {LANES.map((lane) => {
            const laneItems = filteredItems.filter((it) => it.status === lane.status);

            return (
              <div
                key={lane.status}
                className="flex flex-col rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 shadow-2xs min-h-[500px]"
              >
                {/* 泳道标题 */}
                <div className={`rounded-lg border px-3 py-2 ${lane.color}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{lane.title}</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">
                      {laneItems.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] opacity-75">{lane.desc}</p>
                </div>

                {/* 泳道卡片列表 */}
                <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto">
                  {laneItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all text-xs"
                    >
                      {/* 截标倒计时与更正答疑动态预警徽章 */}
                      {(item.deadlineCountdown || item.lifecycleAlert?.hasUpdate) && (
                        <div className="mb-2 space-y-1.5">
                          {/* 截标倒计时 */}
                          {item.deadlineCountdown && !item.deadlineCountdown.isDeadlinePassed && (
                            <div
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${item.deadlineCountdown.badgeColor}`}
                            >
                              <ClockIcon className="h-3 w-3 shrink-0" />
                              <span>{item.deadlineCountdown.badgeLabel}</span>
                            </div>
                          )}

                          {/* 项目全生命周期变更/更正澄清/结果动态 */}
                          {item.lifecycleAlert?.hasUpdate && (
                            <button
                              type="button"
                              onClick={() => setActiveItem(item)}
                              className="w-full text-left cursor-pointer rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 p-2 border border-amber-200/80 hover:border-amber-400 transition-all"
                            >
                              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                                <span>{item.lifecycleAlert.updateLabel}</span>
                                {item.lifecycleAlert.latestNoticeDate && (
                                  <span className="text-[10px] text-amber-700 font-normal">
                                    {item.lifecycleAlert.latestNoticeDate}
                                  </span>
                                )}
                              </div>
                              {item.lifecycleAlert.latestNoticeTitle && (
                                <p className="mt-0.5 text-[11px] text-slate-700 line-clamp-1">
                                  {item.lifecycleAlert.latestNoticeTitle}
                                </p>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* 立项决策徽章与作战室入口 */}
                      <div className="mb-2 flex items-center justify-between gap-1">
                        {item.evaluation ? (
                          <button
                            type="button"
                            onClick={() => setWarRoomFollowId(item.id)}
                            className={`cursor-pointer inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border transition ${
                              item.evaluation.decision === "GO"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                : item.evaluation.decision === "NO_GO"
                                ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                                : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                            }`}
                            title="点击打开作战指挥室查看四维评审结论"
                          >
                            <span>
                              {item.evaluation.decision === "GO"
                                ? "🟢 建议投标"
                                : item.evaluation.decision === "NO_GO"
                                ? "🔴 建议放弃"
                                : "🟡 审慎跟进"}
                            </span>
                            <span className="font-mono">({item.evaluation.overallScore}分)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setWarRoomFollowId(item.id)}
                            className="cursor-pointer inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 transition"
                            title="点击进行多维立项评估与Go/No-Go判定"
                          >
                            <span>⚖️ 待立项评审</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setWarRoomFollowId(item.id)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition"
                          title="进入三流合一协同作战指挥室"
                        >
                          <SparklesIcon className="h-3 w-3 text-blue-600" />
                          <span>作战室 →</span>
                        </button>
                      </div>

                      {/* 开标复盘归因状态 */}
                      {(item.review || item.status === "WON" || item.status === "LOST") && (
                        <div className="mb-2 flex items-center justify-between gap-1">
                          {item.review ? (
                            <button
                              type="button"
                              onClick={() => setReviewFollowId(item.id)}
                              className="cursor-pointer inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                              title="点击查看/调整开标复盘与失分归因"
                            >
                              <ScaleIcon className="h-3 w-3 text-purple-600" />
                              <span>
                                {item.review.outcome === "WON" ? "已复盘(中标)" : "已归因(失标)"}
                              </span>
                              {item.review.priceGapPercent !== null && (
                                <span className="font-mono">
                                  ({Number(item.review.priceGapPercent) > 0 ? "+" : ""}{item.review.priceGapPercent}%)
                                </span>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReviewFollowId(item.id)}
                              className="cursor-pointer inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition animate-pulse"
                              title="已结案项目，点击进行成败归因与经验复盘"
                            >
                              <ScaleIcon className="h-3 w-3 text-rose-600" />
                              <span>待复盘归因 +</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setReviewFollowId(item.id)}
                            className="cursor-pointer inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-800 transition"
                          >
                            <span>诊断报告 →</span>
                          </button>
                        </div>
                      )}

                      {/* 类型与金额 */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-medium ring-1 ring-inset ${tenderTypeColor(
                            item.tender.type,
                          )}`}
                        >
                          {tenderTypeLabel(item.tender.type)}
                        </span>

                        {item.tender.budgetAmount ? (
                          <span className="font-bold text-primary tnum">
                            {item.tender.budgetAmount} 万元
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">未标明预算</span>
                        )}
                      </div>

                      {/* 标书标题 */}
                      <Link
                        href={`/tender/${item.tender.id}`}
                        className="font-bold text-slate-900 hover:text-primary leading-snug line-clamp-2 block transition-colors"
                        title={item.tender.title}
                      >
                        {item.tender.title}
                      </Link>

                      {/* 采购人 */}
                      {item.tender.purchaser && (
                        <div className="mt-2 flex items-center gap-1 text-slate-500 truncate">
                          <BuildingIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.tender.purchaser}</span>
                        </div>
                      )}

                      {/* 截止时间 */}
                      {item.tender.expireDate && (
                        <div className="mt-1 flex items-center gap-1 text-slate-500">
                          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                          <span>截止：{formatDate(item.tender.expireDate)}</span>
                        </div>
                      )}

                      {/* 团队协同信息：指派人与批注徽章 */}
                      <div className="mt-2.5 flex items-center justify-between rounded bg-slate-50 p-2 border border-slate-100 text-[11px]">
                        <div className="flex items-center gap-1 truncate text-slate-700">
                          <span className="text-slate-400">👤</span>
                          <span className="font-medium truncate">
                            {item.assignee ? `@${item.assignee}` : "待指派"}
                          </span>
                        </div>

                        <button
                          onClick={() => setActiveItem(item)}
                          className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
                        >
                          <ChatBubbleIcon className="h-3 w-3" />
                          <span>{item.commentsCount} 批注</span>
                        </button>
                      </div>

                      {/* 快捷操作底栏 */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <select
                          value={item.status}
                          disabled={isPending}
                          onChange={(e) =>
                            handleStatusChange(item.id, e.target.value as FollowStatus)
                          }
                          className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden"
                        >
                          <option value="EVALUATING">评估中</option>
                          <option value="DECIDED">决定投标</option>
                          <option value="DRAFTING">编制标书</option>
                          <option value="SUBMITTED">已递交</option>
                          <option value="WON">中标</option>
                          <option value="LOST">失标</option>
                        </select>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewFollowId(item.id)}
                            className="cursor-pointer text-[11px] font-semibold text-purple-600 hover:text-purple-800"
                            title="打开开标复盘诊断"
                          >
                            复盘
                          </button>
                          <Link
                            href={`/tender/${item.tender.id}`}
                            className="text-primary hover:underline font-semibold"
                            title="进入标书详情与编制应答助手"
                          >
                            标书编制 →
                          </Link>
                          <button
                            onClick={() => handleDelete(item.id)}
                            title="移出看板"
                            className="cursor-pointer text-slate-400 hover:text-rose-600 p-1"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {laneItems.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-[11px]">
                      暂无项目
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 协同批注与详情抽屉 Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            {/* 顶部标题 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <ChatBubbleIcon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    商机协同批注与任务分派
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    创建人: {activeItem.creatorName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* 标段概况卡片 */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs">
              <div className="font-bold text-slate-900 leading-snug">
                {activeItem.tender.title}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-slate-500 text-[11px]">
                {activeItem.tender.purchaser && (
                  <span>采购人: {activeItem.tender.purchaser}</span>
                )}
                {activeItem.tender.budgetAmount && (
                  <span className="font-bold text-primary tnum">
                    预算: {activeItem.tender.budgetAmount} 万元
                  </span>
                )}
                <Link
                  href={`/tender/${activeItem.tender.id}`}
                  className="text-primary hover:underline font-semibold"
                >
                  查看完整公告与 AI 标书大纲 →
                </Link>
              </div>

              {/* 快速指派跟进人 */}
              {teamMembers.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-slate-600 font-medium text-[11px]">
                    指派团队责任人:
                  </span>
                  <select
                    value={activeItem.assignee || ""}
                    onChange={(e) => handleAssignMember(activeItem.id, e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                  >
                    <option value="">未指派</option>
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.username}>
                        {m.username} {m.title ? `(${m.title})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 截标倒计时协同卡片 */}
            {activeItem.deadlineCountdown && (
              <div
                className={`mt-3 rounded-xl p-3 border text-xs ${
                  activeItem.deadlineCountdown.urgency === "CRITICAL"
                    ? "bg-rose-50/80 border-rose-200 text-rose-950"
                    : activeItem.deadlineCountdown.urgency === "WARNING"
                    ? "bg-amber-50/80 border-amber-200 text-amber-950"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ClockIcon className="h-4 w-4 shrink-0 text-slate-600" />
                    <span>{activeItem.deadlineCountdown.badgeLabel}</span>
                  </div>
                  <span className="font-extrabold tnum">
                    {activeItem.deadlineCountdown.isDeadlinePassed
                      ? "已截止"
                      : activeItem.deadlineCountdown.diffHours <= 48
                      ? `🚨 剩余 ${activeItem.deadlineCountdown.diffHours} 小时`
                      : `剩余 ${activeItem.deadlineCountdown.diffDays} 天`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
                  {activeItem.deadlineCountdown.urgency === "CRITICAL"
                    ? "🚨 紧急预警：项目已进入最后 48 小时冲刺阶段！请团队责任人立刻完成标书排版封标、CA电子签章测试与系统预上传，防止因网络拥堵延误投递。"
                    : activeItem.deadlineCountdown.urgency === "WARNING"
                    ? "⏳ 进度提醒：距离截标不足 7 天，请确保商务资质、技术方案初稿及投标保证金汇款流程已启动并进入终审。"
                    : "标段处于正常编制周期，请按计划稳步推进商务与技术方案。"}
                </p>
              </div>
            )}

            {/* 全生命周期预警：关联项目澄清更正/答疑补遗/中标动态 */}
            {activeItem.lifecycleAlert?.hasUpdate && (
              <div className="mt-3 rounded-xl bg-amber-50/90 p-3.5 border border-amber-300/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertCircleIcon className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>【全生命周期预警】捕获关联项目后续公告动态</span>
                  </span>
                  <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    {activeItem.lifecycleAlert.updateLabel}
                  </span>
                </div>
                {activeItem.lifecycleAlert.latestNoticeTitle && (
                  <p className="mt-1.5 font-semibold text-slate-900 leading-snug">
                    {activeItem.lifecycleAlert.latestNoticeTitle}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-amber-200 text-[11px]">
                  <span className="text-amber-800">
                    发布时间：{activeItem.lifecycleAlert.latestNoticeDate || "近期"}
                  </span>
                  {activeItem.lifecycleAlert.latestNoticeId && (
                    <Link
                      href={`/tender/${activeItem.lifecycleAlert.latestNoticeId}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                    >
                      <span>查看答疑更正公告全文</span>
                      <ExternalLinkIcon className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* 批注流展示 */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>协同批注动态</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] text-slate-600">
                  {activeItem.comments?.length || 0}
                </span>
              </div>

              {(!activeItem.comments || activeItem.comments.length === 0) && (
                <div className="py-8 text-center text-xs text-slate-400">
                  暂无批注，可在下方发布技术方案、合规要点或风险预警备忘
                </div>
              )}

              {activeItem.comments?.map((c) => {
                const catInfo = CATEGORY_MAP[c.category] || CATEGORY_MAP.GENERAL;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-100 bg-white p-3 shadow-2xs text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">@{c.username}</span>
                        <span className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                      </div>
                      <span className="text-slate-400 tnum">
                        {new Date(c.createdAt).toLocaleDateString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed pt-0.5 whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 发送新批注框 */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">类型:</span>
                <div className="flex gap-1.5">
                  {(["GENERAL", "RISK", "COMPLIANCE", "ASSIGNMENT"] as CommentCategory[]).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCommentCat(cat)}
                        className={`cursor-pointer rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          commentCat === cat
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {CATEGORY_MAP[cat].label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入协同批注、资质备忘或风险提醒..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddComment();
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-primary focus:outline-none"
                />
                <button
                  disabled={isPending || !commentInput.trim()}
                  onClick={handleAddComment}
                  className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  发送
                </button>
              </div>

              {commentError && (
                <p className="text-[11px] text-rose-500">{commentError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 投标项目协同作战指挥室 Modal */}
      {warRoomFollowId !== null && (
        <BidWarRoomModal
          followId={warRoomFollowId}
          isOpen={warRoomFollowId !== null}
          onClose={() => setWarRoomFollowId(null)}
          onSaved={() => fetchBoard()}
        />
      )}

      {/* 投标复盘与胜败归因诊断 Modal */}
      {reviewFollowId !== null && (
        <BidReviewModal
          followId={reviewFollowId}
          isOpen={reviewFollowId !== null}
          onClose={() => setReviewFollowId(null)}
          onSaved={() => fetchBoard()}
        />
      )}
    </div>
  );
}
