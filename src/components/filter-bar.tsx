"use client";

import { useState } from "react";
import { TENDER_TYPES } from "@/lib/constants";
import { SearchIcon, FunnelIcon, BoltIcon } from "@/components/icons";

type Province = { code: string; name: string };
type City = { code: string; name: string; parentCode: string };
type Industry = { code: string; name: string };

const inputCls =
  "w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1.5 block text-xs font-medium text-slate-500";

interface Props {
  provinces: Province[];
  cities: City[];
  industries?: Industry[];
  defaults: {
    q: string;
    type: string;
    province: string;
    city: string;
    from: string;
    to: string;
    minBudget?: string;
    maxBudget?: string;
    industryCode?: string;
    hasAttachment?: string;
  };
  basePath?: string;
}

export default function FilterBar({
  provinces,
  cities,
  industries = [],
  defaults,
  basePath = "/list",
}: Props) {
  const [province, setProvince] = useState(defaults.province);
  const cityOptions = cities.filter((c) => c.parentCode === province);

  const hasAdvancedActive = Boolean(
    defaults.minBudget ||
      defaults.maxBudget ||
      defaults.industryCode ||
      defaults.hasAttachment === "1"
  );
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedActive);

  const [minBudgetValue, setMinBudgetValue] = useState(defaults.minBudget || "");
  const [maxBudgetValue, setMaxBudgetValue] = useState(defaults.maxBudget || "");

  const handleSetBudgetPreset = (min?: number, max?: number) => {
    setMinBudgetValue(min !== undefined ? min.toString() : "");
    setMaxBudgetValue(max !== undefined ? max.toString() : "");
  };

  return (
    <form
      action={basePath}
      method="get"
      className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <FunnelIcon className="h-4.5 w-4.5 text-primary" />
          <span>精准筛选与多维搜索</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="cursor-pointer text-xs font-semibold text-primary hover:text-primary-strong flex items-center gap-1 transition-colors"
        >
          <BoltIcon className="h-3.5 w-3.5 text-accent" />
          <span>{showAdvanced ? "收起高级筛选 ▲" : "展开高级筛选 (金额/行业/附件) ▼"}</span>
        </button>
      </div>

      {/* 基础检索网格 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <label htmlFor="f-q" className={labelCls}>
            关键词 (支持多词空格组合)
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="f-q"
              name="q"
              defaultValue={defaults.q}
              placeholder="支持空格分隔多词，如：医院 医疗设备"
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

      {/* 高级筛选抽屉 / 折叠区 */}
      {showAdvanced && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 transition-all duration-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* 1. 行业分类筛选 */}
            <div>
              <label htmlFor="f-industry" className={labelCls}>
                国民经济 / 采购行业分类
              </label>
              <select
                id="f-industry"
                name="industryCode"
                defaultValue={defaults.industryCode || ""}
                className={inputCls}
              >
                <option value="">全部行业门类</option>
                {industries.map((ind) => (
                  <option key={ind.code} value={ind.code}>
                    {ind.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. 预算金额区间 (万元) */}
            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls}>预算金额区间 (万元)</label>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleSetBudgetPreset(undefined, 100)}
                    className="hover:text-primary cursor-pointer"
                  >
                    &lt;100万
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => handleSetBudgetPreset(100, 500)}
                    className="hover:text-primary cursor-pointer"
                  >
                    100-500万
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => handleSetBudgetPreset(500, undefined)}
                    className="hover:text-primary cursor-pointer"
                  >
                    &gt;500万
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="minBudget"
                  value={minBudgetValue}
                  onChange={(e) => setMinBudgetValue(e.target.value)}
                  placeholder="最小 (万)"
                  className={`${inputCls} text-xs`}
                />
                <span className="text-slate-400 text-xs">至</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="maxBudget"
                  value={maxBudgetValue}
                  onChange={(e) => setMaxBudgetValue(e.target.value)}
                  placeholder="最大 (万)"
                  className={`${inputCls} text-xs`}
                />
              </div>
            </div>

            {/* 3. 标书附件与高价值商机特权 */}
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-primary">
                <input
                  type="checkbox"
                  name="hasAttachment"
                  value="1"
                  defaultChecked={defaults.hasAttachment === "1"}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-0"
                />
                <span>仅筛选含可下载标书附件的公告</span>
              </label>
              <p className="mt-1 text-[11px] text-slate-400">
                直通招标文件原文、答疑补充文件与采购技术参数表
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-xs transition-colors duration-200 hover:bg-primary-strong"
        >
          开始检索商机
        </button>
        <a
          href={basePath}
          className="cursor-pointer rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
        >
          重置条件
        </a>
      </div>
    </form>
  );
}
