"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BellIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ClockIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@/components/icons";
import AlertRuleModal from "./alert-rule-modal";
import type { AlertsOverviewData, AlertRuleItem } from "@/lib/crawler/alerts-manager";
import {
  toggleAlertRuleAction,
  deleteAlertRuleAction,
  testAlertChannelAction,
} from "@/app/admin/sources/actions";

interface Props {
  data: AlertsOverviewData;
}

export default function AlertsManagerView({ data }: Props) {
  const [rules, setRules] = useState<AlertRuleItem[]>(data.rules);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (rule: AlertRuleItem) => {
    const originalEnabled = rule.enabled;
    // Optimistic update
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: !originalEnabled } : r))
    );

    startTransition(async () => {
      const res = await toggleAlertRuleAction(rule.id);
      if (!res.success) {
        // Rollback
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: originalEnabled } : r))
        );
        alert(res.error || "更新状态失败");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("确定要删除这条告警监控规则吗？")) return;

    startTransition(async () => {
      const res = await deleteAlertRuleAction(id);
      if (res.success) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      } else {
        alert(res.error || "删除规则失败");
      }
    });
  };

  const handleQuickTest = async (rule: AlertRuleItem) => {
    setTestingId(rule.id);
    setTestResult(null);
    try {
      const res = await testAlertChannelAction(rule.channel, rule.target);
      if (res.success) {
        setTestResult({ id: rule.id, success: true, msg: "测试通知已成功推送到目标机器人！" });
      } else {
        setTestResult({ id: rule.id, success: false, msg: res.error || "推送测试失败" });
      }
    } catch {
      setTestResult({ id: rule.id, success: false, msg: "网络异常，发送失败" });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作区与面包屑 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/admin/sources" className="hover:text-primary transition-colors">
              数据源调度中枢
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">健康度告警与机器人配置</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BellIcon className="h-6 w-6 text-rose-500" />
            <span>全平台采集健康度告警网络</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            多通道（企业微信 / 钉钉 / 飞书 / Webhook）自动化告警分发、防刷风暴控制与历史留痕
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/sources"
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            ← 返回数据源中枢
          </Link>
          <AlertRuleModal availableSources={data.availableSources} />
        </div>
      </div>

      {/* 3 大关键指标卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">已配置规则总数</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheckIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tnum">{data.totalRules}</span>
            <span className="text-xs text-slate-500">条规则</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            涵盖全平台 Global 兜底与独立数据源
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">当前活跃监听中</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ClockIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 tnum">
              {rules.filter((r) => r.enabled).length}
            </span>
            <span className="text-xs text-slate-500">/ {rules.length} 启用</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            每轮抓取结束或拨测异常时毫秒级判定
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">今日触发告警量</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <BellIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 tnum">{data.todayFiredCount}</span>
            <span className="text-xs text-slate-500">次触达</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            内置静默期防刷策略，阻断重复报警风暴
          </div>
        </div>
      </div>

      {/* 告警规则列表 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShieldAlertIcon className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-800">告警分发规则清单</h2>
            <span className="text-xs text-slate-400 font-mono">({rules.length})</span>
          </div>
          <span className="text-xs text-slate-500">
            支持一键测试通道连通性与随时启停
          </span>
        </div>

        {rules.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-400 mb-3">
              <BellIcon className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-medium text-slate-800">暂未配置任何告警规则</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              建议配置企业微信或钉钉群机器人规则，当数据源接口变动或连续失败时及时获得通知。
            </p>
            <div className="mt-4">
              <AlertRuleModal availableSources={data.availableSources} />
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rules.map((rule) => {
              const isGlobal = rule.scope === "global";
              const isTesting = testingId === rule.id;
              const currentTestResult = testResult?.id === rule.id ? testResult : null;

              return (
                <div key={rule.id} className="p-5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* 左侧：监控规则详情 */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Scope badge */}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isGlobal
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {rule.scopeLabel}
                        </span>

                        {/* Channel badge */}
                        <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {rule.channelLabel}
                        </span>

                        {/* Status badge */}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            rule.enabled
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {rule.enabled ? "运行中" : "已停用"}
                        </span>
                      </div>

                      {/* Condition line */}
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <span>触发条件：</span>
                        <span className="text-rose-600">{rule.conditionLabel}</span>
                      </div>

                      {/* Webhook & Cooldown line */}
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">推送目标:</span>
                          <span
                            className="text-slate-600 truncate max-w-xs sm:max-w-md"
                            title={rule.target}
                          >
                            {rule.target}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">静默期:</span>
                          <span className="text-slate-700">{rule.cooldownMinutes} 分钟</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">历史触发:</span>
                          <span className="text-slate-700 tnum">{rule.recentFiredCount} 次</span>
                        </div>
                      </div>

                      {/* Inline test result message */}
                      {currentTestResult && (
                        <div
                          className={`mt-2 p-2 rounded text-xs flex items-center gap-2 ${
                            currentTestResult.success
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                              : "bg-rose-50 border border-rose-200 text-rose-800"
                          }`}
                        >
                          {currentTestResult.success ? (
                            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <ShieldAlertIcon className="h-4 w-4 shrink-0 text-rose-600" />
                          )}
                          <span>{currentTestResult.msg}</span>
                        </div>
                      )}
                    </div>

                    {/* 右侧操作区：测试、启停 Toggle、删除 */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleQuickTest(rule)}
                        disabled={isTesting}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${isTesting ? "animate-spin" : ""}`} />
                        <span>{isTesting ? "测试中..." : "在线测试"}</span>
                      </button>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        disabled={isPending}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          rule.enabled ? "bg-primary" : "bg-slate-200"
                        }`}
                        role="switch"
                        aria-checked={rule.enabled}
                        title={rule.enabled ? "点击停用规则" : "点击启用规则"}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            rule.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="删除此规则"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 历史告警触发流水审计 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-800">近期告警分发审计记录</h2>
            <span className="text-xs text-slate-400 font-mono">
              (最近 {data.recentRecords.length} 条)
            </span>
          </div>
          <span className="text-xs text-slate-400">保留近 40 条历史留痕记录</span>
        </div>

        {data.recentRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            暂无告警触发记录，平台运行平稳
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30 text-slate-500">
                  <th className="py-2.5 px-4 font-semibold">触发时间</th>
                  <th className="py-2.5 px-4 font-semibold">通知通道</th>
                  <th className="py-2.5 px-4 font-semibold">监控范围</th>
                  <th className="py-2.5 px-4 font-semibold">告警通知报文</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap tnum">
                      {new Date(rec.firedAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-medium">
                        {rec.ruleChannel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-mono text-slate-600">
                      {rec.ruleScope}
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="text-slate-800 font-sans line-clamp-2" title={rec.message}>
                        {rec.message}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
