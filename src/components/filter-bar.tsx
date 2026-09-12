"use client";

import { useState } from "react";
import { TENDER_TYPES } from "@/lib/constants";
import { SearchIcon, FunnelIcon } from "@/components/icons";

type Province = { code: string; name: string };
type City = { code: string; name: string; parentCode: string };

const inputCls =
  "w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors duration-200 placeholder:text-slate-500 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1.5 block text-xs font-medium text-slate-500";

export default function FilterBar({
  provinces,
  cities,
  defaults,
  basePath = "/list",
}: {
  provinces: Province[];
  cities: City[];
  defaults: { q: string; type: string; province: string; city: string; from: string; to: string };
  basePath?: string;
}) {
  const [province, setProvince] = useState(defaults.province);
  const cityOptions = cities.filter((c) => c.parentCode === province);

  return (
    <form
      action={basePath}
      method="get"
      className="rounded-xl border border-slate-200 bg-surface p-5"
    >
      <div className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <FunnelIcon className="h-4 w-4 text-accent" />
        筛选条件
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <label htmlFor="f-q" className={labelCls}>
            关键字
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="f-q"
              name="q"
              defaultValue={defaults.q}
              placeholder="标题或正文关键词"
              className={`${inputCls} pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="f-type" className={labelCls}>
            信息类型
          </label>
          <select id="f-type" name="type" defaultValue={defaults.type} className={inputCls}>
            <option value="">全部类型</option>
            {TENDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-province" className={labelCls}>
            省份
          </label>
          <select
            id="f-province"
            name="province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className={inputCls}
          >
            <option value="">全部地区</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-city" className={labelCls}>
            城市
          </label>
          <select
            id="f-city"
            name="city"
            defaultValue={defaults.city}
            key={province}
            className={inputCls}
          >
            <option value="">不限</option>
            {cityOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="f-from" className={labelCls}>
              发布起
            </label>
            <input
              id="f-from"
              type="date"
              name="from"
              defaultValue={defaults.from}
              className={`${inputCls} cursor-text px-2 text-xs`}
            />
          </div>
          <div>
            <label htmlFor="f-to" className={labelCls}>
              发布止
            </label>
            <input
              id="f-to"
              type="date"
              name="to"
              defaultValue={defaults.to}
              className={`${inputCls} cursor-text px-2 text-xs`}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
        >
          查询
        </button>
        <a
          href={basePath}
          className="cursor-pointer rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
        >
          重置
        </a>
      </div>
    </form>
  );
}
