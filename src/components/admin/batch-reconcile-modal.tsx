"use client";

import { useState, useTransition } from "react";
import { batchReconcileStatementsAction } from "@/app/admin/orders/actions";
import type { ReconcileResult } from "@/lib/bank-transfer-listener";

export default function BatchReconcileModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [results, setResults] = useState<ReconcileResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReconcile = () => {
    if (!rawText.trim()) return;
    startTransition(async () => {
      const res = await batchReconcileStatementsAction(rawText);
      if (res.success) {
        setResults(res.results);
      }
    });
  };

  const handleInsertSample = () => {
    setRawText(`【工商银行】您尾号0973的账户于2026年09月28日 14:25 汇款入账 人民币 6,800.00元，对方户名：北京博创智联科技有限公司，交易流水号：ICBC202609280918234，附言/摘要：8921 购买标讯通企业标准版。

招商银行通知：您账户入账人民币16,800.00元，付款人：中建八局第一建设有限公司，流水号：CMB88291039812，转账附言：[7342]年费采购款。`);
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setResults(null);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition shadow-2xs"
      >
        <span>⚡</span> 网银动账/流水批量智能核销
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>⚡</span> 网银动账流水智能撮合与自动核销
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  粘贴银行邮件、短信或企业网银明细纯文本，系统自动识别 4 位匹配码与金额并秒级放行
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {!results ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700">粘贴动账流水文本：</span>
                  <button
                    type="button"
                    onClick={handleInsertSample}
                    className="text-primary hover:underline"
                  >
                    插入工行/招行示例
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="在此直接粘贴一段或多段银行动账通知（工行、招行、建行、支付宝等均可识别）..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-hidden"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleReconcile}
                    disabled={isPending || !rawText.trim()}
                    className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "正在撮合核验中..." : "开始智能撮合核销"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {results.map((r, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 text-xs space-y-1 ${
                        r.status === "MATCHED"
                          ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                          : r.status === "ALREADY_PAID"
                          ? "border-blue-200 bg-blue-50/50 text-blue-900"
                          : r.status === "AMOUNT_MISMATCH"
                          ? "border-amber-200 bg-amber-50/50 text-amber-900"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>
                            {r.status === "MATCHED"
                              ? "✅ 核销开通成功"
                              : r.status === "ALREADY_PAID"
                              ? "ℹ️ 已开通订单"
                              : r.status === "AMOUNT_MISMATCH"
                              ? "⚠️ 金额不一致"
                              : "❌ 未匹配订单"}
                          </span>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white/70 border border-slate-200/50">
                            {r.statement.bankName}
                          </span>
                        </div>
                        {r.statement.matchingCode && (
                          <span className="font-mono font-bold">
                            附言码: [{r.statement.matchingCode}]
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        金额: ¥{r.statement.amount} | 付款方: {r.statement.payerName || "未识别"}
                      </div>
                      <div className="text-[11px] font-medium pt-0.5">{r.message}</div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    共分析 {results.length} 条记录，已核销的订单已实时生效
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setResults(null);
                        setRawText("");
                      }}
                      className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      再次核销
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                    >
                      完成并关闭
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
