"use client";

import { useState } from "react";
import {
  saveCompanyProfileAction,
  type CompanyProfileData,
} from "@/app/actions/company-profile";

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: CompanyProfileData | null;
  onSaved: () => void;
}

export function CompanyProfileModal({
  isOpen,
  onClose,
  initialData,
  onSaved,
}: CompanyProfileModalProps) {
  const [companyName, setCompanyName] = useState(initialData?.companyName || "");
  const [registeredCapital, setRegisteredCapital] = useState(initialData?.registeredCapital || "1000 万元");
  const [certInput, setCertInput] = useState(
    initialData?.certifications?.join("，") || "ISO9001认证，高新技术企业，信息安全ISO27001",
  );
  const [qualInput, setQualInput] = useState(
    initialData?.qualifications?.join("，") || "电子与智能化工程专业承包一级，信息系统集成资质",
  );
  const [caseTitle, setCaseTitle] = useState(initialData?.keyCases?.[0]?.title || "某市政务信息化集成与运维项目");
  const [caseAmount, setCaseAmount] = useState(initialData?.keyCases?.[0]?.amount || "480 万元");
  const [caseYear, setCaseYear] = useState(initialData?.keyCases?.[0]?.year || "2025");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("请填写企业法定全称");
      return;
    }

    setSubmitting(true);
    setError(null);

    const certifications = certInput
      .split(/[，,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const qualifications = qualInput
      .split(/[，,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const keyCases = caseTitle.trim()
      ? [{ title: caseTitle.trim(), amount: caseAmount.trim(), year: caseYear.trim() }]
      : [];

    const res = await saveCompanyProfileAction({
      companyName: companyName.trim(),
      registeredCapital: registeredCapital.trim(),
      certifications,
      qualifications,
      keyCases,
    });

    setSubmitting(false);

    if (res.success) {
      onSaved();
      onClose();
    } else {
      setError(res.error || "保存失败，请稍后重试");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              维护企业资质画像
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              录入企业硬资质与代表业绩，AI 将自动对照标书要求进行赢面评分
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          {error && (
            <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-slate-700">企业全称 *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例如：北京华泰信息科技有限公司"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700">注册资本</label>
              <input
                type="text"
                value={registeredCapital}
                onChange={(e) => setRegisteredCapital(e.target.value)}
                placeholder="例如：2000 万元"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700">
              体系认证与企业荣誉（逗号分隔）
            </label>
            <input
              type="text"
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              placeholder="ISO9001，ISO27001，高新技术企业，专精特新"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700">
              行业资质与承包等级（逗号分隔）
            </label>
            <input
              type="text"
              value={qualInput}
              onChange={(e) => setQualInput(e.target.value)}
              placeholder="电子与智能化工程专业承包一级，信息系统集成资质"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-hidden"
            />
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <label className="font-semibold text-slate-700 block mb-1">
              近三年标杆类似案例（供商务分对照）
            </label>
            <div className="grid grid-cols-6 gap-2">
              <input
                type="text"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                placeholder="项目名称（如政务云项目）"
                className="col-span-3 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:outline-hidden"
              />
              <input
                type="text"
                value={caseAmount}
                onChange={(e) => setCaseAmount(e.target.value)}
                placeholder="金额（如480万元）"
                className="col-span-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:outline-hidden"
              />
              <input
                type="text"
                value={caseYear}
                onChange={(e) => setCaseYear(e.target.value)}
                placeholder="年份"
                className="col-span-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="cursor-pointer rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-strong transition-colors disabled:opacity-50"
            >
              {submitting ? "正在保存..." : "保存资质画像"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
