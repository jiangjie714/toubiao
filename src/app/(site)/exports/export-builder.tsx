"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getExportPreviewCountAction,
  type UserExportQuotaInfo,
  type ExportHistoryItem,
} from "@/app/actions/export";
import {
  ArrowDownTrayIcon,
  CheckIcon,
  SearchIcon,
  CalendarIcon,
  MapPinIcon,
  SparklesIcon,
  ArrowPathIcon,
} from "@/components/icons";

interface RegionItem {
  code: string;
  name: string;
}

interface ExportFieldDef {
  key: string;
  label: string;
  defaultChecked: boolean;
  vip?: boolean;
}

interface ExportFieldGroup {
  groupName: string;
  fields: ExportFieldDef[];
}

const FIELD_GROUPS: ExportFieldGroup[] = [
  {
    groupName: "基础信息字段",
    fields: [
      { key: "id", label: "公告ID", defaultChecked: true },
      { key: "title", label: "标讯标题", defaultChecked: true },
      { key: "type", label: "标讯类型", defaultChecked: true },
      { key: "publishDate", label: "发布日期", defaultChecked: true },
      { key: "expireDate", label: "投标截止时间", defaultChecked: true },
      { key: "region", label: "所属区域(省/市)", defaultChecked: true },
      { key: "sourceName", label: "数据源名称", defaultChecked: false },
      { key: "sourceUrl", label: "官方公告链接", defaultChecked: true },
    ],
  },
  {
    groupName: "商业指标与中标穿透",
    fields: [
      { key: "projectNo", label: "项目/采购编号", defaultChecked: true },
      { key: "purchaser", label: "采购人(发包单位)", defaultChecked: true },
      { key: "agency", label: "招标代理机构", defaultChecked: true },
      { key: "budgetAmount", label: "采购预算(万元)", defaultChecked: true },
      { key: "winningSupplier", label: "中标供应商", defaultChecked: true },
      { key: "awardAmount", label: "中标成交额(万元)", defaultChecked: true },
      { key: "savingsRate", label: "节资下浮率(%)", defaultChecked: true },
    ],
  },
  {
    groupName: "行业与全周期商机特征",
    fields: [
      { key: "industry", label: "所属行业门类", defaultChecked: true },
      { key: "projectStage", label: "全生命周期阶段", defaultChecked: true },
      { key: "attachmentCount", label: "官方标书附件数", defaultChecked: true },
      { key: "estimatedProcurement", label: "预计采购月份(意向)", defaultChecked: false },
      { key: "windowPhase", label: "窗口期状态(意向)", defaultChecked: false },
    ],
  },
  {
    groupName: "采购人官方通讯录 (高价值特权)",
    fields: [
      { key: "contactRole", label: "项目经办人职务", defaultChecked: true, vip: true },
      { key: "phone", label: "采购人联系电话", defaultChecked: true, vip: true },
      { key: "email", label: "官方电子邮箱", defaultChecked: true, vip: true },
      { key: "address", label: "办公通讯地址", defaultChecked: false, vip: true },
    ],
  },
];

export default function ExportBuilder({
  quotaInfo,
  provinces,
  industries = [],
  initialHistory = [],
  initialParams = {},
}: {
  quotaInfo: UserExportQuotaInfo;
  provinces: RegionItem[];
  industries?: { code: string; name: string }[];
  initialHistory?: ExportHistoryItem[];
  initialParams?: {
    q?: string;
    type?: string;
    province?: string;
    from?: string;
    to?: string;
    minBudget?: string;
    maxBudget?: string;
    industryCode?: string;
    hasAttachment?: string;
  };
}) {
  // 筛选条件状态
  const [q, setQ] = useState(initialParams.q ?? "");
  const [type, setType] = useState(initialParams.type ?? "");
  const [province, setProvince] = useState(initialParams.province ?? "");
  const [from, setFrom] = useState(initialParams.from ?? "");
  const [to, setTo] = useState(initialParams.to ?? "");
  const [hasBudget, setHasBudget] = useState(false);
  const [hasWinner, setHasWinner] = useState(false);
  const [minBudget, setMinBudget] = useState(initialParams.minBudget ?? "");
  const [maxBudget, setMaxBudget] = useState(initialParams.maxBudget ?? "");
  const [industryCode, setIndustryCode] = useState(initialParams.industryCode ?? "");
  const [hasAttachment, setHasAttachment] = useState(initialParams.hasAttachment === "1");

  // 选中的导出列字段
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => {
    const set = new Set<string>();
    FIELD_GROUPS.forEach((g) => {
      g.fields.forEach((f) => {
        if (f.defaultChecked) set.add(f.key);
      });
    });
    return set;
  });

  // 预估匹配数量
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<ExportHistoryItem[]>(initialHistory);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 防抖计算预估数量
  const fetchCount = useCallback(async () => {
    setCalculating(true);
    setErrorMsg(null);
    try {
      const res = await getExportPreviewCountAction({
        q: q || undefined,
        type: type || undefined,
        province: province || undefined,
        from: from || undefined,
        to: to || undefined,
        hasBudget: hasBudget || undefined,
        hasWinner: hasWinner || undefined,
        minBudget: minBudget ? parseFloat(minBudget) : undefined,
        maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
        industryCode: industryCode || undefined,
        hasAttachment: hasAttachment || undefined,
      });
      if (res.success) {
        setPreviewCount(res.count);
      }
    } catch {
      // 忽略计算错误
    } finally {
      setCalculating(false);
    }
  }, [q, type, province, from, to, hasBudget, hasWinner, minBudget, maxBudget, industryCode, hasAttachment]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCount();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCount]);

  // 字段勾选切换
  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllFields = () => {
    const all = new Set<string>();
    FIELD_GROUPS.forEach((g) => g.fields.forEach((f) => all.add(f.key)));
    setSelectedFields(all);
  };

  const selectBasicFields = () => {
    const basic = new Set<string>();
    FIELD_GROUPS[0].fields.forEach((f) => basic.add(f.key));
    FIELD_GROUPS[1].fields.forEach((f) => basic.add(f.key));
    setSelectedFields(basic);
  };

  // 快捷时间设置
  const setQuickDateRange = (days: number) => {
    if (days === 0) {
      setFrom("");
      setTo("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  // 触发导出下载
  const handleExport = async () => {
    if (!quotaInfo.canExport) {
      setErrorMsg("当前套餐无批量导出配额，请升级会员");
      return;
    }

    if (selectedFields.size === 0) {
      setErrorMsg("请至少勾选一个导出字段列");
      return;
    }

    setExporting(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      if (province) params.set("province", province);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (hasBudget) params.set("hasBudget", "true");
      if (hasWinner) params.set("hasWinner", "true");
      if (minBudget) params.set("minBudget", minBudget);
      if (maxBudget) params.set("maxBudget", maxBudget);
      if (industryCode) params.set("industryCode", industryCode);
      if (hasAttachment) params.set("hasAttachment", "1");

      params.set("fields", Array.from(selectedFields).join(","));

      const exportUrl = `/api/export/tenders?${params.toString()}`;

      // 使用原生触发文件下载流
      const response = await fetch(exportUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `导出请求失败 (${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `biaoxuntong-export-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      // 更新历史记录
      setHistory((prev) => [
        {
          id: Date.now(),
          createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
          matchedCount: previewCount ?? 0,
          exportedCount: Math.min(previewCount ?? 0, quotaInfo.dailyQuota),
          filters: {
            keyword: q || "全部",
            province: province || "全国",
            type: type || "全类型",
          },
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部配额与权益看板 */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                当前账户权益
              </span>
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-primary ring-1 ring-blue-600/20">
                {quotaInfo.planName}
              </span>
              {quotaInfo.canExportContacts && (
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-purple-600/20">
                  采购人电话明文解锁
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              {quotaInfo.canExport
                ? `今日可用导出上限 ${quotaInfo.dailyQuota.toLocaleString()} 条，剩余可用 ${quotaInfo.remainingToday.toLocaleString()} 条。`
                : "免费体验版未包含批量导出权限，升级白金版即可每日导出 20 条高价值招投标清单并附带采购人联系方式。"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!quotaInfo.canExport ? (
              <Link
                href="/pricing"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                <span>升级白金会员解锁导出</span>
              </Link>
            ) : (
              <div className="text-right">
                <div className="text-xs text-slate-400">今日剩余配额</div>
                <div className="text-lg font-bold text-slate-900 font-mono tnum">
                  {quotaInfo.remainingToday}
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    / {quotaInfo.dailyQuota} 条
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 核心两栏配置工作台 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：多维高级筛选控制台（占据 7 列） */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SearchIcon className="h-4.5 w-4.5 text-primary" />
                <span>多维复合条件筛选</span>
              </h2>
              <span className="text-xs text-slate-400">精确命中目标商机</span>
            </div>

            {/* 关键字搜索 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                搜索关键字
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="项目名称、项目编号、采购人或中标供应商..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-primary focus:bg-surface focus:outline-none"
                />
              </div>
            </div>

            {/* 标讯类型、行业分类与区域 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  标讯类型
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-700 focus:border-primary focus:bg-surface focus:outline-none"
                >
                  <option value="">全部类型 (招标/意向/中标/询价)</option>
                  <option value="NOTICE">招标公告 (NOTICE)</option>
                  <option value="INTENTION">采购意向 (INTENTION)</option>
                  <option value="RESULT">中标公告 (RESULT)</option>
                  <option value="CHANGE">变更更正 (CHANGE)</option>
                  <option value="INQUIRY">询价竞谈 (INQUIRY)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  行业门类分类
                </label>
                <select
                  value={industryCode}
                  onChange={(e) => setIndustryCode(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-700 focus:border-primary focus:bg-surface focus:outline-none"
                >
                  <option value="">全部行业门类</option>
                  {industries.map((ind) => (
                    <option key={ind.code} value={ind.code}>
                      {ind.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>省份区域</span>
                </label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-700 focus:border-primary focus:bg-surface focus:outline-none"
                >
                  <option value="">全国全境</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 发布时间范围 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>发布起止时间</span>
                </label>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setQuickDateRange(3)}
                    className="cursor-pointer text-slate-500 hover:text-primary px-1"
                  >
                    近3天
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setQuickDateRange(7)}
                    className="cursor-pointer text-slate-500 hover:text-primary px-1"
                  >
                    近7天
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setQuickDateRange(30)}
                    className="cursor-pointer text-slate-500 hover:text-primary px-1"
                  >
                    近30天
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setQuickDateRange(0)}
                    className="cursor-pointer text-slate-500 hover:text-primary px-1"
                  >
                    不限
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-700 focus:border-primary focus:bg-surface focus:outline-none"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-700 focus:border-primary focus:bg-surface focus:outline-none"
                />
              </div>
            </div>

            {/* 高级商业特征筛选开关 */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-3">
              <div className="text-xs font-semibold text-slate-700">
                精准商机限定
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBudget}
                    onChange={(e) => setHasBudget(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>仅看公布预算标讯</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasWinner}
                    onChange={(e) => setHasWinner(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>仅看已中标标讯</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAttachment}
                    onChange={(e) => setHasAttachment(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>仅看含标书附件</span>
                </label>
              </div>

              {/* 预算区间输入与预设 */}
              <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">预算金额区间 (万元)</span>
                  <div className="flex items-center gap-1 text-slate-500">
                    <button
                      type="button"
                      onClick={() => { setMinBudget(""); setMaxBudget("100"); }}
                      className="cursor-pointer hover:text-primary px-1"
                    >
                      &lt;100万
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => { setMinBudget("100"); setMaxBudget("500"); }}
                      className="cursor-pointer hover:text-primary px-1"
                    >
                      100-500万
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => { setMinBudget("500"); setMaxBudget(""); }}
                      className="cursor-pointer hover:text-primary px-1"
                    >
                      &gt;500万
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => { setMinBudget(""); setMaxBudget(""); }}
                      className="cursor-pointer hover:text-primary px-1"
                    >
                      不限
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value)}
                    placeholder="最低(万元)"
                    className="h-8 w-full rounded-lg border border-slate-200 bg-surface px-2.5 text-xs text-slate-800 focus:border-primary focus:outline-none"
                  />
                  <span className="text-slate-400 text-xs">至</span>
                  <input
                    type="number"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    placeholder="最高(万元)"
                    className="h-8 w-full rounded-lg border border-slate-200 bg-surface px-2.5 text-xs text-slate-800 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 匹配条数即时预估 */}
            <div className="flex items-center justify-between rounded-xl bg-blue-50/70 px-4 py-3 border border-blue-100">
              <div className="text-xs text-blue-900 flex items-center gap-1.5">
                {calculating ? (
                  <>
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-blue-600" />
                    <span>正在动态计算匹配商机条数...</span>
                  </>
                ) : (
                  <>
                    <span>当前筛选条件共匹配到</span>
                    <span className="font-bold text-sm text-blue-700 font-mono tnum">
                      {previewCount !== null ? previewCount.toLocaleString() : "-"}
                    </span>
                    <span>条标讯</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={fetchCount}
                className="cursor-pointer text-xs font-semibold text-primary hover:underline"
              >
                刷新预估
              </button>
            </div>
          </div>
        </div>

        {/* 右侧：自定义导出字段勾选器（占据 5 列） */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                自定义导出列 (字段配置)
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllFields}
                  className="cursor-pointer text-primary hover:underline font-medium"
                >
                  全选
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={selectBasicFields}
                  className="cursor-pointer text-slate-500 hover:text-slate-800"
                >
                  仅商业字段
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {FIELD_GROUPS.map((group) => (
                <div key={group.groupName} className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">
                    {group.groupName}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {group.fields.map((f) => {
                      const checked = selectedFields.has(f.key);
                      return (
                        <label
                          key={f.key}
                          className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${
                            checked
                              ? "border-blue-200 bg-blue-50/40 text-slate-900 font-medium"
                              : "border-slate-200 bg-surface text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleField(f.key)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <span className="truncate">{f.label}</span>
                          {f.vip && (
                            <span className="ml-auto text-[10px] text-purple-600 font-semibold">
                              VIP
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 错误提示 */}
            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            {/* 导出大按钮 */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || !quotaInfo.canExport}
                className={`cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-xs transition-all ${
                  exporting
                    ? "bg-slate-400 cursor-not-allowed"
                    : !quotaInfo.canExport
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-primary hover:bg-primary-strong"
                }`}
              >
                {exporting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-white" />
                    <span>正在流式生成 Excel 文件...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-4 w-4 text-white" />
                    <span>
                      立即生成并下载 Excel (.xlsx) 表格
                    </span>
                  </>
                )}
              </button>

              <div className="mt-2 text-[11px] text-slate-400 text-center leading-relaxed">
                单次最多支持导出 {quotaInfo.dailyQuota} 条，自动包含带超链的官方源文，首行已开启筛选过滤与千分位金额格式。
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 历史导出审计记录 */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              我的近期导出审计记录 (Export Audit)
            </h3>
            <span className="text-xs text-slate-400">保留最近 10 次导出任务</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="py-2.5 font-medium">导出时间</th>
                  <th className="py-2.5 font-medium">命中商机</th>
                  <th className="py-2.5 font-medium">实际导出</th>
                  <th className="py-2.5 font-medium">筛选关键词/区域</th>
                  <th className="py-2.5 font-medium text-right">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-mono text-slate-500">
                      {item.createdAt}
                    </td>
                    <td className="py-2.5 font-mono font-semibold text-slate-800">
                      {item.matchedCount.toLocaleString()} 条
                    </td>
                    <td className="py-2.5 font-mono font-semibold text-emerald-700">
                      {item.exportedCount.toLocaleString()} 条
                    </td>
                    <td className="py-2.5 text-slate-600">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                        {item.filters.keyword || item.filters.q || "全部"} /{" "}
                        {item.filters.province || "全国"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <CheckIcon className="h-3 w-3 text-emerald-600" />
                        已完成
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
