import Link from "next/link";
import type { Metadata } from "next";
import { getCachedProvinces } from "@/lib/dict-cache";
import { getAppUrl } from "@/lib/mailer";
import { SEO_TYPE_SLUGS } from "@/lib/seo";
import { tenderTypeLabel } from "@/lib/constants";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "全国招投标公告大厅 - 招标/中标/变更/询价信息聚合",
  description:
    "标讯通公告大厅：按省份与公告类型检索全国招标公告、中标公告、变更更正、询价竞谈信息，数据来源于各级公共资源交易平台公开渠道。",
  alternates: { canonical: "/gonggao" },
};

export default async function GonggaoHubPage() {
  const baseUrl = getAppUrl();
  const provinces = await getCachedProvinces();

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "标讯通", item: `${baseUrl}/gonggao` },
      { "@type": "ListItem", position: 2, name: "公告大厅", item: `${baseUrl}/gonggao` },
    ],
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [breadcrumb] }) }}
      />

      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
          全国招投标公告大厅
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          按公告类型或省份进入对应的标讯落地页，实时查看全国各级公共资源交易平台发布的
          招标公告、中标公告、变更更正与询价竞谈信息。
        </p>
      </header>

      <section>
        <h2 className="text-sm font-bold text-slate-800">按公告类型浏览</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEO_TYPE_SLUGS.map((s) => (
            <Link
              key={s.slug}
              href={`/gonggao/${s.slug}`}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-surface px-5 py-4 shadow-xs transition-colors hover:border-accent/60 hover:bg-blue-50/40"
            >
              <span className="text-sm font-semibold text-slate-800 group-hover:text-primary">
                全国{tenderTypeLabel(s.type)}
              </span>
              <ArrowRightIcon className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-800">按省份浏览</h2>
        <p className="mt-1 text-xs text-slate-500">选择省份进入该地区招标公告落地页，页面顶部可切换其他公告类型。</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {provinces.map((p) => (
            <Link
              key={p.code}
              href={`/gonggao/${p.code}/zhaobiao`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-medium text-slate-700 transition-colors hover:border-accent/60 hover:text-primary"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
