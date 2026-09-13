"use client";

import { useState, useTransition } from "react";
import { submitBankProofAction } from "@/app/actions/payments";
import { CheckCircleIcon } from "@/components/icons";

interface Props {
  orderNo: string;
  defaultPayerName?: string;
  existingNote?: string | null;
}

export default function BankProofForm({
  orderNo,
  defaultPayerName = "",
  existingNote,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const hasSubmitted = !!existingNote && existingNote.includes("对公汇款凭证");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("orderNo", orderNo);

    startTransition(async () => {
      const res = await submitBankProofAction(formData);
      if (res.success) {
        setSuccess(true);
      } else {
        setErrorMsg(res.error || "提交失败，请重试");
      }
    });
  };

  if (hasSubmitted || success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs text-emerald-900">
            <div className="font-bold text-sm text-emerald-800">
              对公转账汇款凭证已成功登记！
            </div>
            <p className="text-emerald-700 leading-relaxed">
              财务专员将在收到银行入账流水后（通常为 1-2 个工作日）完成订单核销并自动激活套餐权限。
            </p>
            {existingNote && (
              <div className="mt-2 rounded-lg bg-white/80 p-2.5 font-mono text-[11px] text-slate-700 border border-emerald-100">
                {existingNote}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5"
    >
      <div>
        <h3 className="text-sm font-bold text-slate-900">
          登记银行转账汇款凭证
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          完成对公打款后，请在此填写转账信息，以便财务人员优先对账核销。
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600 font-medium">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            汇款户名（付款公司全称） <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="payerName"
            required
            defaultValue={defaultPayerName}
            placeholder="例：北京某某科技有限公司"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            汇出银行名称
          </label>
          <input
            type="text"
            name="bankName"
            placeholder="例：中国工商银行北京分行"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block font-medium text-slate-700 mb-1">
            银行转账流水号 / 交易参考号 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="transactionRef"
            required
            placeholder="银行回单上的交易流水号或业务参考号"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block font-medium text-slate-700 mb-1">
            补充备注信息（选填）
          </label>
          <input
            type="text"
            name="note"
            placeholder="如加急核销需求、开票联系电话等"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-strong disabled:opacity-60"
        >
          {isPending ? "正在提交..." : "提交打款凭证，通知财务核销"}
        </button>
      </div>
    </form>
  );
}
