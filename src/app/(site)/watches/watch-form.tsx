"use client";

import { useState, useActionState } from "react";
import { createWatchAction, type WatchState } from "./actions";
import { testWebhookAction } from "@/app/actions/webhook";
import { CheckIcon, AlertCircleIcon, ShieldCheckIcon } from "@/components/icons";

type RegionOption = { code: string; name: string; parentCode?: string };

export default function WatchForm({
  provinces,
  cities,
}: {
  provinces: RegionOption[];
  cities: RegionOption[];
}) {
  const [state, formAction, pending] = useActionState<WatchState, FormData>(
    createWatchAction,
    {},
  );

  const [selectedChannel, setSelectedChannel] = useState<"email" | "wecom" | "dingtalk" | "feishu">("email");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testPending, setTestPending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestWebhook = async () => {
    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      setTestFeedback({ success: false, message: "请先输入完整的 Webhook URL" });
      return;
    }
    setTestPending(true);
    setTestFeedback(null);
    try {
      const res = await testWebhookAction({
        channel: selectedChannel as "wecom" | "dingtalk" | "feishu",
        webhookUrl: webhookUrl.trim(),
      });
      if (res.success) {
        setTestFeedback({ success: true, message: res.message || "测试消息发送成功！" });
      } else {
        setTestFeedback({ success: false, message: res.error || "机器人测试失败" });
      }
    } catch {
      setTestFeedback({ success: false, message: "测试连接超时，请检查网络" });
    } finally {
      setTestPending(false);
    }
  };

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-blue-100";

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-surface p-5">
      <div>
        <label className="text-sm font-medium text-slate-700">订阅名称</label>
        <input name="name" placeholder="例如：华东地区IT运维商机" required maxLength={30} className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">关键词</label>
        <input name="keyword" placeholder="例如：数字化、服务器、网络安全" required maxLength={50} className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">公告类型</label>
        <select name="type" className={inputClass} defaultValue="">
          <option value="">全部</option>
          <option value="NOTICE">招标公告</option>
          <option value="RESULT">中标公告</option>
          <option value="CHANGE">变更更正</option>
          <option value="INQUIRY">询价竞谈</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-700">省份</label>
          <select name="provinceCode" className={inputClass} defaultValue="">
            <option value="">全部省份</option>
            {provinces.map((province) => (
              <option key={province.code} value={province.code}>{province.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">城市</label>
          <select name="cityCode" className={inputClass} defaultValue="">
            <option value="">全部城市</option>
            {cities.map((city) => (
              <option key={city.code} value={city.code}>{city.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 推送频次策略 */}
      <div className="pt-2 border-t border-slate-100">
        <label className="text-sm font-medium text-slate-700 block mb-1.5">推送频次策略</label>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`flex flex-col gap-1 rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${
              frequency === "daily"
                ? "border-primary bg-blue-50/50 text-primary"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="frequency"
              value="daily"
              checked={frequency === "daily"}
              onChange={() => setFrequency("daily")}
              className="sr-only"
            />
            <span className="font-semibold flex items-center gap-1">
              <span>🌅 商机日报 (每日)</span>
            </span>
            <span className="text-[11px] text-slate-500 font-normal leading-tight">
              每日早间速递前 24h 新标讯
            </span>
          </label>

          <label
            className={`flex flex-col gap-1 rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${
              frequency === "weekly"
                ? "border-primary bg-blue-50/50 text-primary"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="frequency"
              value="weekly"
              checked={frequency === "weekly"}
              onChange={() => setFrequency("weekly")}
              className="sr-only"
            />
            <span className="font-semibold flex items-center gap-1">
              <span>📊 决策周报 (周一)</span>
            </span>
            <span className="text-[11px] text-slate-500 font-normal leading-tight">
              每周一汇总近 7 天高价值商机
            </span>
          </label>
        </div>
      </div>

      {/* 推送通道选择 */}
      <div className="pt-2 border-t border-slate-100">
        <label className="text-sm font-medium text-slate-700 block mb-1.5">推送信道</label>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors ${
              selectedChannel === "email"
                ? "border-primary bg-blue-50/50 text-primary"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="channel"
              value="email"
              checked={selectedChannel === "email"}
              onChange={() => setSelectedChannel("email")}
              className="sr-only"
            />
            <span>📧 邮件通知 (默认)</span>
          </label>

          <label
            className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors ${
              selectedChannel === "wecom"
                ? "border-primary bg-blue-50/50 text-primary"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="channel"
              value="wecom"
              checked={selectedChannel === "wecom"}
              onChange={() => setSelectedChannel("wecom")}
              className="sr-only"
            />
            <span>🤖 企业微信群机器人</span>
          </label>

          <label
            className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors ${
              selectedChannel === "dingtalk"
                ? "border-primary bg-blue-50/50 text-primary"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="channel"
              value="dingtalk"
              checked={selectedChannel === "dingtalk"}
              onChange={() => setSelectedChannel("dingtalk")}
              className="sr-only"
            />
            <span>📌 钉钉群自定义机器人</span>
          </label>

          <label
            className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors ${
              selectedChannel === "feishu"
                ? "border-primary bg-blue-50/50 text-primary"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="channel"
              value="feishu"
              checked={selectedChannel === "feishu"}
              onChange={() => setSelectedChannel("feishu")}
              className="sr-only"
            />
            <span>🚀 飞书自定义机器人</span>
          </label>
        </div>

        {/* 机器人 Webhook URL 输入框与在线测试 */}
        {selectedChannel !== "email" && (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                {selectedChannel === "wecom" && "企业微信 Webhook 链接"}
                {selectedChannel === "dingtalk" && "钉钉自定义机器人 Webhook 链接"}
                {selectedChannel === "feishu" && "飞书自定义机器人 Webhook 链接"}
              </label>
              <span className="text-[11px] text-primary flex items-center gap-1">
                <ShieldCheckIcon className="w-3 h-3" />
                支持一键测试连通
              </span>
            </div>
            <input
              name="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://qyapi.weixin.qq.com/... 或 https://oapi.dingtalk.com/..."
              className="block w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
              required
            />
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={testPending || !webhookUrl}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-blue-50 disabled:opacity-50"
              >
                {testPending ? "正在发送测试卡片…" : "⚡️ 发送测试卡片到群聊"}
              </button>
            </div>

            {testFeedback && (
              <div
                className={`rounded-md p-2 text-xs flex items-center gap-1.5 ${
                  testFeedback.success
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {testFeedback.success ? (
                  <CheckIcon className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 text-red-600" />
                )}
                <span>{testFeedback.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button
        disabled={pending}
        className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
      >
        {pending ? "创建中…" : "创建订阅"}
      </button>
    </form>
  );
}
