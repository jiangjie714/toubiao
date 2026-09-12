"use client";

import { useActionState, useState } from "react";
import { TENDER_TYPES, formatDate } from "@/lib/constants";
import type { Tender } from "@prisma/client";

type Region = { code: string; name: string; parentCode?: string };

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors duration-200 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1.5 block text-xs font-medium text-slate-500";

export default function TenderForm({
  action,
  tender,
  provinces,
  cities,
}: {
  action: (prev: { error?: string }, fd: FormData) => Promise<{ error?: string }>;
  tender?: Tender;
  provinces: Region[];
  cities: Region[];
}) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    action,
    {},
  );
  const [province, setProvince] = useState(tender?.provinceCode ?? "");
  const cityOptions = cities.filter((c) => c.parentCode === province);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-surface p-6">
      {tender && <input type="hidden" name="id" value={tender.id} />}
      <div>
        <label className={labelCls}>标题 *</label>
        <input name="title" required defaultValue={tender?.title} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <label className={labelCls}>信息类型 *</label>
          <select
            name="type"
            defaultValue={tender?.type ?? "NOTICE"}
            className={`${inputCls} cursor-pointer`}
          >
            {TENDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>发布日期 *</label>
          <input
            type="date"
            name="publishDate"
            required
            defaultValue={formatDate(tender?.publishDate ?? new Date())}
            className={`${inputCls} cursor-text`}
          />
        </div>
        <div>
          <label className={labelCls}>截止时间</label>
          <input
            type="date"
            name="expireDate"
            defaultValue={formatDate(tender?.expireDate)}
            className={`${inputCls} cursor-text`}
          />
        </div>
        <div>
          <label className={labelCls}>信息来源</label>
          <input
            name="sourceName"
            defaultValue={tender?.sourceName ?? "手动录入"}
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>省份</label>
          <select
            name="province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="">不指定</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>城市</label>
          <select
            name="city"
            key={province}
            defaultValue={tender?.cityCode ?? ""}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="">不指定</option>
            {cityOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls}>采购人/招标人</label>
          <input name="purchaser" defaultValue={tender?.purchaser ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>代理机构</label>
          <input name="agency" defaultValue={tender?.agency ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>原文链接</label>
          <input
            name="sourceUrl"
            type="url"
            defaultValue={tender?.sourceUrl ?? ""}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>正文内容 *</label>
        <textarea
          name="content"
          required
          rows={12}
          defaultValue={tender?.content}
          className={`${inputCls} resize-y font-mono leading-6`}
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-3 border-t border-slate-100 pt-5">
        <button
          disabled={pending}
          className="cursor-pointer rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "保存中…" : "保存"}
        </button>
        <a
          href="/admin/tenders"
          className="cursor-pointer rounded-lg border border-slate-200 px-6 py-2.5 text-sm text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
        >
          取消
        </a>
      </div>
    </form>
  );
}
