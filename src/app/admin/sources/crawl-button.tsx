"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon } from "@/components/icons";

type RunResponse = { ok?: boolean; message?: string; newCount?: number; error?: string };
type TestResponse = {
  itemsParsed?: number;
  fetched?: number;
  httpOk?: number;
  httpFail?: number;
  errors?: string[];
  items?: unknown[];
  error?: string;
};

export default function CrawlButton({
  skillCode,
  enabled,
}: {
  skillCode: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // 4 秒后自动淡出提示，避免常态挤占表格列宽
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  // 时间段采集弹窗状态
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");

  async function runCrawl(params: { resume?: boolean; sinceDate?: string; untilDate?: string }) {
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/crawl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillCode,
          resume: params.resume ?? true,
          sinceDate: params.sinceDate || undefined,
          untilDate: params.untilDate || undefined,
        }),
      });
      const data = (await response.json()) as RunResponse;
      setResult(
        response.ok
          ? `成功：${data.message ?? `新增 ${data.newCount ?? 0} 条`}`
          : `失败：${data.message ?? data.error ?? "未知错误"}`,
      );
      router.refresh();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "请求失败");
    } finally {
      setRunning(false);
      setShowTimeModal(false);
    }
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/crawl/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillCode, maxPages: 1 }),
      });
      const data = (await response.json()) as TestResponse;
      if (!response.ok) {
        setResult(`测试失败：${data.error ?? "未知错误"}`);
        return;
      }
      const errors = data.errors?.length ? `，错误 ${data.errors.length} 个` : "";
      setResult(
        `dry-run：解析 ${data.itemsParsed ?? 0} 条，抓取 ${data.fetched ?? 0} 条${errors}`,
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : "请求失败");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* 采集动作整合按钮组 */}
      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs">
        {/* 默认断点续采 */}
        <button
          type="button"
          onClick={() => runCrawl({ resume: true })}
          disabled={running || testing || !enabled}
          title={enabled ? "默认断点续采：自动从上次最新断点补齐未采数据" : "数据源已停用"}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <BoltIcon className={`h-3 w-3 ${running ? "animate-pulse" : ""}`} />
          <span>{running ? "采集中…" : "续采"}</span>
        </button>

        {/* 按时间段采快捷入口 */}
        <button
          type="button"
          disabled={running || testing || !enabled}
          onClick={() => setShowTimeModal(true)}
          title="按发布时间段补采历史数据"
          className="inline-flex cursor-pointer items-center rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          时间段
        </button>

        {/* 测试抓取 */}
        <button
          type="button"
          onClick={test}
          disabled={running || testing}
          title="只抓取第1页dry-run解析，不写入数据库"
          className="inline-flex cursor-pointer items-center rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? "测试中…" : "测试"}
        </button>
      </div>

      {/* 结果提示标签 */}
      {result && (
        <span
          className={`inline-flex items-center gap-1 text-[11px] max-w-[140px] truncate px-1.5 py-0.5 rounded border animate-in fade-in ${
            result.startsWith("成功") || result.startsWith("dry-run")
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
          title={`${result} (点击关闭)`}
          onClick={() => setResult(null)}
        >
          <span className="truncate">{result}</span>
          <span className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer">✕</span>
        </span>
      )}

      {/* 时间段补采浮层模态框 */}
      {showTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">按时间段补采</h4>
                <p className="text-xs text-slate-500 mt-0.5">源：{skillCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTimeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* 快捷时间预设 */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  快捷范围预设
                </label>
                <div className="flex flex-wrap gap-1.5">
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
                      className="px-2 py-1 text-[11px] rounded-md bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-600 transition-colors cursor-pointer"
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
                    className="px-2 py-1 text-[11px] rounded-md bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-600 transition-colors cursor-pointer"
                  >
                    本月至今
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  起始发布日期 (From)
                </label>
                <input
                  type="date"
                  value={sinceDate}
                  onChange={(e) => setSinceDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  截止发布日期 (To)
                </label>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                系统将检索发布日期在指定区间内的公告，早于起始日期将自动安全停止翻页。
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTimeModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={running || (!sinceDate && !untilDate)}
                onClick={() => runCrawl({ resume: false, sinceDate, untilDate })}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-strong rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {running ? "提交中…" : "开始补采"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
