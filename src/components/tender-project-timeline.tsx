import React from "react";
import Link from "next/link";
import { type ProjectTimelineData } from "@/lib/project-timeline";
import { ClockIcon, CheckCircleIcon, ArrowRightIcon } from "@/components/icons";

interface Props {
  data: ProjectTimelineData;
}

export default function TenderProjectTimeline({ data }: Props) {
  if (!data.hasMultipleNotices && data.notices.length <= 1) {
    return null;
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-linear-to-r from-blue-50/50 via-white to-slate-50/40 p-5 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-blue-100/60 pb-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">
            项目全生命周期追踪 (招标 ➔ 变更 ➔ 中标全链穿透)
          </h3>
        </div>
        {data.projectNo && (
          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 tnum">
            项目编号: {data.projectNo}
          </span>
        )}
      </div>

      <div className="mt-4">
        {/* 横向/纵向响应式时间轴节点 */}
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          {data.notices.map((notice, idx) => {
            const isLast = idx === data.notices.length - 1;
            return (
              <div
                key={notice.id}
                className="relative flex flex-1 items-start gap-3 sm:flex-col sm:items-start"
              >
                {/* 连线与圆点 */}
                <div className="flex items-center sm:w-full">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      notice.isCurrent
                        ? "bg-primary text-white ring-4 ring-primary/20 shadow-xs"
                        : "bg-white text-slate-600 border border-slate-300"
                    }`}
                  >
                    {notice.isCurrent ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  {/* 连接线 */}
                  {!isLast && (
                    <div className="hidden h-0.5 flex-1 bg-slate-200 sm:block sm:mx-2" />
                  )}
                </div>

                {/* 节点内容 */}
                <div className="min-w-0 flex-1 space-y-1 sm:pt-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${notice.typeColor}`}
                    >
                      {notice.typeLabel}
                    </span>
                    <span className="text-[11px] text-slate-400 tnum">
                      {notice.publishDate}
                    </span>
                    {notice.isCurrent && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                        当前公告
                      </span>
                    )}
                  </div>

                  <div className="text-xs">
                    {notice.isCurrent ? (
                      <span className="font-bold text-slate-900 line-clamp-2">
                        {notice.title}
                      </span>
                    ) : (
                      <Link
                        href={`/tender/${notice.id}`}
                        className="font-medium text-slate-700 hover:text-primary hover:underline line-clamp-2"
                        title="查看该阶段公告详情"
                      >
                        {notice.title}
                      </Link>
                    )}
                  </div>

                  {notice.budgetOrAward && (
                    <div className="text-[10px] font-semibold text-amber-600 tnum">
                      {notice.budgetOrAward}
                    </div>
                  )}

                  {!notice.isCurrent && (
                    <Link
                      href={`/tender/${notice.id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline pt-1"
                    >
                      查看详情
                      <ArrowRightIcon className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
