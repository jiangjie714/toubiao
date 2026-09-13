"use client";

import { useState, useTransition } from "react";
import {
  adminExtendSubscriptionAction,
  adminChangePlanAction,
} from "@/app/admin/actions";
import { ClockIcon, ShieldCheckIcon } from "@/components/icons";

interface Props {
  userId: number;
  userName: string;
  currentPlanCode: string;
  currentPlanName: string;
  currentEndsAt: string | null;
}

export default function SubscriptionActionModal({
  userId,
  userName,
  currentPlanCode,
  currentPlanName,
  currentEndsAt,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"extend" | "plan">("extend");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Extend form state
  const [days, setDays] = useState<number>(30);
  const [reason, setReason] = useState<string>("重点企业客户关怀赠送");

  // Plan form state
  const [planCode, setPlanCode] = useState<string>(currentPlanCode);
  const [billingCycle, setBillingCycle] = useState<string>("yearly");

  const handleExtend = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("userId", String(userId));
    formData.set("days", String(days));
    formData.set("reason", reason);

    startTransition(async () => {
      const res = await adminExtendSubscriptionAction(formData);
      if (res.success) {
        setMessage({ text: `已成功为 ${userName} 延期 ${days} 天！`, error: false });
        setTimeout(() => {
          setIsOpen(false);
          setMessage(null);
        }, 1200);
      } else {
        setMessage({ text: res.error || "延期失败，请重试", error: true });
      }
    });
  };

  const handleChangePlan = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("userId", String(userId));
    formData.set("planCode", planCode);
    formData.set("billingCycle", billingCycle);

    startTransition(async () => {
      const res = await adminChangePlanAction(formData);
      if (res.success) {
        setMessage({ text: `已成功变更套餐为 ${planCode}！`, error: false });
        setTimeout(() => {
          setIsOpen(false);
          setMessage(null);
        }, 1200);
      } else {
        setMessage({ text: res.error || "调整失败，请重试", error: true });
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-primary/40 hover:bg-blue-50/50 hover:text-primary"
      >
        <span>特权管理</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  客户成功特权操作 - {userName}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  当前套餐：{currentPlanName} ({currentPlanCode}) | 到期日：
                  {currentEndsAt ? new Date(currentEndsAt).toLocaleDateString("zh-CN") : "长期有效"}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Tab 切换 */}
            <div className="mt-4 flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("extend");
                  setMessage(null);
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  mode === "extend"
                    ? "bg-white text-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                赠送延期天数
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("plan");
                  setMessage(null);
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  mode === "plan"
                    ? "bg-white text-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                变更套餐规格
              </button>
            </div>

            {message && (
              <div
                className={`mt-4 rounded-lg p-3 text-xs font-medium ${
                  message.error
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {message.text}
              </div>
            )}

            {mode === "extend" ? (
              <form onSubmit={handleExtend} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    快捷快捷延期选项
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "+7天", val: 7 },
                      { label: "+30天", val: 30 },
                      { label: "+90天", val: 90 },
                      { label: "+1年", val: 365 },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        type="button"
                        onClick={() => setDays(btn.val)}
                        className={`rounded-lg border py-2 text-xs font-bold transition ${
                          days === btn.val
                            ? "border-primary bg-blue-50 text-primary"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    延期天数 (天)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    required
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    延期原因 / 关怀备注
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="例：大客户谈判签约延期、故障关怀赠送"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <ClockIcon className="h-4 w-4" />
                    <span>{isPending ? "提交中..." : "确认延期"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleChangePlan} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    目标套餐级别
                  </label>
                  <select
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    <option value="GOLD">黄金会员 (GOLD)</option>
                    <option value="PLATINUM">白金会员 (PLATINUM)</option>
                    <option value="ENTERPRISE_STANDARD">企业标准版 (ENTERPRISE_STANDARD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    计费周期
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    <option value="monthly">按月订阅 (Monthly)</option>
                    <option value="yearly">按年订阅 (Yearly)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>{isPending ? "调整中..." : "确认调整套餐"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
