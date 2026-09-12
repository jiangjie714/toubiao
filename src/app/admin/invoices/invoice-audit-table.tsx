"use client";

import React, { useState, useTransition } from "react";
import { adminIssueInvoiceAction, adminRejectInvoiceAction } from "./actions";
import InvoiceElectronicSheet from "@/components/invoice-electronic-sheet";
import { type InvoiceItem } from "@/app/actions/invoice";
import { DocumentTextIcon } from "@/components/icons";

interface AdminInvoiceData extends InvoiceItem {
  userName: string;
  userEmail: string | null;
}

interface Props {
  initialInvoices: AdminInvoiceData[];
}

export default function InvoiceAuditTable({ initialInvoices }: Props) {
  const invoices = initialInvoices;
  const [isPending, startTransition] = useTransition();

  // 查看凭证 Modal
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceItem | null>(null);

  // 驳回 Modal
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  // 开具 Modal
  const [issuingId, setIssuingId] = useState<number | null>(null);
  const [customCode, setCustomCode] = useState("");
  const [customNumber, setCustomNumber] = useState("");
  const [issueError, setIssueError] = useState("");

  const handleOpenIssue = (inv: AdminInvoiceData) => {
    setIssuingId(inv.id);
    setCustomCode("");
    setCustomNumber("");
    setIssueError("");
  };

  const handleConfirmIssue = () => {
    if (!issuingId) return;
    setIssueError("");

    startTransition(async () => {
      const res = await adminIssueInvoiceAction({
        invoiceId: issuingId,
        invoiceCode: customCode,
        invoiceNumber: customNumber,
      });

      if (!res.success) {
        setIssueError(res.error || "开具发票失败");
        return;
      }

      setIssuingId(null);
      window.location.reload();
    });
  };

  const handleConfirmReject = () => {
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      setRejectError("请输入驳回原因");
      return;
    }
    setRejectError("");

    startTransition(async () => {
      const res = await adminRejectInvoiceAction({
        invoiceId: rejectingId,
        reason: rejectReason.trim(),
      });

      if (!res.success) {
        setRejectError(res.error || "驳回失败");
        return;
      }

      setRejectingId(null);
      setRejectReason("");
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">订单号 / 用户</th>
              <th className="px-5 py-3 font-medium">发票类型 / 抬头</th>
              <th className="px-5 py-3 font-medium">税号 / 专票信息</th>
              <th className="px-5 py-3 font-medium">金额明细</th>
              <th className="px-5 py-3 font-medium">接收邮箱</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium text-right">审核操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => {
              const isPendingState = inv.status === "PENDING";
              const isIssued = inv.status === "ISSUED";
              const isRejected = inv.status === "REJECTED";

              return (
                <tr key={inv.id} className="hover:bg-blue-50/40">
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-xs text-slate-700">{inv.orderNo}</div>
                    <div className="text-xs text-slate-500">{inv.userName}</div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      {inv.type === "SPECIAL" ? (
                        <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          专票
                        </span>
                      ) : (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          普票
                        </span>
                      )}
                      <span className="font-semibold text-slate-900 text-xs">{inv.title}</span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="font-mono text-xs text-slate-800">{inv.taxNumber}</div>
                    {inv.type === "SPECIAL" && (
                      <div className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate">
                        {inv.bankName} {inv.bankAccount}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900 tnum">¥{inv.amount.toFixed(2)}</div>
                    <div className="text-[11px] text-slate-400 tnum">
                      不含税 ¥{inv.amountWithoutTax.toFixed(2)} + 税额 ¥{inv.taxAmount.toFixed(2)}
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-xs text-slate-600">{inv.email}</td>

                  <td className="px-5 py-3.5">
                    {isPendingState && (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        待开具
                      </span>
                    )}
                    {isIssued && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        已开具
                      </span>
                    )}
                    {isRejected && (
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                        已驳回
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isPendingState && (
                        <>
                          <button
                            onClick={() => handleOpenIssue(inv)}
                            className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors shadow-xs"
                          >
                            审核开具
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(inv.id);
                              setRejectReason("");
                              setRejectError("");
                            }}
                            className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            驳回
                          </button>
                        </>
                      )}

                      {isIssued && (
                        <button
                          onClick={() => setViewingInvoice(inv)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <DocumentTextIcon className="h-3.5 w-3.5" />
                          <span>凭证</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">
                  暂无发票申请
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 审核开具 Modal */}
      {issuingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h4 className="font-semibold text-slate-900 pb-3 border-b border-slate-100">
              审核通过并核发电子发票
            </h4>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              确认企业抬头及纳税人识别号无误后，将为该客户核发国家标准版式电子发票凭证，并通过邮件通知客户。
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  发票代码 (选填，留空自动生成)
                </label>
                <input
                  type="text"
                  placeholder="例如: 031002600111"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  发票号码 (选填，留空自动生成)
                </label>
                <input
                  type="text"
                  placeholder="例如: 26849102"
                  value={customNumber}
                  onChange={(e) => setCustomNumber(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              {issueError && <p className="text-xs text-rose-600">{issueError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIssuingId(null)}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmIssue}
                className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
              >
                {isPending ? "正在核发..." : "确认核发发票"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 驳回 Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h4 className="font-semibold text-slate-900 pb-3 border-b border-slate-100">
              驳回开票申请
            </h4>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                驳回原因说明 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="例如: 纳税人识别号与全国企业信用公示系统登记不一致，请核对后重新提交。"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:border-primary focus:outline-none"
              />
              {rejectError && <p className="mt-1 text-xs text-rose-600">{rejectError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmReject}
                className="cursor-pointer rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                {isPending ? "正在处理..." : "确认驳回"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看发票凭证 Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <InvoiceElectronicSheet
              invoice={viewingInvoice}
              onClose={() => setViewingInvoice(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
