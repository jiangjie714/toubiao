"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  probeSingleSourceAction,
  probeAllSourcesAction,
  debugCrawlAction,
} from "@/app/admin/sources/actions";
import { toggleSourceAction } from "@/app/admin/actions";
import CrawlButton from "@/app/admin/sources/crawl-button";
import { type DebugCrawlResult, type ProbeResult } from "@/lib/crawler/prober";
import {
  DatabaseIcon,
  BoltIcon,
  SearchIcon,
  ExternalLinkIcon,
  BellIcon,
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
}

interface Props {
  initialSources: SourceRow[];
}

export default function SourcesManagerView({ initialSources }: Props) {
  const [sources, setSources] = useState<SourceRow[]>(initialSources);
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // 单源拨测状态
  const [probingSkill, setProbingSkill] = useState<string | null>(null);
  const [lastProbeResult, setLastProbeResult] = useState<ProbeResult | null>(null);

  // 沙盒诊断抽屉
  const [debugResult, setDebugResult] = useState<DebugCrawlResult | null>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);

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
            <Link
              href="/admin/sources/tasks"
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-xs font-semibold text-primary shadow-xs hover:bg-blue-100 transition-colors"
            >
              <BoltIcon className="h-4 w-4" />
              <span>任务调度队列</span>
            </Link>
            <Link
              href="/admin/sources/alerts"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-100 transition-colors"
            >
              <BellIcon className="h-4 w-4" />
              <span>告警规则与机器人配置</span>
            </Link>
            <button
              disabled={isPending}
              onClick={handleProbeAll}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <BoltIcon className="h-4 w-4" />
              <span>{isPending ? "正在批量探测..." : "⚡ 一键全网拨测"}</span>
            </button>
          </div>
        </div>

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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">数据源名称</th>
              <th className="px-5 py-3 font-medium">技能代码 (SkillCode)</th>
              <th className="px-5 py-3 font-medium">健康度 / 状态</th>
              <th className="px-5 py-3 font-medium">调度配置</th>
              <th className="px-5 py-3 font-medium">最近抓取</th>
              <th className="px-5 py-3 font-medium text-right">在线诊断与操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSources.map((s) => {
              const isProbing = probingSkill === s.skillCode;

              return (
                <tr key={s.id} className="transition-colors duration-150 hover:bg-blue-50/40 text-xs">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    {s.lastMessage && (
                      <p
                        className="mt-0.5 max-w-[280px] truncate text-[11px] text-slate-400"
                        title={s.lastMessage}
                      >
                        {s.lastMessage}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {s.skillCode}
                    </span>
                    {!s.hasSkillFile && (
                      <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                        缺少配置
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {statusBadge(s.status)}
                      {healthBadge(s.healthScore)}
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-slate-500">
                    <div className="font-mono text-[11px] text-slate-700">{s.scheduleCron}</div>
                    <div className="text-[11px] text-slate-400">
                      v{s.configVersion ?? 1} · {s.maxPages}页 · 延迟 {s.requestDelayMs}ms
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-slate-500 tnum">
                    {s.lastRunAt ? (
                      <div>
                        <div>{new Date(s.lastRunAt).toLocaleString("zh-CN")}</div>
                        {s.lastNewCount > 0 && (
                          <span className="font-bold text-emerald-600">+{s.lastNewCount} 增量</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">未执行抓取</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* 版本管理与在线编辑 */}
                      <Link
                        href={`/admin/sources/${s.id}/revisions`}
                        title="查看历史版本、在线编辑 YAML 与一键回滚"
                        className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary transition-colors"
                      >
                        <DatabaseIcon className="h-3 w-3 text-slate-400" />
                        <span className="font-mono">v{s.configVersion || 1}</span>
                      </Link>

                      {/* 单源即时拨测 */}
                      <button
                        disabled={isProbing || isPending}
                        onClick={() => handleProbeSingle(s.skillCode)}
                        title="向该数据源首页发送探测请求，测量连通耗时与规则匹配"
                        className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        <BoltIcon className="h-3 w-3 text-amber-500" />
                        <span>{isProbing ? "探测中..." : "拨测"}</span>
                      </button>

                      {/* 现场沙盒诊断 */}
                      <button
                        onClick={() => handleOpenDebug(s.skillCode)}
                        title="在线沙盒测试抓取第1页，预览解析出的标讯列表"
                        className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-blue-100 transition-colors"
                      >
                        <SearchIcon className="h-3 w-3" />
                        <span>沙盒诊断</span>
                      </button>

                      {/* 立即抓取入库 */}
                      <CrawlButton skillCode={s.skillCode} enabled={s.enabled} />

                      {/* 停用/启用 */}
                      <form action={toggleSourceAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          className={`cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors duration-200 ${
                            s.enabled
                              ? "border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
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
    </div>
  );
}
