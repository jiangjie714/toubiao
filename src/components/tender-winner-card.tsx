"use client";

import { useState } from "react";
import Link from "next/link";
import { trackCompetitorAction, untrackCompetitorAction } from "@/app/actions/competitor";
import {
  TrophyIcon,
  BuildingIcon,
  RadarIcon,
  ArrowRightIcon,
  CheckIcon,
  ShieldCheckIcon,
} from "@/components/icons";

interface TenderWinnerCardProps {
  tenderId: number;
  winningSupplier: string;
  awardAmountWan: number | null;
  purchaser?: string | null;
  initialIsWatched?: boolean;
  canViewIntelligence?: boolean;
  planName?: string;
}

export default function TenderWinnerCard({
  winningSupplier,
  awardAmountWan,
  purchaser,
  initialIsWatched = false,
  canViewIntelligence = false,
  planName = "免费版",
}: TenderWinnerCardProps) {
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleToggleWatch = async () => {
    setPending(true);
    setFeedback(null);
    try {
      if (isWatched) {
        const res = await untrackCompetitorAction(winningSupplier);
        if (res.success) {
          setIsWatched(false);
          setFeedback("已从竞对雷达中取消关注");
        } else {
          setFeedback(res.error || "操作失败");
        }
      } else {
        const res = await trackCompetitorAction(winningSupplier);
        if (res.success) {
          setIsWatched(true);
          setFeedback("已成功加入竞对监控雷达！将在新中标时即时提醒您。");
        } else {
          setFeedback(res.error || "关注失败");
        }
      }
    } catch {
      setFeedback("网络请求失败，请稍后重试");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30 shadow-xs print:border print:border-slate-200">
      {/* 头部区域 */}
      <div className="border-b border-amber-100 bg-amber-100/30 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
            <TrophyIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">中标结果与供应商透视</h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                中标候选人/供应商
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              本标段已落地成交，系统已自动沉淀入全网供应商档案库
            </p>
          </div>
        </div>

        {/* 设为监控对手按钮 */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handleToggleWatch}
            disabled={pending}
            className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              isWatched
                ? "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                : "bg-white text-slate-700 border border-slate-200 shadow-2xs hover:border-purple-300 hover:text-purple-700"
            }`}
          >
            {isWatched ? (
              <>
                <CheckIcon className="h-3.5 w-3.5 text-purple-600" />
                <span>已在监控雷达中</span>
              </>
            ) : (
              <>
                <RadarIcon className="h-3.5 w-3.5 text-purple-600" />
                <span>关注此竞对动态</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 核心指标展示 */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-2xs">
            <div className="text-xs font-medium text-slate-400">中标供应商单位</div>
            <div className="mt-1 text-base font-bold text-slate-900 line-clamp-1" title={winningSupplier}>
              {winningSupplier}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-2xs">
            <div className="text-xs font-medium text-slate-400">本标段成交金额</div>
            <div className="mt-1 text-base font-bold text-amber-600 tnum">
              {awardAmountWan ? `${awardAmountWan.toLocaleString()} 万元` : "见公告原文"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-2xs">
            <div className="text-xs font-medium text-slate-400">发包采购买方</div>
            <div className="mt-1 text-sm font-semibold text-slate-800 line-clamp-1 flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span title={purchaser ?? undefined}>{purchaser || "见公告正文"}</span>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            {feedback}
          </div>
        )}

        {/* 穿透画像跳转通道 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
            <span>
              已为您归档该企业战绩 · 当前用户享受{" "}
              <strong className="text-slate-800 font-semibold">{planName}</strong> 情报服务
            </span>
          </div>

          <Link
            href={`/suppliers/${encodeURIComponent(winningSupplier)}`}
            className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-strong transition-colors print:hidden"
          >
            <span>穿透查看该企业历史全部中标战报与核心买方网络</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!canViewIntelligence && (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3.5 text-xs text-amber-900 flex items-center justify-between gap-4 print:hidden">
            <div>
              <span className="font-semibold">💡 升级白金/企业会员特权：</span>
              <span className="text-amber-800">
                可深度穿透该企业在全国各省历史战绩总额、常合作的“固定金主”圈子以及正面竞对较量雷达。
              </span>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              升级解锁
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
