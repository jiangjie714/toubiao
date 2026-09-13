"use client";

import { useState, useTransition } from "react";
import { PlusIcon, BellIcon, ShieldAlertIcon, CheckCircleIcon } from "@/components/icons";
import { createAlertRuleAction, testAlertChannelAction } from "@/app/admin/sources/actions";

interface Props {
  availableSources: Array<{ skillCode: string; name: string }>;
}

export default function AlertRuleModal({ availableSources }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [scope, setScope] = useState<string>("global");
  const [condition, setCondition] = useState<string>("health_below");
  const [threshold, setThreshold] = useState<number>(70);
  const [channel, setChannel] = useState<string>("wecom_webhook");
  const [target, setTarget] = useState<string>("");
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(60);

  const handleTestChannel = async () => {
    if (!target.trim()) {
      setTestResult({ success: false, msg: "请先输入 Webhook 地址后再进行测试" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAlertChannelAction(channel, target.trim());
      if (res.success) {
        setTestResult({ success: true, msg: "测试消息发送成功！请前往对应的群或接收端查收。" });
      } else {
        setTestResult({ success: false, msg: res.error || "发送测试消息失败，请检查网络或 Webhook 地址" });
      }
    } catch {
      setTestResult({ success: false, msg: "网络请求异常，测试发送失败" });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) {
      setFormError("Webhook 地址不能为空");
      return;
    }

    setFormError(null);
    const formData = new FormData();
    formData.set("scope", scope);
    formData.set("condition", condition);
    formData.set("threshold", String(condition === "zero_parsed" ? 0 : threshold));
    formData.set("channel", channel);
    formData.set("target", target.trim());
    formData.set("cooldownMinutes", String(cooldownMinutes));

    startTransition(async () => {
      const res = await createAlertRuleAction(formData);
      if (res.success) {
        setIsOpen(false);
        // Reset form
        setTarget("");
        setTestResult(null);
      } else {
        setFormError(res.error || "创建规则失败");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setTestResult(null);
          setFormError(null);
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover active:bg-primary-active rounded-lg transition-colors shadow-xs"
      >
        <PlusIcon className="h-4 w-4" />
        <span>新增告警规则</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <BellIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">配置数据源监控告警规则</h3>
                  <p className="text-xs text-slate-500 mt-0.5">当站点异常、健康分跌破阈值或抓取零条时自动推送通知</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
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

              {/* 监控范围 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  监控范围 (Scope)
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="global">全平台全部数据源 (Global)</option>
                  <optgroup label="指定单个数据源">
                    {availableSources.map((s) => (
                      <option key={s.skillCode} value={`source:${s.skillCode}`}>
                        {s.name} ({s.skillCode})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  选择 Global 可兜底全库任意数据源；也可针对重点来源设立更敏锐的专有规则。
                </p>
              </div>

              {/* 触发条件与阈值 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    触发条件 (Condition)
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCondition(val);
                      if (val === "health_below") setThreshold(70);
                      else if (val === "consecutive_failures") setThreshold(3);
                    }}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="health_below">健康分低于阈值</option>
                    <option value="consecutive_failures">连续抓取失败次数</option>
                    <option value="zero_parsed">单次抓取为 0 条 (改版预警)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    判定阈值 (Threshold)
                  </label>
                  {condition === "zero_parsed" ? (
                    <input
                      type="text"
                      disabled
                      value="固定为 0 条"
                      className="w-full text-sm border border-slate-200 bg-slate-50 text-slate-400 rounded-lg px-3 py-2"
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max={condition === "health_below" ? 100 : 20}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                        {condition === "health_below" ? "分" : "次"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 推送通道 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  告警推送渠道 (Channel)
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="wecom_webhook">企业微信群机器人 (WeCom)</option>
                  <option value="dingtalk_webhook">钉钉自定义机器人 (DingTalk)</option>
                  <option value="feishu_webhook">飞书群机器人 (Feishu)</option>
                  <option value="webhook">通用 Webhook (HTTP POST JSON)</option>
                </select>
              </div>

              {/* Webhook 接收地址 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Webhook 接收地址 / 目标 URL
                </label>
                <div className="space-y-1.5">
                  <input
                    type="url"
                    required
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={
                      channel === "wecom_webhook"
                        ? "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                        : channel === "dingtalk_webhook"
                        ? "https://oapi.dingtalk.com/robot/send?access_token=..."
                        : channel === "feishu_webhook"
                        ? "https://open.feishu.cn/open-apis/bot/v2/hook/..."
                        : "https://your-api.com/webhooks/crawler-alert"
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 font-mono text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      请填入群机器人提供的完整 Webhook URL
                    </span>
                    <button
                      type="button"
                      onClick={handleTestChannel}
                      disabled={testing || !target.trim()}
                      className="text-xs text-primary hover:text-primary-hover font-medium underline underline-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {testing ? "测试发送中..." : "在线测试连通性"}
                    </button>
                  </div>
                </div>

                {/* 测试结果提示 */}
                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                      testResult.success
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border border-rose-200 text-rose-800"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <ShieldAlertIcon className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{testResult.msg}</span>
                  </div>
                )}
              </div>

              {/* 静默期 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  告警防刷静默期 (Cooldown)
                </label>
                <select
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value={15}>15 分钟（紧急监控）</option>
                  <option value={30}>30 分钟</option>
                  <option value={60}>60 分钟（推荐，默认）</option>
                  <option value={120}>2 小时</option>
                  <option value={360}>6 小时</option>
                  <option value={1440}>24 小时（仅每天通知一次）</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  同一规则在静默周期内不会重复发出通知，防止目标站点故障时引发机器人告警风暴。
                </p>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover active:bg-primary-active rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {isPending ? "保存规则中..." : "保存并启用规则"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
