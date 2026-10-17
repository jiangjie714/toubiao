"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  probeSingleSourceAction,
  probeAllSourcesAction,
  debugCrawlAction,
  dispatchAllSourcesBatchAction,
} from "@/app/admin/sources/actions";
import { toggleSourceAction, resetCircuitBreakerAction } from "@/app/admin/actions";
import CrawlButton from "@/app/admin/sources/crawl-button";
import { type DebugCrawlResult, type ProbeResult } from "@/lib/crawler/prober";
import {
  DatabaseIcon,
  BoltIcon,
  SearchIcon,
  ExternalLinkIcon,
  BellIcon,
  ClockIcon,
} from "@/components/icons";

export interface SourceRow {
  id: number;
  name: string;
  skillCode: string;
  status: string | null;
  healthScore: number | null;
  lastMessage: string | null;
  scheduleCron: string;
  configVersion: number | null;
  maxPages: number;
  requestDelayMs: number;
  lastRunAt: string | null;
  lastNewCount: number;
  enabled: boolean;
  hasSkillFile: boolean;
  checkpointDate?: string | null;
}

interface Props {
  initialSources: SourceRow[];
}

export default function SourcesManagerView({ initialSources }: Props) {
  const [sources, setSources] = useState<SourceRow[]>(initialSources);
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // 全网批量操作状态
  const [batchRunning, setBatchRunning] = useState(false);
  const [showBatchTimeModal, setShowBatchTimeModal] = useState(false);
  const [batchSinceDate, setBatchSinceDate] = useState("");
  const [batchUntilDate, setBatchUntilDate] = useState("");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // 单源拨测状态
  const [probingSkill, setProbingSkill] = useState<string | null>(null);
  const [lastProbeResult, setLastProbeResult] = useState<ProbeResult | null>(null);

  // 沙盒诊断抽屉
  const [debugResult, setDebugResult] = useState<DebugCrawlResult | null>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);

  // 熔断解除状态
  const [resettingId, setResettingId] = useState<number | null>(null);

  const handleResetCircuitBreaker = (id: number) => {
    setResettingId(id);
    startTransition(async () => {
      const res = await resetCircuitBreakerAction(id);
      setResettingId(null);
      if (res.success) {
        setSources((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "OK",
                  healthScore: 90,
                  lastMessage: "已手动解除熔断并恢复调度",
                }
              : s,
          ),
        );
      } else {
        alert(res.error || "解除熔断失败");
      }
    });
  };

  // 全量拨测
  const handleProbeAll = () => {
    startTransition(async () => {
      const res = await probeAllSourcesAction();
      if (res.success && res.data) {
        alert(
          `全网拨测完成！共探测 ${res.data.total} 个节点，健康: ${res.data.healthy} 个，注意: ${res.data.warning} 个，异常: ${res.data.error} 个，平均延迟: ${res.data.avgDurationMs}ms`,
        );
        window.location.reload();
      } else {
        alert(res.error || "全量拨测失败");
      }
    });
  };

  // 单个拨测
  const handleProbeSingle = (skillCode: string) => {
    setProbingSkill(skillCode);
    startTransition(async () => {
      const res = await probeSingleSourceAction(skillCode);
      setProbingSkill(null);
      if (res.success && res.result) {
        setLastProbeResult(res.result);
        setSources((prev) =>
          prev.map((s) =>
            s.skillCode === skillCode
              ? {
                  ...s,
                  healthScore: res.result!.healthScore,
                  status: res.result!.status,
                  lastMessage: res.result!.message,
                }
              : s,
          ),
        );
      } else {
        alert(res.error || "拨测失败");
      }
    });
  };

  // 启动现场沙盒诊断
  const handleOpenDebug = (skillCode: string) => {
    setIsDebugLoading(true);
    setDebugResult(null);
    startTransition(async () => {
      const res = await debugCrawlAction(skillCode);
      setDebugResult(res);
      setIsDebugLoading(false);
    });
  };

  // 一键全网断点续采
  const handleBatchResume = () => {
    if (!confirm("确定要对所有已启用的数据源立即派发断点续采任务吗？系统将自动检测各自最新断点，推入任务队列异步执行。")) return;
    setBatchRunning(true);
    startTransition(async () => {
      const res = await dispatchAllSourcesBatchAction({ resume: true });
      setBatchRunning(false);
      if (res.success) {
        setBannerMessage(`⚡ 全网断点续采任务已成功派发！共为 ${res.enqueuedCount} 个数据源建立排队任务，Worker 正在异步消费中。`);
      } else {
        alert(res.error || "全网断点续采派发失败");
      }
    });
  };

  // 一键全网按时间段补采
  const handleBatchTimeRange = () => {
    if (!batchSinceDate && !batchUntilDate) {
      alert("请至少指定开始日期或截止日期");
      return;
    }
    setBatchRunning(true);
    startTransition(async () => {
      const res = await dispatchAllSourcesBatchAction({
        resume: false,
        sinceDate: batchSinceDate || undefined,
        untilDate: batchUntilDate || undefined,
      });
      setBatchRunning(false);
      setShowBatchTimeModal(false);
      if (res.success) {
        setBannerMessage(`📅 全网时间段补采任务已推入队列！共 ${res.enqueuedCount} 个数据源将在指定区间 [${batchSinceDate || "起始"} 至 ${batchUntilDate || "最新"}] 内补采。`);
      } else {
        alert(res.error || "全网时间段补采派发失败");
      }
    });
  };

  // 统计大盘
  const totalCount = sources.length;
  const healthyCount = sources.filter((s) => (s.healthScore ?? 0) >= 90).length;
  const warningCount = sources.filter(
    (s) => (s.healthScore ?? 0) >= 70 && (s.healthScore ?? 0) < 90,
  ).length;
  const errorCount = sources.filter((s) => (s.healthScore ?? 0) < 70 && s.healthScore !== null).length;

  // 过滤数据源
  const filteredSources = sources.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.skillCode.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (categoryFilter === "GOV") {
      return s.skillCode.startsWith("ccgp");
    }
    if (categoryFilter === "ENTERPRISE") {
      return ["sgcc", "b2b-10086", "ctb", "chinaunicombidding", "cr-szb", "crec", "sinopec"].includes(
        s.skillCode,
      );
    }
    if (categoryFilter === "PLATFORM") {
      return s.skillCode === "ggzy";
    }
    return true;
  });

  const healthBadge = (score: number | null) => {
    if (score === null) {
      return <span className="text-xs text-slate-400">暂无</span>;
    }
    const tone =
      score >= 90
        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
        : score >= 70
          ? "bg-amber-50 text-amber-600 border-amber-200"
          : "bg-red-50 text-red-600 border-red-200";
    return (
      <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold tnum ${tone}`}>
        {score} 分
      </span>
    );
  };

  const statusBadge = (s: string | null) => {
    if (!s || s === "OK")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          正常
        </span>
      );
    if (s === "WARNING")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          注意
        </span>
      );
    if (s === "RUNNING")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          抓取中
        </span>
      );
    if (s === "CIRCUIT_DEGRADED")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-semibold text-purple-700">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
          熔断降级中
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        异常
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 头部与大盘指标 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                <DatabaseIcon className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                采集数据源与健康拨测中心
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              已接入中央政采、重点省份政采网、大型央国企采购平台与公共资源交易中心，支持自动化健康探测与实时抓取沙盒诊断
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 一键全网断点续采 */}
            <button
              type="button"
              disabled={batchRunning || isPending}
              onClick={handleBatchResume}
              title="对所有启用的数据源一键执行断点续采，自动探测断点补齐未采集数据"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <BoltIcon className={`h-4 w-4 ${batchRunning ? "animate-pulse" : ""}`} />
              <span>{batchRunning ? "派发任务中..." : "⚡ 全网断点续采"}</span>
            </button>

            {/* 一键全网时间段补采 */}
            <button
              type="button"
              disabled={batchRunning || isPending}
              onClick={() => setShowBatchTimeModal(true)}
              title="针对所有启用的数据源，指定统一发布时间范围进行补采"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-xs font-semibold text-primary shadow-xs hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <ClockIcon className="h-4 w-4" />
              <span>📅 全网时间段采</span>
            </button>

            <Link
              href="/admin/sources/tasks"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <BoltIcon className="h-4 w-4 text-slate-400" />
              <span>任务调度队列</span>
            </Link>

            <Link
              href="/admin/sources/alerts"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-100 transition-colors"
            >
              <BellIcon className="h-4 w-4" />
              <span>告警规则</span>
            </Link>

            <button
              disabled={isPending}
              onClick={handleProbeAll}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <span>{isPending ? "探测中..." : "全网拨测"}</span>
            </button>
          </div>
        </div>

        {/* 批量操作成功反馈横幅 */}
        {bannerMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{bannerMessage}</span>
              <Link href="/admin/sources/tasks" className="underline font-bold text-emerald-900 ml-2 hover:opacity-80">
                前往任务池查看队列 →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4 大统计指标 */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
            <span className="text-xs font-medium text-slate-500">全网数据源节点</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
                {totalCount}
              </span>
              <span className="text-xs text-slate-400">个站点</span>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/40 p-3.5 border border-emerald-100/60">
            <span className="text-xs font-medium text-emerald-700">健康高分节点 (≥90)</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 tnum">
                {healthyCount}
              </span>
              <span className="text-xs text-emerald-600">个正常运行</span>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50/40 p-3.5 border border-amber-100/60">
            <span className="text-xs font-medium text-amber-700">结构变动注意 (70-89)</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-amber-600 tnum">
                {warningCount}
              </span>
              <span className="text-xs text-amber-600">个需核查</span>
            </div>
          </div>

          <div className="rounded-xl bg-rose-50/40 p-3.5 border border-rose-100/60">
            <span className="text-xs font-medium text-rose-700">异常/失效预警 (&lt;70)</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-rose-600 tnum">
                {errorCount}
              </span>
              <span className="text-xs text-rose-600">个熔断</span>
            </div>
          </div>
        </div>

        {/* 最近一次单源拨测快速反馈 */}
        {lastProbeResult && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-xs text-primary">
            <div className="flex items-center gap-2">
              <span className="font-semibold">最新单点拨测结果：</span>
              <span className="font-mono">{lastProbeResult.skillCode}</span>
              <span>—</span>
              <span>得分 {lastProbeResult.healthScore}</span>
              <span>({lastProbeResult.status})</span>
              <span className="text-slate-500">· 耗时 {lastProbeResult.durationMs}ms</span>
              <span className="text-slate-600">· {lastProbeResult.message}</span>
            </div>
            <button
              onClick={() => setLastProbeResult(null)}
              className="cursor-pointer text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 过滤栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCategoryFilter("ALL")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              categoryFilter === "ALL"
                ? "bg-primary text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            全部数据源 ({sources.length})
          </button>
          <button
            onClick={() => setCategoryFilter("GOV")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              categoryFilter === "GOV"
                ? "bg-primary text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            政府采购网 (15)
          </button>
          <button
            onClick={() => setCategoryFilter("ENTERPRISE")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              categoryFilter === "ENTERPRISE"
                ? "bg-primary text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            央国企采购平台 (7)
          </button>
          <button
            onClick={() => setCategoryFilter("PLATFORM")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              categoryFilter === "PLATFORM"
                ? "bg-primary text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            公共资源交易 (1)
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索数据源名称或代码..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* 数据源列表表格 */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-surface shadow-xs">
        <table className="data-table w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
              <th className="w-[240px] min-w-[200px] px-5 py-3 font-medium">数据源名称</th>
              <th className="w-[160px] min-w-[140px] px-5 py-3 font-medium whitespace-nowrap">技能代码 (SkillCode)</th>
              <th className="w-[170px] min-w-[150px] px-5 py-3 font-medium whitespace-nowrap">健康度 / 状态</th>
              <th className="w-[180px] min-w-[160px] px-5 py-3 font-medium whitespace-nowrap">调度配置</th>
              <th className="w-[200px] min-w-[180px] px-5 py-3 font-medium whitespace-nowrap">数据断点 / 最近抓取</th>
              <th className="min-w-[420px] px-5 py-3 font-medium text-right whitespace-nowrap">在线诊断与操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSources.map((s) => {
              const isProbing = probingSkill === s.skillCode;

              return (
                <tr key={s.id} className="transition-colors duration-150 hover:bg-blue-50/40 text-xs">
                  <td className="w-[240px] min-w-[200px] px-5 py-3.5">
                    <div className="font-semibold text-slate-900 leading-snug">{s.name}</div>
                    {s.lastMessage && (
                      <p
                        className="mt-1 max-w-[220px] truncate text-[11px] text-slate-400"
                        title={s.lastMessage}
                      >
                        {s.lastMessage}
                      </p>
                    )}
                  </td>

                  <td className="w-[160px] min-w-[140px] px-5 py-3.5 whitespace-nowrap">
                    <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200/60">
                      {s.skillCode}
                    </span>
                    {!s.hasSkillFile && (
                      <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 border border-rose-100">
                        缺配置
                      </span>
                    )}
                  </td>

                  <td className="w-[170px] min-w-[150px] px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {statusBadge(s.status)}
                      {healthBadge(s.healthScore)}
                    </div>
                  </td>

                  <td className="w-[180px] min-w-[160px] px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    <div className="font-mono text-[11px] text-slate-700 font-medium">{s.scheduleCron}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      v{s.configVersion ?? 1} · {s.maxPages}页 · 延迟 {s.requestDelayMs}ms
                    </div>
                  </td>

                  <td className="w-[200px] min-w-[180px] px-5 py-3.5 text-slate-500 tnum whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.checkpointDate ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span>{s.checkpointDate ? new Date(s.checkpointDate).toLocaleDateString("zh-CN") : "无历史断点"}</span>
                      {s.checkpointDate && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded font-normal">续采位</span>}
                    </div>
                    {s.lastRunAt ? (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        上次: {new Date(s.lastRunAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                        {s.lastNewCount > 0 && <span className="ml-1 text-emerald-600 font-semibold">+{s.lastNewCount}</span>}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 mt-0.5">未执行抓取</div>
                    )}
                  </td>

                  <td className="min-w-[420px] px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* 诊断与探测组 */}
                      <button
                        type="button"
                        onClick={() => handleOpenDebug(s.skillCode)}
                        title="在线沙盒测试抓取第1页，预览解析出的标讯列表"
                        className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-primary hover:text-primary transition-colors"
                      >
                        <SearchIcon className="h-3 w-3 text-slate-400" />
                        <span>沙盒</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProbing || isPending}
                        onClick={() => handleProbeSingle(s.skillCode)}
                        title="向该数据源首页发送探测请求，测量连通耗时与规则匹配"
                        className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        <BoltIcon className="h-3 w-3 text-amber-500" />
                        <span>{isProbing ? "探测中…" : "拨测"}</span>
                      </button>

                      {/* 熔断恢复快捷入口 */}
                      {(s.status === "CIRCUIT_DEGRADED" || s.status === "FAILED") && (
                        <button
                          type="button"
                          disabled={resettingId === s.id || isPending}
                          onClick={() => handleResetCircuitBreaker(s.id)}
                          title="手动清除连续失败计数，解除熔断状态并立即恢复常规频次调度"
                          className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors disabled:opacity-50"
                        >
                          <BoltIcon className="h-3 w-3 text-purple-600" />
                          <span>{resettingId === s.id ? "恢复…" : "解除熔断"}</span>
                        </button>
                      )}

                      {/* 核心采集动作组（续采 / 时间段 / 测试） */}
                      <CrawlButton skillCode={s.skillCode} enabled={s.enabled} />

                      {/* 版本配置链接 */}
                      <Link
                        href={`/admin/sources/${s.id}/revisions`}
                        title="查看历史版本、在线编辑 YAML 与一键回滚"
                        className="cursor-pointer inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary transition-colors"
                      >
                        <DatabaseIcon className="h-3 w-3 text-slate-400" />
                        <span className="font-mono">v{s.configVersion || 1}</span>
                      </Link>

                      {/* 停用/启用 */}
                      <form action={toggleSourceAction} className="inline-block m-0 p-0">
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                            s.enabled
                              ? "border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              : "border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50"
                          }`}
                        >
                          {s.enabled ? "停用" : "启用"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 沙盒诊断抽屉 / 弹窗 */}
      {(debugResult || isDebugLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <SearchIcon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    在线抓取沙盒诊断 (Live Debugger)
                  </h4>
                  <span className="text-xs text-slate-500">
                    {debugResult?.sourceName} ({debugResult?.skillCode})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDebugResult(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {isDebugLoading ? (
              <div className="py-20 text-center text-xs text-slate-500 space-y-3">
                <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p>正在连接目标站点并执行实时 HTML 规则解析...</p>
              </div>
            ) : debugResult && (
              <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* 诊断指标栏 */}
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <div>
                    <span className="text-slate-500">解析状态:</span>
                    <div className="mt-0.5 font-bold">
                      {debugResult.success ? (
                        <span className="text-emerald-600">✓ 成功匹配</span>
                      ) : (
                        <span className="text-rose-600">✗ 解析失败</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">响应耗时:</span>
                    <div className="mt-0.5 font-bold text-slate-900 tnum">
                      {debugResult.durationMs} ms
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">命中条目:</span>
                    <div className="mt-0.5 font-bold text-primary tnum">
                      {debugResult.totalFound} 条公告
                    </div>
                  </div>
                </div>

                {debugResult.error && (
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-600 border border-rose-100">
                    错误详情: {debugResult.error}
                  </div>
                )}

                {/* 提取结果预览列表 */}
                {debugResult.items.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-800">
                      首屏提取样例 (前 {debugResult.items.length} 条):
                    </span>
                    <div className="mt-2 space-y-2">
                      {debugResult.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 hover:border-blue-200 transition-colors"
                        >
                          <div className="font-semibold text-slate-900 leading-snug">
                            {item.title}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>发布日期: {item.date || "未提供"}</span>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 font-medium"
                            >
                              <span>源站链接</span>
                              <ExternalLinkIcon className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setDebugResult(null)}
                className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全网批量时间段补采模态框 */}
      {showBatchTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <ClockIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">全网按时间段批量补采</h4>
                  <p className="text-xs text-slate-500 mt-0.5">将针对全部启用的数据源派发异步抓取任务</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchTimeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* 快捷范围预设 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  快捷发布区间预设
                </label>
                <div className="flex flex-wrap gap-2">
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
                        setBatchSinceDate(fmt(start));
                        setBatchUntilDate(fmt(end));
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-700 transition-colors cursor-pointer"
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
                      setBatchSinceDate(fmt(start));
                      setBatchUntilDate(fmt(now));
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-700 transition-colors cursor-pointer"
                  >
                    本月至今
                  </button>
                </div>
              </div>

              {/* 日期输入框 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    起始发布日期 (From)
                  </label>
                  <input
                    type="date"
                    value={batchSinceDate}
                    onChange={(e) => setBatchSinceDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    截止发布日期 (To)
                  </label>
                  <input
                    type="date"
                    value={batchUntilDate}
                    onChange={(e) => setBatchUntilDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                ⚠️ 提示：批量补采任务将在后台按优先级排队抓取，各数据源翻页到达起始日期前时将自动安全停止，防止无效翻页。
              </div>
            </div>

            <div className="mt-6 pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBatchTimeModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={batchRunning || (!batchSinceDate && !batchUntilDate)}
                onClick={handleBatchTimeRange}
                className="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-strong rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {batchRunning ? "派发中…" : "确认全网补采"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
