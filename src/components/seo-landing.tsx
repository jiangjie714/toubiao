import Link from "next/link";
import {
  CalendarIcon,
  MapPinIcon,
  BuildingIcon,
  LockClosedIcon,
  SparklesIcon,
  ArrowRightIcon,
  SearchIcon,
} from "@/components/icons";
import { tenderTypeColor, tenderTypeLabel, formatDate } from "@/lib/constants";
import { SEO_TYPE_SLUGS, seoDetailPath, type SeoLandingItem } from "@/lib/seo";

type Props = {
  type: string;
  provinceCode?: string | null;
  provinceName?: string | null;
  items: SeoLandingItem[];
  total: number;
  provinces: { code: string; name: string }[];
  regionName: (code: string | null) => string;
  baseUrl: string;
};

export default function SeoLanding({
  type,
  provinceCode,
  provinceName,
  items,
  total,
  provinces,
  regionName,
  baseUrl,
}: Props) {
  const typeLabel = tenderTypeLabel(type);
  const scopeName = provinceName ?? "全国";
  const h1 = provinceName ? `${provinceName}${typeLabel}` : `全国${typeLabel}`;
  const prefix = provinceCode ? `/gonggao/${provinceCode}` : "/gonggao";
  const currentPath = `${prefix}/${SEO_TYPE_SLUGS.find((s) => s.type === type)?.slug ?? ""}`;

  const toAbsolute = (path: string) => `${baseUrl}${path}`;

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "公告大厅", item: toAbsolute("/gonggao") },
      { "@type": "ListItem", position: 2, name: h1, item: toAbsolute(currentPath) },
    ],
  };

  const itemList = {
    "@type": "ItemList",
    name: h1,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.title,
      url: toAbsolute(seoDetailPath(it.id)),
    })),
  };

  const jsonLd = { "@context": "https://schema.org", "@graph": [breadcrumb, itemList] };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 面包屑 */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/gonggao" className="transition-colors hover:text-primary">
          公告大厅
        </Link>
        {provinceCode && (
          <>
            <span>/</span>
            <span className="font-medium text-slate-700">{provinceName}</span>
          </>
        )}
        <span>/</span>
        <span className="font-medium text-slate-700">{typeLabel}</span>
      </nav>

      {/* 标题与 SEO 导语 */}
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{h1}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          实时聚合{scopeName}公开渠道的{typeLabel}信息，按发布时间倒序排列，持续去重并抽取采购单位、预算金额等关键字段。
          登录后可查看完整正文、联系方式与标书附件，并可设置关键词订阅，新公告自动推送。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-primary tnum">
            共 {total.toLocaleString("zh-CN")} 条
          </span>
          <span className="flex items-center gap-1">
            <SearchIcon className="h-3.5 w-3.5" />
            数据来源于各级公共资源交易平台公开信息
          </span>
        </div>
      </header>

      {/* 列表 */}
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-surface shadow-xs">
        {items.map((it) => (
          <li key={it.id} className="px-5 py-4 transition-colors duration-150 hover:bg-blue-50/30">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tenderTypeColor(it.type)}`}
              >
                {tenderTypeLabel(it.type)}
              </span>
              {it.budgetAmount ? (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 tnum">
                  ¥{(Number(it.budgetAmount) / 10000).toFixed(2)}万 预算
                </span>
              ) : null}
              {it.awardAmount ? (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 tnum">
                  ¥{(Number(it.awardAmount) / 10000).toFixed(2)}万 中标
                </span>
              ) : null}
            </div>
            <Link
              href={seoDetailPath(it.id)}
              className="mt-1.5 block text-sm font-semibold leading-snug text-slate-900 transition-colors hover:text-primary line-clamp-2"
            >
              {it.title}
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 tnum">
                <CalendarIcon className="h-3.5 w-3.5" />
                {formatDate(it.publishDate)}
              </span>
              {(it.provinceCode || it.cityCode) && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {[regionName(it.provinceCode), regionName(it.cityCode)].filter(Boolean).join(" / ")}
                </span>
              )}
              {it.purchaser && (
                <span className="flex max-w-[260px] items-center gap-1 truncate" title={it.purchaser}>
                  <BuildingIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>采购方：{it.purchaser}</span>
                </span>
              )}
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <SearchIcon className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">暂无相关标讯，数据持续采集中</p>
          </li>
        )}
      </ul>

      {/* 转化 CTA */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LockClosedIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">查看完整正文 · 联系方式 · 标书附件</p>
            <p className="mt-0.5 text-xs text-slate-600">
              注册后可免费检索，并设置关键词订阅，新公告邮件 / 微信实时推送。
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-strong"
          >
            <SparklesIcon className="h-4 w-4" />
            免费注册
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-accent/60 hover:text-primary"
          >
            登录
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 内链：同区域切换类型 */}
      <section>
        <h2 className="text-sm font-bold text-slate-800">{scopeName}其他公告类型</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {SEO_TYPE_SLUGS.map((s) => (
            <Link
              key={s.slug}
              href={`${prefix}/${s.slug}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                s.type === type
                  ? "border-accent/50 bg-blue-50 text-primary"
                  : "border-slate-200 bg-white text-slate-700 hover:border-accent/60 hover:text-primary"
              }`}
            >
              {tenderTypeLabel(s.type)}
            </Link>
          ))}
        </div>
      </section>

      {/* 内链：全省切换 */}
      {provinceCode && (
        <section>
          <h2 className="text-sm font-bold text-slate-800">各省{typeLabel}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {provinces.map((p) => (
              <Link
                key={p.code}
                href={`/gonggao/${p.code}/${SEO_TYPE_SLUGS.find((s) => s.type === type)?.slug}`}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  p.code === provinceCode
                    ? "border-accent/50 bg-blue-50 font-semibold text-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:border-accent/60 hover:text-primary"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
