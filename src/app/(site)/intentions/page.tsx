import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  getIntentionStats,
  queryIntentions,
} from "@/lib/intention";
import {
  SparklesIcon,
  ClockIcon,
  BuildingIcon,
  MapPinIcon,
  SearchIcon,
  FolderIcon,
  ExternalLinkIcon,
  BoltIcon,
} from "@/components/icons";

export const metadata = {
  title: "采购意向商机雷达 - 提前 30~90 天抢跑招投标 - 标讯通",
  description: "汇聚中央与全国各省政府采购意向公告，智能推导预计采购月份与黄金介入窗口期，抢占前期技术参数与商务对接先机。",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    province?: string;
    windowPhase?: string;
    minBudget?: string;
    maxBudget?: string;
    page?: string;
  }>;
}

export default async function IntentionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const province = sp.province?.trim() || "";
  const windowPhase = sp.windowPhase?.trim() || "all";
  const minBudget = sp.minBudget ? parseFloat(sp.minBudget) : undefined;
  const maxBudget = sp.maxBudget ? parseFloat(sp.maxBudget) : undefined;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const pageSize = 15;

  const [user, stats, provinces, intentionData] = await Promise.all([
    getSession(),
    getIntentionStats(),
    prisma.region.findMany({
      where: { level: 1 },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    }),
    queryIntentions({
      q,
      provinceCode: province,
      windowPhase,
      minBudget,
      maxBudget,
      page,
      pageSize,
    }),
  ]);

  const hasAdvancedFilters = Boolean(province || minBudget || maxBudget || (windowPhase && windowPhase !== "all"));

  const buildUrl = (override: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      q: q || undefined,
      province: province || undefined,
      windowPhase: windowPhase !== "all" ? windowPhase : undefined,
      minBudget: sp.minBudget || undefined,
      maxBudget: sp.maxBudget || undefined,
      page: page > 1 ? String(page) : undefined,
    };
    const merged = { ...current, ...override };
    for (const [key, val] of Object.entries(merged)) {
      if (val !== undefined && val !== "") {
        params.set(key, String(val));
      }
    }
    const query = params.toString();
    return `/intentions${query ? `?${query}` : ""}`;
  };
  let isVip = false;
  if (user) {
    if (user.role === "ADMIN") {
      isVip = true;
    } else {
      const sub = await prisma.subscription.findFirst({
        where: { userId: user.uid, status: "ACTIVE" },
        include: { plan: true },
      });
      isVip = Boolean(sub && ["PLATINUM", "ENTERPRISE", "ENTERPRISE_PRO"].includes(sub.plan.code));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* 顶部 Hero & 标语 */}
      <section className="border-b border-slate-200/80 bg-white pt-8 pb-10 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-semibold text-amber-800">
                <SparklesIcon className="h-3.5 w-3.5 text-amber-600" />
                <span>提前商机雷达 · 抢跑招投标第一棒</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                政府采购意向库
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                法定采购意向通常在招标公告发布前 <strong className="font-semibold text-slate-800">30 ~ 90 天</strong> 公开。
                精准锁定买方正在制定的采购预算与技术指标，提前介入客户拜访与方案论证，避免看到招标公告时为时已晚。
              </p>
            </div>

            {/* 商业化引导 */}
            {!isVip && (
              <div className="shrink-0 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 p-4 text-xs text-blue-900 shadow-xs max-w-sm">
                <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                  <BoltIcon className="h-4 w-4 text-blue-600" />
                  <span>白金 / 企业版独享权益</span>
                </div>
                <p className="mt-1 text-slate-600 leading-normal">
                  解锁采购人经办部门联系电话、需求规格原文拆解与意向转招标实时钉钉/企微提醒。
                </p>
                <Link
                  href="/pricing"
                  className="mt-2.5 inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                >
                  查看套餐权限与开通 &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* 4 大核心资产大盘指标卡片 */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs transition hover:border-slate-300">
              <span className="text-xs font-medium text-slate-500">在库采购意向</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
                  {stats.totalCount.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">条</span>
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">中央与全国各省政采源</span>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4.5 shadow-xs transition hover:border-amber-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-800">⚡ 黄金介入期商机</span>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-amber-700 tnum">
                  {stats.goldenCount.toLocaleString()}
                </span>
                <span className="text-xs text-amber-600">条</span>
              </div>
              <span className="mt-1 block text-[11px] text-amber-700/80">距招标 16~60 天 · 方案论证期</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs transition hover:border-slate-300">
              <span className="text-xs font-medium text-slate-500">预估采购总预算池</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
                  {stats.totalBudgetWan > 10000
                    ? (stats.totalBudgetWan / 10000).toFixed(2)
                    : stats.totalBudgetWan.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">
                  {stats.totalBudgetWan > 10000 ? "亿元" : "万元"}
                </span>
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">公开发布的最高预算累计</span>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4.5 shadow-xs transition hover:border-emerald-200">
              <span className="text-xs font-medium text-emerald-800">已转正启动招标</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-emerald-700 tnum">
                  {stats.convertedCount.toLocaleString()}
                </span>
                <span className="text-xs text-emerald-600">个项目</span>
              </div>
              <span className="mt-1 block text-[11px] text-emerald-700/80">全生命周期已联动招标/结果</span>
            </div>
          </div>
        </div>
      </section>

      {/* 筛选与检索控制台 */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <form method="GET" action="/intentions" className="space-y-4">
            {/* 搜索框与窗口期 Tab */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="搜索意向标的、采购单位、技术参数关键字..."
                  className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  <SearchIcon className="h-4 w-4" />
                  <span>雷达检索</span>
                </button>

                {hasAdvancedFilters && (
                  <Link
                    href="/intentions"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition"
                  >
                    重置筛选
                  </Link>
                )}
              </div>
            </div>

            {/* 窗口期阶段快捷 Tab 切换 */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500 mr-2 flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                窗口期：
              </span>
              {[
                { key: "all", label: "全部意向" },
                { key: "GOLDEN", label: "⚡ 黄金介入期 (16~60天)", activeCls: "bg-amber-100 text-amber-800 border-amber-300 font-semibold" },
                { key: "URGENT", label: "🔴 即将启动 (≤15天)", activeCls: "bg-rose-100 text-rose-800 border-rose-300 font-semibold" },
                { key: "EARLY", label: "🔵 远期规划 (>60天)", activeCls: "bg-blue-100 text-blue-800 border-blue-300 font-semibold" },
                { key: "CONVERTED", label: "🟢 已转正式招标", activeCls: "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold" },
              ].map((tab) => {
                const isActive = (windowPhase || "all") === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={buildUrl({ windowPhase: tab.key, page: 1 })}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      isActive
                        ? tab.activeCls || "bg-blue-600 text-white border-blue-600 font-semibold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            {/* 次级筛选栏：省份与预算 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">行政区划</label>
                <select
                  name="province"
                  defaultValue={province}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                >
                  <option value="">全国范围 (全部省份)</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">预估预算规模</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    name="minBudget"
                    defaultValue={sp.minBudget || ""}
                    placeholder="最低(万)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-600"
                  />
                  <span className="text-slate-400 text-xs">-</span>
                  <input
                    type="number"
                    name="maxBudget"
                    defaultValue={sp.maxBudget || ""}
                    placeholder="最高(万)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <input type="hidden" name="windowPhase" value={windowPhase} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                >
                  应用筛选条件
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* 结果列表区 */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-slate-500">
            共匹配到 <strong className="font-semibold text-slate-800 tnum">{intentionData.total}</strong> 条采购意向商机
            {q && ` · 包含「${q}」`}
          </div>
          <div className="text-xs text-slate-500">
            第 {page} / {intentionData.totalPages} 页
          </div>
        </div>

        {intentionData.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <SearchIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">未找到匹配的采购意向</h3>
            <p className="mt-1.5 text-xs text-slate-500">
              请尝试放宽筛选条件，或清空关键词后重新检索
            </p>
            <div className="mt-4">
              <Link
                href="/intentions"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
              >
                清空全部条件
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {intentionData.items.map((item) => {
              const provinceName = provinces.find((p) => p.code === item.provinceCode)?.name || "全国";
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition duration-200 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 顶栏标签与单位 */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {/* 窗口期状态徽章 */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${item.window.badgeClass}`}
                        >
                          <ClockIcon className="h-3 w-3" />
                          <span>{item.window.phaseLabel}</span>
                        </span>

                        {/* 预计采购时间标签 */}
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium tnum">
                          预计采购：{item.window.estimatedText}
                        </span>

                        {/* 行政区划 */}
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">
                          <MapPinIcon className="h-3 w-3 text-slate-400" />
                          {provinceName}
                        </span>

                        {/* 采购人单位 */}
                        {item.purchaser && (
                          <Link
                            href={`/purchasers/${encodeURIComponent(item.purchaser)}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-600 hover:underline"
                          >
                            <BuildingIcon className="h-3 w-3 text-slate-400" />
                            <span>{item.purchaser}</span>
                          </Link>
                        )}
                      </div>

                      {/* 标题 */}
                      <h2 className="text-base font-semibold leading-snug text-slate-900 hover:text-blue-600 transition">
                        <Link href={`/tender/${item.id}`}>{item.title}</Link>
                      </h2>

                      {/* 关键信息栏 */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                        {item.budgetAmountWan ? (
                          <div>
                            预估预算：
                            <span className="font-bold text-slate-900 tnum text-sm">
                              ¥{item.budgetAmountWan.toLocaleString()}
                            </span>
                            <span className="text-slate-500 ml-0.5">万元</span>
                          </div>
                        ) : (
                          <div>预估预算：<span className="text-slate-400">详见意向需求明细</span></div>
                        )}

                        <div>
                          发布时间：
                          <span className="tnum text-slate-600">
                            {item.publishDate.slice(0, 10)}
                          </span>
                        </div>

                        {/* 已转正快捷入口 */}
                        {item.window.isConverted && item.window.convertedNoticeId && (
                          <div className="flex items-center gap-1 text-emerald-700 font-medium">
                            <span>该意向已启动正式招标：</span>
                            <Link
                              href={`/tender/${item.window.convertedNoticeId}`}
                              className="underline hover:text-emerald-800"
                            >
                              查看最新公告 &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右侧动作区 */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <Link
                        href={`/tender/${item.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition shadow-2xs"
                      >
                        <span>查看意向详情</span>
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                      </Link>

                      {item.projectId && (
                        <Link
                          href={`/projects/${item.projectId}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 hover:underline"
                        >
                          <FolderIcon className="h-3 w-3" />
                          <span>全生命周期</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 分页组件 */}
        {intentionData.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ page: page - 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>&larr; 上一页</span>
              </Link>
            )}

            <span className="text-xs text-slate-500 px-3">
              第 <strong className="font-semibold text-slate-800 tnum">{page}</strong> /{" "}
              {intentionData.totalPages} 页
            </span>

            {page < intentionData.totalPages && (
              <Link
                href={buildUrl({ page: page + 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>下一页 &rarr;</span>
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
