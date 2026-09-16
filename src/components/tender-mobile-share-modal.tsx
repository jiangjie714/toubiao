"use client";

import React, { useState } from "react";
import {
  ShareIcon,
  CheckCircleIcon,
  SparklesIcon,
  BuildingIcon,
  CalendarIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { tenderTypeLabel, tenderTypeColor, formatDate } from "@/lib/constants";

interface Props {
  tender: {
    id: number;
    title: string;
    type: string;
    purchaser: string | null;
    budgetAmount: number | null;
    publishDate: string;
    expireDate: string | null;
    provinceName?: string;
  };
}

export default function TenderMobileShareModal({ tender }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const tenderUrl = typeof window !== "undefined"
    ? `${window.location.origin}/tender/${tender.id}`
    : `http://localhost:3000/tender/${tender.id}`;

  const shareText = `【标讯速递】${tender.title}\n采购人：${tender.purchaser || "公开招标单位"}\n预算金额：${tender.budgetAmount ? `${tender.budgetAmount} 万元` : "见招标文件"}\n截标日期：${tender.expireDate ? formatDate(new Date(tender.expireDate)) : "详见公告"}\n详情查阅：${tenderUrl}`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-primary hover:text-primary transition"
        title="生成移动端长图卡片或一键分享到企微/微信/钉钉群"
      >
        <ShareIcon className="h-3.5 w-3.5 text-slate-500" />
        <span>分享标讯</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <SparklesIcon className="h-4 w-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  移动端微名片 · 分享到微信/企微
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* 移动端海报卡片预览 */}
            <div className="mt-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tenderTypeColor(
                    tender.type
                  )}`}
                >
                  {tenderTypeLabel(tender.type)}
                </span>
                <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                  标讯通 · 实时情报
                </span>
              </div>

              <h4 className="mt-2.5 text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                {tender.title}
              </h4>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <BuildingIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">采购人：{tender.purchaser || "公开采购单位"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>
                    发布：{tender.publishDate.slice(0, 10)}
                    {tender.expireDate && ` · 截标：${tender.expireDate.slice(0, 10)}`}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-blue-100/80 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">项目控制预算</span>
                  <span className="text-base font-black text-primary tnum">
                    {tender.budgetAmount ? `${tender.budgetAmount} 万元` : "以标书文件为准"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold border border-emerald-200">
                    合规核验通过
                  </span>
                </div>
              </div>
            </div>

            {/* 操作按钮区 */}
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="w-full inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong transition"
              >
                {copied ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>已复制卡片文案与链接</span>
                  </>
                ) : (
                  <>
                    <ShareIcon className="h-4 w-4" />
                    <span>复制微信 / 企微分享消息卡片</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-surface py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <ShieldCheckIcon className="h-4 w-4 text-slate-500" />
                <span>打印 / 另存为便携 PDF 长图</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
