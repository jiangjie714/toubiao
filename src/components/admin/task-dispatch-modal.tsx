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
  const [mode, setMode] = useState<"resume" | "timerange" | "pages">("resume");
  const [maxPages, setMaxPages] = useState<number>(3);
  const [sinceDate, setSinceDate] = useState<string>("");
  const [untilDate, setUntilDate] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillCode) {
      setFormError("请选择数据源");
      return;
    }

    if (mode === "timerange" && !sinceDate && !untilDate) {
      setFormError("按时间段采集请至少指定开始日期或结束日期");
      return;
    }

    setFormError(null);
    const formData = new FormData();
    formData.set("skillCode", skillCode);
    formData.set("mode", mode);
    formData.set("trigger", "manual");

    if (mode === "pages") {
      formData.set("maxPages", String(maxPages));
    } else if (mode === "timerange") {
      if (sinceDate) formData.set("sinceDate", sinceDate);
      if (untilDate) formData.set("untilDate", untilDate);
      if (maxPages) formData.set("maxPages", String(maxPages));
    }

    startTransition(async () => {
      const res = await dispatchSourceTaskAction(formData);
      if (res.success) {
        setIsOpen(false);
        setMaxPages(3);
        setSinceDate("");
        setUntilDate("");
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

              {/* 采集模式 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  采集工作模式
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("resume")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      mode === "resume"
                        ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>⚡ 断点续采</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">自动衔接最新断点</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("timerange")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      mode === "timerange"
                        ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>📅 按时间段采</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">补采历史区间数据</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("pages")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      mode === "pages"
                        ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>📄 指定页数</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">仅抓取最新前 N 页</div>
                  </button>
                </div>
              </div>

              {/* 模式专属配置 */}
              {mode === "resume" && (
                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-slate-600">
                  <div className="font-semibold text-primary mb-1">💡 推荐模式（断点续采）</div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    系统将自动探测该数据源上次成功采集到的最新公告断点，并自动往前逐页翻页补齐未采集数据，触及断点后自动安全停止，保证零漏采且不重复抓取。
                  </p>
                </div>
              )}

              {mode === "timerange" && (
                <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">选择发布日期范围</span>
                    <span className="text-[11px] text-slate-400">支持快捷填充</span>
                  </div>

                  {/* 快捷预设 */}
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {[
                      { label: "近3天", days: 3 },
                      { label: "近7天", days: 7 },
                      { label: "近15天", days: 15 },
                      { label: "近30天", days: 30 },
                    ].map((p) => (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(end.getDate() - p.days);
                          const fmt = (d: Date) => d.toISOString().split("T")[0];
                          setSinceDate(fmt(start));
                          setUntilDate(fmt(end));
                        }}
                        className="px-2 py-0.5 text-[11px] rounded bg-white border border-slate-200 hover:border-primary hover:text-primary text-slate-600 transition-colors cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth(), 1);
                        const fmt = (d: Date) => d.toISOString().split("T")[0];
                        setSinceDate(fmt(start));
                        setUntilDate(fmt(now));
                      }}
                      className="px-2 py-0.5 text-[11px] rounded bg-white border border-slate-200 hover:border-primary hover:text-primary text-slate-600 transition-colors cursor-pointer"
                    >
                      本月至今
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">起始日期 (From)</label>
                      <input
                        type="date"
                        value={sinceDate}
                        onChange={(e) => setSinceDate(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">截止日期 (To)</label>
                      <input
                        type="date"
                        value={untilDate}
                        onChange={(e) => setUntilDate(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    仅抓取发布日期落在该区间内的标讯，早于起始日期时自动停止翻页。
                  </p>
                </div>
              )}

              {mode === "pages" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    抓取深度 (最多抓取页数)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={maxPages}
                      onChange={(e) => setMaxPages(Math.max(1, Number(e.target.value)))}
                      className="w-24 text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-center"
                    />
                    <span className="text-xs text-slate-500">
                      页（常规抓取最新 1~3 页）
                    </span>
                  </div>
                </div>
              )}

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
