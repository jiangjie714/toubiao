import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { consumeSearchQuota, getEntitlement, getExportQuota } from "@/lib/quota";
import { getCachedRegionsData, getCachedIndustriesData } from "@/lib/dict-cache";
import FilterBar from "@/components/filter-bar";
import {
  buildWhere,
  buildQueryString,
  tokenizeHighlight,
  PAGE_SIZE,
  type ListSearchParams,
} from "@/lib/query";
import { tenderTypeLabel, tenderTypeColor, formatDate } from "@/lib/constants";
import TenderCompareTray from "@/components/tender-compare-tray";
import TenderCompareButton from "@/components/tender-compare-button";
import {
  MapPinIcon,
  CalendarIcon,
  BuildingIcon,
  DatabaseIcon,
  SearchIcon,
} from "@/components/icons";

export const metadata = { title: "信息检索" };

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const sp: ListSearchParams = {
    q: typeof raw.q === "string" ? raw.q : "",
    type: typeof raw.type === "string" ? raw.type : "",
    province: typeof raw.province === "string" ? raw.province : "",
    city: typeof raw.city === "string" ? raw.city : "",
    from: typeof raw.from === "string" ? raw.from : "",
    to: typeof raw.to === "string" ? raw.to : "",
    page: typeof raw.page === "string" ? raw.page : "1",
    purchaser: typeof raw.purchaser === "string" ? raw.purchaser : "",
    winningSupplier: typeof raw.winningSupplier === "string" ? raw.winningSupplier : "",
    minBudget: typeof raw.minBudget === "string" ? raw.minBudget : "",
    maxBudget: typeof raw.maxBudget === "string" ? raw.maxBudget : "",
    industryCode: typeof raw.industryCode === "string" ? raw.industryCode : "",
    hasAttachment: typeof raw.hasAttachment === "string" ? raw.hasAttachment : "",
  };

  const user = await getSession();
  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-surface p-10 text-center text-sm text-slate-600">
        请先登录后使用检索。
      </div>
    );
  }

  const [quota, entitlement] = await Promise.all([
    consumeSearchQuota(user.uid, { isAdmin: user.role === "ADMIN" }),
    getEntitlement(user.uid),
  ]);
  const exportEnabled = entitlement.features.exportDaily > 0;
  const exportQuota = exportEnabled ? await getExportQuota(user.uid) : null;
  const where = quota.allowed ? buildWhere(sp) : undefined;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const [dictRegions, dictIndustries] = await Promise.all([
    getCachedRegionsData(),
    getCachedIndustriesData(),
  ]);
  const { provinces, cities, provinceMap, cityMap } = dictRegions;
  const { industries, industryMap } = dictIndustries;

  const [total, items] = quota.allowed
    ? await Promise.all([
        prisma.tender.count({ where }),
        prisma.tender.findMany({
          where,
          select: {
            id: true,
            title: true,
            type: true,
            provinceCode: true,
            cityCode: true,
            purchaser: true,
            winningSupplier: true,
            budgetAmount: true,
            awardAmount: true,
            publishDate: true,
            sourceName: true,
            industryCode: true,
            _count: {
              select: { attachments: true },
            },
          },
          orderBy: { publishDate: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
      ])
    : [0, []];

  const regionName = (code: string | null) => (code ? provinceMap.get(code) || cityMap.get(code) || "" : "");

  const totalPages = quota.allowed ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const qs = (overrides: Record<string, string | undefined>) =>
    buildQueryString(sp, overrides);
  const quotaLabel =
    quota.quota === Infinity ? "搜索不限次" : `今日剩余搜索 ${quota.remaining}/${quota.quota} 次`;
  const exportHref = `/api/export/tenders?${buildQueryString(sp, { page: undefined })}`;
  const pageLink =
    "cursor-pointer rounded-lg border border-slate-200 bg-surface px-4 py-2 text-sm text-slate-700 transition-colors duration-200 hover:border-accent/60 hover:text-primary";

  return (
    <div className="space-y-5">
      <FilterBar
        provinces={provinces.map((p) => ({ code: p.code, name: p.name }))}
        cities={cities.map((c) => ({
          code: c.code,
          name: c.name,
          parentCode: c.parentCode ?? "",
        }))}
        industries={industries.map((i) => ({ code: i.code, name: i.name }))}
        defaults={{
          q: sp.q ?? "",
          type: sp.type ?? "",
          province: sp.province ?? "",
          city: sp.city ?? "",
          from: sp.from ?? "",
          to: sp.to ?? "",
          minBudget: sp.minBudget ?? "",
          maxBudget: sp.maxBudget ?? "",
          industryCode: sp.industryCode ?? "",
          hasAttachment: sp.hasAttachment ?? "",
        }}
      />

      {quota.allowed ? (
        <div className="rounded-2xl border border-slate-200 bg-surface shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs sm:text-sm">
                共找到 <b className="font-bold text-primary tnum">{total}</b> 篇精准标讯
              </span>
              {sp.q && (
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-primary font-mono">
                  “{sp.q}”
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/pricing"
                title="查看与升级搜索配额"
                className="group flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-primary"
              >
                <span className="tnum">{quotaLabel}</span>
                <span className="text-accent underline group-hover:text-primary">升级</span>
              </Link>
              {exportEnabled && exportQuota?.allowed ? (
                <div className="flex items-center gap-1.5">
                  <a
                    href={exportHref}
                    className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors duration-200 hover:bg-blue-100"
                  >
                    ⚡️ 快速导出 Excel
                  </a>
                  <Link
                    href={`/exports?${buildQueryString(sp, { page: undefined })}`}
                    className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-primary hover:bg-slate-50 transition-colors"
                    title="前往导出中心自定义字段与联系人"
                  >
                    自定义字段
                  </Link>
                </div>
              ) : (
                <Link
                  href="/exports"
                  className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <span>📥 批量导出商机 (VIP)</span>
                </Link>
              )}
            </div>
          </div>

          <ul className="divide-y divide-slate-100">
            {items.map((t) => {
              const titleSegments = tokenizeHighlight(t.title, sp.q);
              const indName = t.industryCode ? industryMap.get(t.industryCode) : null;
              const attachmentCount = t._count?.attachments ?? 0;

              return (
                <li
                  key={t.id}
                  className="px-5 py-4 transition-colors duration-150 hover:bg-blue-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tenderTypeColor(
                              t.type
                            )}`}
                          >
                            {tenderTypeLabel(t.type)}
                          </span>

                          {indName && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                              {indName}
                            </span>
                          )}

                          {t.budgetAmount && (
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 tnum">
                              ¥{(Number(t.budgetAmount) / 10000).toFixed(2)}万 预算
                            </span>
                          )}

                          {t.awardAmount && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 tnum">
                              ¥{(Number(t.awardAmount) / 10000).toFixed(2)}万 中标
                            </span>
                          )}

                          {attachmentCount > 0 && (
                            <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
                              📎 含 {attachmentCount} 个附件
                            </span>
                          )}
                        </div>

                        <TenderCompareButton
                          tender={{
                            id: t.id,
                            title: t.title,
                            type: t.type,
                            budgetAmount: t.budgetAmount ? Number(t.budgetAmount) : null,
                          }}
                        />
                      </div>

                      <Link
                        href={`/tender/${t.id}`}
                        className="cursor-pointer text-sm font-semibold text-slate-900 transition-colors duration-150 hover:text-primary leading-snug line-clamp-2"
                      >
                        {titleSegments.map((seg, sIdx) =>
                          seg.highlight ? (
                            <mark
                              key={sIdx}
                              className="rounded bg-amber-100 px-0.5 font-bold text-amber-900"
                            >
                              {seg.text}
                            </mark>
                          ) : (
                            <span key={sIdx}>{seg.text}</span>
                          )
                        )}
                      </Link>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1 tnum">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {formatDate(t.publishDate)}
                    </span>
                    {(t.provinceCode || t.cityCode) && (
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        {[regionName(t.provinceCode), regionName(t.cityCode)]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    )}
                    {t.purchaser && (
                      <span className="flex max-w-[240px] items-center gap-1 truncate" title={t.purchaser}>
                        <BuildingIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>买方: {t.purchaser}</span>
                      </span>
                    )}
                    {t.winningSupplier && (
                      <span className="flex max-w-[240px] items-center gap-1 truncate text-emerald-700" title={t.winningSupplier}>
                        <span>中标: {t.winningSupplier}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <DatabaseIcon className="h-3.5 w-3.5" />
                      {t.sourceName}
                    </span>
                  </div>
                </li>
              );
            })}

            {items.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-5 py-16">
                <SearchIcon className="h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">没有找到符合条件的标讯公告</p>
                <p className="text-xs text-slate-500">
                  试试放宽关键词、清空金额区间或扩大日期范围，也可以
                  <a href="/list" className="mx-1 cursor-pointer text-accent hover:underline">
                    清除全部筛选条件
                  </a>
                  重新检索
                </p>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-6 py-10 text-center">
          <h2 className="text-lg font-bold text-slate-900">今日免费搜索次数已用完</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
            免费版每日可搜索 {quota.quota} 次。升级黄金会员可获得正文全文与每日 20 次搜索；
            铂金会员还可查看联系方式、附件并获得更多导出额度。
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/pricing"
              className="cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
            >
              查看套餐并升级
            </Link>
            <Link
              href="/list"
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-blue-300"
            >
              明日再试
            </Link>
          </div>
        </div>
      )}

      {quota.allowed && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/list?${qs({ page: String(page - 1) })}`} className={pageLink}>
              上一页
            </Link>
          )}
          <span className="px-3 text-sm text-slate-500 tnum">
            第 {page} / {totalPages} 页
          </span>
          {page < totalPages && (
            <Link href={`/list?${qs({ page: String(page + 1) })}`} className={pageLink}>
              下一页
            </Link>
          )}
        </div>
      )}

      <TenderCompareTray />
    </div>
  );
}
