"use client";

import { useState } from "react";
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

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/crawl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillCode, maxPages: 1 }),
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
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={running || testing || !enabled}
        title={enabled ? "立即抓取一轮（每源默认抓第 1 页）" : "数据源已停用"}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BoltIcon className={`h-3.5 w-3.5 ${running ? "animate-pulse" : ""}`} />
        {running ? "抓取中…" : "立即抓取"}
      </button>
      <button
        onClick={test}
        disabled={running || testing}
        className="cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors duration-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {testing ? "测试中…" : "测试抓取"}
      </button>
      {result && (
        <span
          className={`text-xs ${
            result.startsWith("成功") || result.startsWith("dry-run")
              ? "text-emerald-600"
              : "text-red-600"
          }`}
        >
          {result}
        </span>
      )}
    </div>
  );
}
