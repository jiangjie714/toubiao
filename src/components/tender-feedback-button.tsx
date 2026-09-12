"use client";

import { useState, useActionState, useEffect } from "react";
import { submitFeedbackAction, type FeedbackState } from "@/app/actions/feedback";
import { ChatBubbleIcon } from "@/components/icons";

const ISSUE_OPTIONS = [
  { value: "AMOUNT_ERROR", label: "金额 / 预算 / 中标金额不准" },
  { value: "EXPIRED_ERROR", label: "发布时间 / 截止时间错误" },
  { value: "LINK_BROKEN", label: "原文链接 404 或失效" },
  { value: "CONTENT_ERROR", label: "正文内容解析混乱或缺失" },
  { value: "OTHER", label: "其他问题" },
];

export default function TenderFeedbackButton({ tenderId }: { tenderId: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(
    submitFeedbackAction,
    {},
  );

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        setOpen(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        <ChatBubbleIcon className="h-3.5 w-3.5 text-slate-400" />
        数据报错 / 纠错反馈
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">数据纠错与报错</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  如发现金额、时间、正文或链接有出入，请反馈给我们人工核对
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {state.success ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl font-bold text-emerald-600">
                  ✓
                </div>
                <h4 className="text-base font-bold text-slate-900">提交成功</h4>
                <p className="mt-1 text-xs text-slate-600">{state.message}</p>
              </div>
            ) : (
              <form action={formAction} className="mt-4 space-y-4">
                <input type="hidden" name="tenderId" value={tenderId} />

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    问题类型 <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="issueType"
                    required
                    defaultValue=""
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="" disabled>
                      请选择问题类型…
                    </option>
                    {ISSUE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    具体说明 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    rows={4}
                    required
                    placeholder="请尽量描述错误具体内容，例如：中标金额实际应为 120 万元，系统提取为了 12 万元…"
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    联系方式（选填）
                  </label>
                  <input
                    name="contact"
                    placeholder="手机号 / 微信 / 邮箱（便于核实后同步您）"
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {state.error && (
                  <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
                    {state.error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:opacity-50"
                  >
                    {pending ? "提交中…" : "提交反馈"}
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
