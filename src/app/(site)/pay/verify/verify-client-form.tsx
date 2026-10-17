"use client";

import { useState, useTransition } from "react";
import { auditOrderPaymentAction } from "@/app/actions/payments";
import { CheckCircleIcon, AlertCircleIcon, ClockIcon } from "@/components/icons";

interface Props {
  orderNo: string;
  auditToken: string;
  currentStatus: string;
}

export default function VerifyClientForm({
  orderNo,
  auditToken,
  currentStatus,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"APPROVED" | "REJECTED" | null>(
    currentStatus === "PAID" ? "APPROVED" : null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAudit = (action: "APPROVE" | "REJECT") => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await auditOrderPaymentAction({
        orderNo,
        action,
        auditToken,
        auditNote: action === "REJECT" ? (rejectReason.trim() || "未核对到到账流水，请核实凭证") : undefined,
      });
      if (res.success) {
        setResult(action === "APPROVE" ? "APPROVED" : "REJECTED");
      } else {
        setErrorMsg(res.error || "审核处理失败，请重试");
      }
    });
  };

  if (result === "APPROVED") {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center">
        <CheckCircleIcon className="mx-auto h-10 w-10 text-emerald-600" />
        <h3 className="mt-2 text-base font-bold text-emerald-950">
          款项核销成功，已即刻开通会员特权！
        </h3>
        <p className="mt-1 text-xs text-emerald-700">
          用户收银台终端已自动同步入账，开票待办已写入财务系统。
        </p>
      </div>
    );
  }

  if (result === "REJECTED") {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
        <AlertCircleIcon className="mx-auto h-10 w-10 text-amber-600" />
        <h3 className="mt-2 text-base font-bold text-amber-950">已驳回该笔转账申请</h3>
        <p className="mt-1 text-xs text-amber-700">
          订单已恢复为待付款状态，用户端已收到驳回说明与补交指引。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 font-medium">
          {errorMsg}
        </div>
      )}

      {showRejectInput ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
          <label className="block text-xs font-semibold text-slate-700">
            驳回原因说明（将向用户呈现）：
          </label>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="例如：微信未收到¥299打款，或识别码不符"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAudit("REJECT")}
              disabled={isPending}
              className="flex-1 cursor-pointer rounded-lg bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition"
            >
              {isPending ? "处理中..." : "确认驳回订单"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectInput(false)}
              className="px-4 cursor-pointer rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleAudit("APPROVE")}
            disabled={isPending}
            className="cursor-pointer rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700 flex items-center justify-center gap-1.5 active:scale-[0.99]"
          >
            {isPending ? (
              <ClockIcon className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircleIcon className="h-4 w-4" />
            )}
            <span>✓ 确认到账并放行</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRejectInput(true)}
            disabled={isPending}
            className="cursor-pointer rounded-xl border border-red-200 bg-red-50/80 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
          >
            ✗ 未到账 / 驳回
          </button>
        </div>
      )}
    </div>
  );
}
