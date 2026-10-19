import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCachedRegionsData } from "@/lib/dict-cache";
import { getAppUrl } from "@/lib/mailer";
import { slugFromType, SEO_TYPE_SLUGS } from "@/lib/seo";
import { tenderTypeLabel, tenderTypeColor, formatDate, yuanToWan } from "@/lib/constants";
import { INDUSTRY_META } from "@/lib/industry";
import {
  CalendarIcon,
  ClockIcon,
  BuildingIcon,
  ClipboardIcon,
  MapPinIcon,
  DatabaseIcon,
  LockClosedIcon,
  SparklesIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  ChartBarIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const TEASER_LENGTH = 150;

function buildTeaser(content: string | null | undefined): string {
  if (!content) return "";
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= TEASER_LENGTH) return flat;
  return `${flat.slice(0, TEASER_LENGTH)}…`;
}

async function loadTender(idParam: string) {
  const id = parseInt(idParam, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return prisma.tender.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      content: true,
      purchaser: true,
      agency: true,
      budgetAmount: true,
      awardAmount: true,
      winningSupplier: true,
      publishDate: true,
      expireDate: true,
      provinceCode: true,
      cityCode: true,
      industryCode: true,
      projectNo: true,
      sourceName: true,
      sourceUrl: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tender = await loadTender(id);
  if (!tender) return { title: "公告未找到 - 标讯通" };

  const typeName = tenderTypeLabel(tender.type) || "招标公告";
  const dateStr = tender.publishDate.toISOString().slice(0, 10);
  const purchaserStr = tender.purchaser ? `采购人：${tender.purchaser}。` : "";
  const budgetStr = tender.budgetAmount
    ? `预算金额：${yuanToWan(tender.budgetAmount)}万元。`
    : "";
  const description = `${tender.title}。${purchaserStr}${budgetStr}发布日期：${dateStr}。标讯通聚合全国招标、中标、变更与询价公告，登录可查看正文全文、联系方式与标书附件。`;

  return {
    title: `${tender.title} - ${typeName}`,
    description,
    alternates: { canonical: `/gonggao/detail/${tender.id}` },
    openGraph: {
      title: tender.title,
      description,
      type: "article",
      publishedTime: tender.publishDate.toISOString(),
    },
  };
}

export default async function PublicTenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tender = await loadTender(id);
  if (!tender) notFound();

  const baseUrl = getAppUrl();
  const regions = await getCachedRegionsData();
  const regionName = (code: string | null) =>
    code ? regions.provinceMap.get(code) || regions.cityMap.get(code) || "" : "";

  const typeName = tenderTypeLabel(tender.type);
  const typeSlug = slugFromType(tender.type);
  const provinceName = regionName(tender.provinceCode);
  const cityName = regionName(tender.cityCode);
  const regionLabel = [provinceName, cityName].filter(Boolean).join(" / ");

  const listHref = tender.provinceCode && typeSlug
    ? `/gonggao/${tender.provinceCode}/${typeSlug}`
    : typeSlug
      ? `/gonggao/${typeSlug}`
      : "/gonggao";

  const teaser = buildTeaser(tender.content);

  const facts = [
    { label: "发布日期", value: formatDate(tender.publishDate) },
    {
      label: "截止时间",
      value: tender.expireDate ? formatDate(tender.expireDate) : null,
    },
    { label: "采购人/招标人", value: tender.purchaser },
    { label: "代理机构", value: tender.agency },
    { label: "项目编号", value: tender.projectNo },
    {
      label: "预算金额",
      value: tender.budgetAmount ? `${yuanToWan(tender.budgetAmount)} 万元` : null,
    },
    {
      label: "中标金额",
      value: tender.awardAmount ? `${yuanToWan(tender.awardAmount)} 万元` : null,
    },
    { label: "中标供应商", value: tender.winningSupplier },
  ].filter((f) => f.value);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "公告大厅", item: `${baseUrl}/gonggao` },
          { "@type": "ListItem", position: 2, name: `${typeName}`, item: `${baseUrl}${listHref}` },
          { "@type": "ListItem", position: 3, name: tender.title, item: `${baseUrl}/gonggao/detail/${tender.id}` },
        ],
      },
      {
        "@type": "Article",
        headline: tender.title,
        datePublished: tender.publishDate.toISOString(),
        dateModified: tender.publishDate.toISOString(),
        description: `${tender.purchaser ? `采购人：${tender.purchaser}。` : ""}发布日期：${tender.publishDate.toISOString().slice(0, 10)}。`,
        author: { "@type": "Organization", name: tender.purchaser || "招标采购人" },
        publisher: { "@type": "Organization", name: "标讯通", url: baseUrl },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${baseUrl}/gonggao/detail/${tender.id}` },
      },
    ],
  };

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
        <span>/</span>
        <Link href={listHref} className="transition-colors hover:text-primary">
          {regionLabel ? `${regionLabel}${typeName}` : `全国${typeName}`}
        </Link>
        <span>/</span>
        <span className="line-clamp-1 max-w-[60ch] font-medium text-slate-700">{tender.title}</span>
      </nav>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs">
        <header className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 to-transparent px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tenderTypeColor(tender.type)}`}
            >
              {typeName}
            </span>
            {regionLabel && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50/80 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <MapPinIcon className="h-3 w-3" />
                {regionLabel}
              </span>
            )}
            {tender.industryCode && INDUSTRY_META[tender.industryCode] && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                <ChartBarIcon className="h-3 w-3" />
                {INDUSTRY_META[tender.industryCode].name}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold leading-relaxed tracking-tight text-slate-900 md:text-2xl">
            {tender.title}
          </h1>
        </header>

        {/* 关键事实带（公开字段） */}
        {facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 md:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="bg-slate-50/70 px-5 py-4">
                <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                  {f.label === "发布日期" && <CalendarIcon className="h-3.5 w-3.5" />}
                  {f.label === "截止时间" && <ClockIcon className="h-3.5 w-3.5" />}
                  {f.label === "采购人/招标人" && <BuildingIcon className="h-3.5 w-3.5" />}
                  {f.label === "代理机构" && <ClipboardIcon className="h-3.5 w-3.5" />}
                  {f.label === "项目编号" && <BriefcaseIcon className="h-3.5 w-3.5" />}
                  {f.label}
                </dt>
                <dd className="mt-1.5 truncate text-sm font-semibold text-slate-800 tnum" title={f.value ?? undefined}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* 正文摘要（脱敏：仅前 150 字） */}
        <section className="px-6 py-6">
          <h2 className="text-sm font-bold text-slate-800">公告摘要</h2>
          {teaser ? (
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {teaser}
              <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 align-middle text-[11px] font-medium text-slate-500">
                <LockClosedIcon className="h-3 w-3" />
                后文需登录
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">该公告暂无可展示的正文摘要。</p>
          )}
        </section>

        {/* 付费墙转化 */}
        <section className="border-t border-blue-100 bg-gradient-to-r from-blue-50 to-white px-6 py-5">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LockClosedIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">查看完整正文 · 联系方式 · 标书附件</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  免费注册即可检索全国标讯并设置关键词订阅；升级套餐可解锁正文全文、采购联系人、附件下载与中标情报。
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
        </section>

        {/* 出处 */}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <DatabaseIcon className="h-3.5 w-3.5" />
            {tender.sourceName || "公开渠道"}
          </span>
          {tender.sourceUrl && (
            <a
              href={tender.sourceUrl}
              target="_blank"
              rel="noreferrer nofollow"
              className="text-accent transition-colors hover:text-primary hover:underline"
            >
              来源页面
            </a>
          )}
        </footer>
      </article>

      {/* 内链：更多同类公告 */}
      <section>
        <h2 className="text-sm font-bold text-slate-800">
          更多{regionLabel ? `${regionLabel}` : "全国"}
          {typeName}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={listHref}
            className="rounded-lg border border-accent/50 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-accent"
          >
            {regionLabel ? `${regionLabel}${typeName}` : `全国${typeName}`} 列表 →
          </Link>
          {SEO_TYPE_SLUGS.filter((s) => s.type !== tender.type).map((s) => (
            <Link
              key={s.slug}
              href={tender.provinceCode ? `/gonggao/${tender.provinceCode}/${s.slug}` : `/gonggao/${s.slug}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-accent/60 hover:text-primary"
            >
              {regionLabel || "全国"}
              {tenderTypeLabel(s.type)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
