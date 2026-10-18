import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { buildWhere } from "@/lib/query";
import { getCachedProvinces, getCachedRegionsData } from "@/lib/dict-cache";
import { getAppUrl } from "@/lib/mailer";
import { typeFromSlug, type SeoLandingItem } from "@/lib/seo";
import SeoLanding from "@/components/seo-landing";
import { tenderTypeLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

const LANDING_PAGE_SIZE = 50;

async function resolve(params: Promise<{ province: string; type: string }>) {
  const { province, type: slug } = await params;
  const type = typeFromSlug(slug);
  if (!type) return null;
  const provinces = await getCachedProvinces();
  const matched = provinces.find((p) => p.code === province);
  if (!matched) return null;
  return { type, slug, provinceCode: matched.code, provinceName: matched.name };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ province: string; type: string }>;
}): Promise<Metadata> {
  const ctx = await resolve(params);
  if (!ctx) return { title: "页面未找到 - 标讯通" };

  const label = tenderTypeLabel(ctx.type);
  return {
    title: `${ctx.provinceName}${label} - 最新${ctx.provinceName}${label}信息_标讯通`,
    description: `${ctx.provinceName}最新${label}聚合，来源于当地公共资源交易平台公开渠道，按发布时间倒序更新。登录标讯通可查看正文、联系方式与附件并订阅推送。`,
    alternates: { canonical: `/gonggao/${ctx.provinceCode}/${ctx.slug}` },
    openGraph: {
      title: `${ctx.provinceName}${label} - 标讯通`,
      description: `${ctx.provinceName}最新${label}聚合，公开渠道实时更新。`,
      type: "website",
    },
  };
}

export default async function ProvinceTypeLandingPage({
  params,
}: {
  params: Promise<{ province: string; type: string }>;
}) {
  const ctx = await resolve(params);
  if (!ctx) notFound();

  const baseUrl = getAppUrl();
  const where = buildWhere({ type: ctx.type, province: ctx.provinceCode });

  const [total, items, provinces, regions] = await Promise.all([
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
        budgetAmount: true,
        awardAmount: true,
        publishDate: true,
        sourceName: true,
      },
      orderBy: { publishDate: "desc" },
      take: LANDING_PAGE_SIZE,
    }),
    getCachedProvinces(),
    getCachedRegionsData(),
  ]);

  const regionName = (code: string | null) =>
    code ? regions.provinceMap.get(code) || regions.cityMap.get(code) || "" : "";

  return (
    <SeoLanding
      type={ctx.type}
      provinceCode={ctx.provinceCode}
      provinceName={ctx.provinceName}
      items={items as SeoLandingItem[]}
      total={total}
      provinces={provinces.map((p) => ({ code: p.code, name: p.name }))}
      regionName={regionName}
      baseUrl={baseUrl}
    />
  );
}
