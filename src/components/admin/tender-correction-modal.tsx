"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheckIcon,
  ShieldAlertIcon,
  ExternalLinkIcon,
  LockClosedIcon,
} from "@/components/icons";
import { applyTenderCorrectionAction } from "@/app/admin/feedbacks/actions";

interface TenderInfo {
  id: number;
  title: string;
  sourceName: string;
  sourceUrl?: string | null;
  budgetAmount?: number | string | null;
  expireDate?: string | null;
  openTime?: string | null;
  projectNo?: string | null;
  winningSupplier?: string | null;
  purchaser?: string | null;
  fieldsConfidence?: Record<string, number> | null;
}

interface Props {
  feedbackId: number;
  issueType: string;
  issueLabel: string;
  description: string;
  userName?: string;
  contact?: string | null;
  tender: TenderInfo;
}

export default function TenderCorrectionModal({
  feedbackId,
  issueType,
  issueLabel,
  description,
  userName,
  contact,
  tender,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [budgetAmount, setBudgetAmount] = useState<string>(
    tender.budgetAmount ? String(tender.budgetAmount) : ""
  );
  const [expireDate, setExpireDate] = useState<string>(
    tender.expireDate ? tender.expireDate.slice(0, 10) : ""
  );
  const [openTime, setOpenTime] = useState<string>(tender.openTime || "");
  const [projectNo, setProjectNo] = useState<string>(tender.projectNo || "");
  const [winningSupplier, setWinningSupplier] = useState<string>(
    tender.winningSupplier || ""
  );
  const [purchaser, setPurchaser] = useState<string>(tender.purchaser || "");
  const [adminNote, setAdminNote] = useState<string>(
    `核对源站公告无误，已人工修正核心字段并锁定置信度`
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData();
    formData.set("feedbackId", String(feedbackId));
    formData.set("tenderId", String(tender.id));
    formData.set("budgetAmount", budgetAmount);
    formData.set("expireDate", expireDate);
    formData.set("openTime", openTime);
    formData.set("projectNo", projectNo);
    formData.set("winningSupplier", winningSupplier);
    formData.set("purchaser", purchaser);
    formData.set("adminNote", adminNote);

    startTransition(async () => {
      const res = await applyTenderCorrectionAction(formData);
      if (res.success) {
        setIsOpen(false);
      } else {
        setFormError(res.error || "纠错提交失败");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setFormError(null);
        }}
        className="cursor-pointer inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover transition-colors shadow-2xs"
      >
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        <span>核实纠错</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-2xl bg-surface rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-primary rounded-xl">
                  <ShieldCheckIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    标讯数据纠错与人工置信度核准
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    核对官方原文后直接修正标讯字段，系统将对修正字段施加 1.0 置信度保护锁
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 用户反馈详情卡片 */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {issueLabel} ({issueType})
                  </span>
                  <span className="text-xs text-slate-500">
                    反馈用户：{userName || "访客"} {contact ? `(${contact})` : ""}
                  </span>
                </div>

                {tender.sourceUrl && (
                  <a
                    href={tender.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover underline underline-offset-2"
                  >
                    <span>打开官方源站原文</span>
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600">报错公告：</span>
                <span className="text-xs text-slate-900 font-medium ml-1">
                  {tender.title}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                <span className="font-semibold text-slate-900 block mb-1">用户反馈描述：</span>
                {description}
              </div>
            </div>

            {/* 纠错表单 */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <ShieldAlertIcon className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 预算金额 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    预算金额 / 采购限价 (元)
                  </label>
                  <input
                    type="text"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="如: 3800000 或 380万元"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    支持输入数字或带万单位 (如 120.5万元)
                  </span>
                </div>

                {/* 投标截止日期 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    投标截止时间 (Expire Date)
                  </label>
                  <input
                    type="date"
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                </div>

                {/* 开标时间 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    开标时间 (Open Time)
                  </label>
                  <input
                    type="text"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    placeholder="如: 2026年10月15日 09:30"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* 项目编号 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    项目/招标编号 (Project No)
                  </label>
                  <input
                    type="text"
                    value={projectNo}
                    onChange={(e) => setProjectNo(e.target.value)}
                    placeholder="如: ZFCG-2026-0891"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                </div>

                {/* 中标供应商 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    中标供应商 / 中标候选人
                  </label>
                  <input
                    type="text"
                    value={winningSupplier}
                    onChange={(e) => setWinningSupplier(e.target.value)}
                    placeholder="中标单位全称"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* 采购单位 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    采购人单位全称
                  </label>
                  <input
                    type="text"
                    value={purchaser}
                    onChange={(e) => setPurchaser(e.target.value)}
                    placeholder="采购单位名称"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* 处理结论备注 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  处理结论与审计备注 (Admin Note)
                </label>
                <input
                  type="text"
                  required
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* 置信度保护说明 */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-primary flex items-start gap-2.5">
                <LockClosedIcon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span className="leading-relaxed">
                  <strong>置信度顶格锁定机制：</strong>
                  提交后，所编辑的字段将被赋予 1.0 置信度并记录到公告元数据中。爬虫引擎在执行增量同步时将根据规则自动保护人工校对成果，永不覆盖退回。
                </span>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover active:bg-primary-active rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "正在保存并锁定..." : "确认采纳纠错并修正入库"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
