"use client";

import { useState, useTransition } from "react";
import { PlusIcon, DatabaseIcon, ShieldAlertIcon } from "@/components/icons";
import { dispatchSourceTaskAction } from "@/app/admin/sources/actions";

interface Props {
  availableSources: Array<{ skillCode: string; name: string }>;
}

export default function TaskDispatchModal({ availableSources }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [skillCode, setSkillCode] = useState<string>(
    availableSources[0]?.skillCode || ""
  );
  const [maxPages, setMaxPages] = useState<number>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillCode) {
      setFormError("请选择数据源");
      return;
    }

    setFormError(null);
    const formData = new FormData();
    formData.set("skillCode", skillCode);
    formData.set("maxPages", String(maxPages));
    formData.set("trigger", "manual");

    startTransition(async () => {
      const res = await dispatchSourceTaskAction(formData);
      if (res.success) {
        setIsOpen(false);
        setMaxPages(1);
      } else {
        setFormError(res.error || "派发任务失败");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setFormError(null);
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover active:bg-primary-active rounded-lg transition-colors shadow-xs cursor-pointer"
      >
        <PlusIcon className="h-4 w-4" />
        <span>派发抓取任务</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-slate-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-primary rounded-xl">
                  <DatabaseIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">派发抓取任务至队列</h3>
                  <p className="text-xs text-slate-500 mt-0.5">任务将推入全局 CrawlTask 队列由 Worker 异步消费</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <ShieldAlertIcon className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 目标数据源 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  目标采集数据源
                </label>
                <select
                  value={skillCode}
                  onChange={(e) => setSkillCode(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {availableSources.map((s) => (
                    <option key={s.skillCode} value={s.skillCode}>
                      {s.name} ({s.skillCode})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  若该源已有正在排队或抓取中的任务，系统将自动复用现有任务避免重复请求。
                </p>
              </div>

              {/* 抓取深度 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  抓取深度 (最多抓取页数)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Math.max(1, Number(e.target.value)))}
                    className="w-24 text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-center"
                  />
                  <span className="text-xs text-slate-500">
                    页（默认 1 页最新公告，全量抓取建议 3~5 页）
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover active:bg-primary-active rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "入队中..." : "确认派发入队"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
