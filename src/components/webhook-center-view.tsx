"use client";

import React, { useState, useTransition } from "react";
import {
  BoltIcon,
  CheckIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  SparklesIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  CalendarIcon,
  TrophyIcon,
  TargetIcon,
  ScaleIcon,
} from "@/components/icons";
import {
  createWebhookEndpointAction,
  updateWebhookEndpointAction,
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
  testWebhookEndpointAction,
  simulateEventDispatchAction,
  type WebhookCenterData,
  type WebhookEndpointItem,
} from "@/app/actions/webhook-center";
import {
  WEBHOOK_EVENT_METAS,
  WEBHOOK_CHANNEL_METAS,
  type WebhookChannel,
  type WebhookEventType,
} from "@/lib/webhook-types";

interface WebhookCenterViewProps {
  initialData: WebhookCenterData;
  userName: string;
}

export default function WebhookCenterView({
  initialData,
  userName,
}: WebhookCenterViewProps) {
  const [data, setData] = useState<WebhookCenterData>(initialData);
  const [activeTab, setActiveTab] = useState<"endpoints" | "matrix" | "logs">("endpoints");
  const [isPending, startTransition] = useTransition();

  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpointItem | null>(null);

  // 表单状态
  const [formName, setFormName] = useState("");
  const [formChannel, setFormChannel] = useState<WebhookChannel>("WECOM");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<WebhookEventType[]>([
    "DEADLINE",
    "COMPETITOR",
    "AUDIT",
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // 在线测试中状态：记录每个 endpointId 的测试状态
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    endpointId: number;
    success: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // 模拟事件推送状态
  const [simulatingEvent, setSimulatingEvent] = useState<WebhookEventType | null>(null);
  const [simResult, setSimResult] = useState<{
    eventType: WebhookEventType;
    success: boolean;
    dispatchedCount?: number;
    successCount?: number;
    error?: string;
  } | null>(null);

  const openCreateModal = () => {
    setEditingEndpoint(null);
    setFormName("");
    setFormChannel("WECOM");
    setFormUrl("");
    setFormSecret("");
    setFormEvents(["DEADLINE", "COMPETITOR", "AUDIT"]);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (ep: WebhookEndpointItem) => {
    setEditingEndpoint(ep);
    setFormName(ep.name);
    setFormChannel(ep.channel);
    setFormUrl(ep.webhookUrl);
    setFormSecret(ep.secret || "");
    setFormEvents(ep.events);
    setFormError(null);
    setShowModal(true);
  };

  const handleToggleEvent = (type: WebhookEventType) => {
    if (formEvents.includes(type)) {
      setFormEvents(formEvents.filter((t) => t !== type));
    } else {
      setFormEvents([...formEvents, type]);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("请输入终端名称");
      return;
    }
    if (!formUrl.trim() || !formUrl.startsWith("http")) {
      setFormError("请输入完整的 Webhook 链接（以 http:// 或 https:// 开头）");
      return;
    }
    if (formEvents.length === 0) {
      setFormError("请至少选择一项订阅事件");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      if (editingEndpoint) {
        const res = await updateWebhookEndpointAction(editingEndpoint.id, {
          name: formName,
          channel: formChannel,
          webhookUrl: formUrl,
          secret: formSecret,
          events: formEvents,
        });
        if (!res.success) {
          setFormError(res.error || "更新失败");
          return;
        }
      } else {
        const res = await createWebhookEndpointAction({
          name: formName,
          channel: formChannel,
          webhookUrl: formUrl,
          secret: formSecret,
          events: formEvents,
        });
        if (!res.success) {
          setFormError(res.error || "创建失败");
          return;
        }
      }

      setShowModal(false);
      window.location.reload();
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`确定要删除机器人终端「${name}」吗？`)) return;
    startTransition(async () => {
      const res = await deleteWebhookEndpointAction(id);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          endpoints: prev.endpoints.filter((e) => e.id !== id),
          stats: {
            ...prev.stats,
            totalEndpoints: Math.max(0, prev.stats.totalEndpoints - 1),
          },
        }));
      }
    });
  };

  const handleToggle = (id: number, currentEnabled: boolean) => {
    startTransition(async () => {
      const res = await toggleWebhookEndpointAction(id, !currentEnabled);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          endpoints: prev.endpoints.map((e) =>
            e.id === id ? { ...e, enabled: !currentEnabled } : e
          ),
          stats: {
            ...prev.stats,
            activeEndpoints: currentEnabled
              ? Math.max(0, prev.stats.activeEndpoints - 1)
              : prev.stats.activeEndpoints + 1,
          },
        }));
      }
    });
  };

  const handleTest = (id: number) => {
    setTestingId(id);
    setTestResult(null);
    startTransition(async () => {
      const res = await testWebhookEndpointAction(id);
      setTestResult({
        endpointId: id,
        success: res.success,
        latencyMs: res.latencyMs,
        error: res.error,
      });
      setTestingId(null);
    });
  };

  const handleSimulateDispatch = (type: WebhookEventType) => {
    setSimulatingEvent(type);
    setSimResult(null);
    startTransition(async () => {
      const res = await simulateEventDispatchAction(type);
      setSimResult({
        eventType: type,
        success: res.success,
        dispatchedCount: res.dispatchedCount,
        successCount: res.successCount,
        error: res.error,
      });
      setSimulatingEvent(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xs">
              <BoltIcon className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              多渠道即时预警与 Webhook 路由中枢
            </h1>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              M2 企业版
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            企业微信、钉钉（加签校验）、飞书群机器人及通用 Webhook 统一接入，五大高危业务事件秒级触达作战群聊。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openCreateModal}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>接入新机器人终端</span>
          </button>
        </div>
      </div>

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">已配置终端</span>
            <BoltIcon className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {data.stats.totalEndpoints}
            </span>
            <span className="text-xs text-slate-500">个群机器人</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            席位归属：{userName}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">运行中活跃通道</span>
            <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 tnum">
              {data.stats.activeEndpoints}
            </span>
            <span className="text-xs text-emerald-600 font-medium">通道正常监听</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            支持一键启停任意机器人
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">今日成功投递</span>
            <CheckIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {data.stats.todaySuccessCount}
            </span>
            <span className="text-xs text-slate-500">次事件触达</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            截标/竞对/废标秒级分发
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">平均网络耗时</span>
            <ClockIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {data.stats.avgLatencyMs}
            </span>
            <span className="text-xs text-slate-500">毫秒 (ms)</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            实时专线网络往返延迟测算
          </div>
        </div>
      </div>

      {/* 选项卡导航 */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("endpoints")}
          className={`cursor-pointer flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "endpoints"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <BoltIcon className="h-4 w-4" />
          <span>终端与群机器人管理 ({data.endpoints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`cursor-pointer flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "matrix"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <SparklesIcon className="h-4 w-4" />
          <span>五大事件路由分发矩阵与模拟演练</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`cursor-pointer flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ClockIcon className="h-4 w-4" />
          <span>投递审计日志流水 ({data.recentLogs.length})</span>
        </button>
      </div>

      {/* Tab 1: 终端与机器人管理 */}
      {activeTab === "endpoints" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              已接入 <strong>{data.endpoints.length}</strong> 个办公协同群机器人。支持配置不同群聊接收不同的专项业务通知。
            </span>
            <button
              onClick={openCreateModal}
              className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>接入终端</span>
            </button>
          </div>

          {data.endpoints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-12 text-center">
              <BoltIcon className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800">
                暂未接入任何群机器人终端
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                添加企业微信群、钉钉群或飞书群自定义机器人 Webhook，让关键预警不再遗漏。
              </p>
              <button
                onClick={openCreateModal}
                className="mt-4 cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>立即接入新终端</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.endpoints.map((ep) => {
                const channelMeta = WEBHOOK_CHANNEL_METAS[ep.channel];
                const isTesting = testingId === ep.id;
                const testRes = testResult?.endpointId === ep.id ? testResult : null;

                return (
                  <div
                    key={ep.id}
                    className={`rounded-2xl border p-5 shadow-2xs transition-all flex flex-col justify-between ${
                      ep.enabled
                        ? "border-slate-200 bg-surface hover:border-slate-300"
                        : "border-slate-200 bg-slate-50/70 opacity-70"
                    }`}
                  >
                    <div>
                      {/* 头部渠道标签与开关 */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                              {channelMeta.label}
                            </span>
                            {ep.secret && (
                              <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                已配置加签密钥
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                ep.enabled
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  ep.enabled ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              />
                              <span>{ep.enabled ? "已启用" : "已停用"}</span>
                            </span>
                          </div>

                          <h3 className="mt-2 text-base font-bold text-slate-900 line-clamp-1">
                            {ep.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(ep)}
                            title="编辑配置"
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          >
                            <span className="text-xs font-medium">编辑</span>
                          </button>
                          <button
                            onClick={() => handleDelete(ep.id, ep.name)}
                            title="删除终端"
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Webhook 屏蔽脱敏展示 */}
                      <div className="mt-3 text-xs text-slate-500 font-mono truncate bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        {ep.webhookUrl.slice(0, 35)}...{ep.webhookUrl.slice(-10)}
                      </div>

                      {/* 订阅事件徽章列表 */}
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                          订阅分发的业务事件：
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ep.events.map((ev) => {
                            const meta = WEBHOOK_EVENT_METAS[ev];
                            return (
                              <span
                                key={ev}
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${meta.badgeCls}`}
                              >
                                {meta.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* 最近一次投递状态 */}
                      {ep.lastLog && (
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                          <span>最近投递：</span>
                          <span
                            className={
                              ep.lastLog.success ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"
                            }
                          >
                            {ep.lastLog.success ? "投递成功" : "投递失败"} (HTTP {ep.lastLog.statusCode} · {ep.lastLog.latencyMs}ms)
                          </span>
                        </div>
                      )}

                      {/* 在线测试返回反馈 */}
                      {testRes && (
                        <div
                          className={`mt-3 rounded-xl border p-2.5 text-xs font-medium ${
                            testRes.success
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          }`}
                        >
                          {testRes.success ? (
                            <div className="flex items-center gap-1.5">
                              <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                              <span>连通测试成功！响应耗时: {testRes.latencyMs}ms，测试卡片已发至群聊。</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <ShieldAlertIcon className="h-4 w-4 text-rose-600" />
                              <span>发送失败: {testRes.error || "无法连接目标地址"}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 底部操作条 */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        onClick={() => handleToggle(ep.id, ep.enabled)}
                        className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        {ep.enabled ? "点击停用" : "点击启用"}
                      </button>

                      <button
                        onClick={() => handleTest(ep.id)}
                        disabled={isTesting}
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        <BoltIcon className="h-3.5 w-3.5" />
                        <span>{isTesting ? "正在测试连通性..." : "一键测试发送"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 五大事件路由分发矩阵与模拟演练 */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              五大高危业务事件推送矩阵与模拟实测
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              系统在发生以下业务事件时，会自动组装公文级 Markdown 富文本卡片，推送到订阅了该事件的全部群机器人中。您可点击“模拟试发”立即在群内预览真实效果。
            </p>

            {simResult && (
              <div
                className={`mt-4 rounded-xl border p-3 text-xs font-medium ${
                  simResult.success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {simResult.success ? (
                  <span>
                    模拟事件触发成功！已成功分发给 {simResult.dispatchedCount} 个终端（成功 {simResult.successCount} 个）。请检查群聊卡片。
                  </span>
                ) : (
                  <span>模拟分发异常: {simResult.error}</span>
                )}
              </div>
            )}

            <div className="mt-5 space-y-4">
              {(
                [
                  {
                    type: "DEADLINE" as WebhookEventType,
                    title: "1. 截标倒计时紧急预警 (DEADLINE)",
                    desc: "距截标或开标不足 24h/48h 时触发红标紧急提醒，催办 CA 电子签章、保证金缴纳凭据与纸质胶装密封。",
                    icon: CalendarIcon,
                    badge: "bg-rose-100 text-rose-800 border-rose-300",
                    urgentText: "红色高危级别",
                  },
                  {
                    type: "COMPETITOR" as WebhookEventType,
                    title: "2. 竞对后院起火与渗透警报 (COMPETITOR)",
                    desc: "重点关注对手中标我方已跟进项目的采购人或低价杀入时秒级告警，包含下浮率透视与刺客提醒。",
                    icon: TargetIcon,
                    badge: "bg-amber-100 text-amber-800 border-amber-300",
                    urgentText: "橙色战略级别",
                  },
                  {
                    type: "AUDIT" as WebhookEventType,
                    title: "3. 标书深度质检一票否决警报 (AUDIT)",
                    desc: "送检文本中检出大写金额矛盾、残留模板占位符 [XXX公司] 或错写以往项目业主等废标隐患时立即发群通报。",
                    icon: ShieldAlertIcon,
                    badge: "bg-red-100 text-red-800 border-red-300",
                    urgentText: "一票废标隐患",
                  },
                  {
                    type: "DEPOSIT" as WebhookEventType,
                    title: "4. 投标保证金超期催讨提醒 (DEPOSIT)",
                    desc: "开标超期（法定期限）未退还保证金时触发法务维权催讨提示，附带相关财政法条依据。",
                    icon: ScaleIcon,
                    badge: "bg-purple-100 text-purple-800 border-purple-300",
                    urgentText: "资金风控提示",
                  },
                  {
                    type: "TENDER" as WebhookEventType,
                    title: "5. 重点高匹配新商机速递 (TENDER)",
                    desc: "符合企业关注赛道、资质与千万级以上优质招标公告实时推送给销售业务大群。",
                    icon: TrophyIcon,
                    badge: "bg-blue-100 text-blue-800 border-blue-300",
                    urgentText: "商机开拓情报",
                  },
                ]
              ).map((ev) => {
                const IconComponent = ev.icon;
                const subscribedEndpoints = data.endpoints.filter(
                  (ep) => ep.enabled && ep.events.includes(ev.type)
                );
                const isSimulating = simulatingEvent === ev.type;

                return (
                  <div
                    key={ev.type}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 max-w-2xl">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <IconComponent className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {ev.title}
                          </h4>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${ev.badge}`}
                          >
                            {ev.urgentText}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {ev.desc}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                          <span>当前接收机器人：</span>
                          {subscribedEndpoints.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {subscribedEndpoints.map((ep) => (
                                <span
                                  key={ep.id}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                                >
                                  {ep.name} ({WEBHOOK_CHANNEL_METAS[ep.channel].label})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">暂无机器人订阅该事件</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSimulateDispatch(ev.type)}
                        disabled={isSimulating || subscribedEndpoints.length === 0}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors disabled:opacity-40"
                      >
                        <SparklesIcon className="h-3.5 w-3.5 text-amber-400" />
                        <span>{isSimulating ? "正在模拟试发..." : "模拟试发卡片"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: 投递审计日志流水 */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              展示系统最近 <strong>{data.recentLogs.length}</strong> 条 Webhook 投递记录，包含 HTTP 状态码与耗时。
            </span>
          </div>

          {data.recentLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-12 text-center text-xs text-slate-500">
              暂无投递审计日志流水。
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-surface overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">投递时间</th>
                    <th className="px-4 py-3">目标机器人</th>
                    <th className="px-4 py-3">事件类型</th>
                    <th className="px-4 py-3">消息概要</th>
                    <th className="px-4 py-3">网络耗时</th>
                    <th className="px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentLogs.map((log) => {
                    const eventMeta = WEBHOOK_EVENT_METAS[log.eventType] || {
                      label: log.eventType,
                      badgeCls: "bg-slate-100 text-slate-700",
                    };

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap tnum font-mono">
                          {new Date(log.createdAt).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                          {log.endpointName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${eventMeta.badgeCls}`}
                          >
                            {eventMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={log.payloadSummary}>
                          {log.payloadSummary}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap tnum">
                          {log.latencyMs} ms
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.success ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <CheckIcon className="h-3.5 w-3.5" />
                              <span>200 OK</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-rose-600 font-semibold"
                              title={log.error || "未知异常"}
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                              <span>失败 ({log.statusCode || "网络错误"})</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 创建 / 编辑终端 Modal 弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BoltIcon className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingEndpoint ? "编辑机器人终端配置" : "接入企业协同群机器人终端"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  终端名称 (便于内部辨识) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：招投标作战-销售一部企微群、投标风控飞书大群"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  平台通道类型
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(WEBHOOK_CHANNEL_METAS).map((m) => (
                    <button
                      key={m.channel}
                      type="button"
                      onClick={() => setFormChannel(m.channel)}
                      className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${
                        formChannel === m.channel
                          ? "border-primary bg-primary/5 text-primary font-bold shadow-2xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-xs">{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Webhook 完整链接 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder={WEBHOOK_CHANNEL_METAS[formChannel].placeholder}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono text-xs focus:border-primary focus:outline-none"
                />
              </div>

              {WEBHOOK_CHANNEL_METAS[formChannel].hasSecret && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    安全加签密钥 / Secret (选填)
                  </label>
                  <input
                    type="password"
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                    placeholder="SEC 开头的密钥或飞书签名 Secret"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono text-xs focus:border-primary focus:outline-none"
                  />
                  {WEBHOOK_CHANNEL_METAS[formChannel].secretHelp && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {WEBHOOK_CHANNEL_METAS[formChannel].secretHelp}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  订阅分发的业务预警事件 (多选) <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {(["DEADLINE", "COMPETITOR", "AUDIT", "DEPOSIT", "TENDER"] as WebhookEventType[]).map(
                    (t) => {
                      const meta = WEBHOOK_EVENT_METAS[t];
                      const isChecked = formEvents.includes(t);
                      return (
                        <label
                          key={t}
                          className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                            isChecked
                              ? "border-primary/40 bg-primary/5"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEvent(t)}
                            className="mt-0.5 rounded text-primary focus:ring-primary"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{meta.label}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {meta.description}
                            </div>
                          </div>
                        </label>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                  <span>{isPending ? "正在保存..." : "确认保存配置"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
