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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type: slug } = await params;
  const type = typeFromSlug(slug);
  if (!type) return { title: "页面未找到 - 标讯通" };

  const label = tenderTypeLabel(type);
  return {
    title: `全国${label} - 最新${label}信息聚合_标讯通`,
    description: `标讯通实时聚合全国各级公共资源交易平台发布的${label}，按发布时间倒序更新，支持登录后查看正文、联系方式与附件并设置关键词订阅推送。`,
    alternates: { canonical: `/gonggao/${slug}` },
    openGraph: {
      title: `全国${label} - 标讯通`,
      description: `全国最新${label}聚合，公开渠道实时更新。`,
      type: "website",
    },
  };
}

export default async function NationalTypeLandingPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: slug } = await params;
  const type = typeFromSlug(slug);
  if (!type) notFound();

  const baseUrl = getAppUrl();
  const where = buildWhere({ type });

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
      type={type}
      items={items as SeoLandingItem[]}
      total={total}
      provinces={provinces.map((p) => ({ code: p.code, name: p.name }))}
      regionName={regionName}
      baseUrl={baseUrl}
    />
  );
}
