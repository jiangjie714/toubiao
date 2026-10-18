import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/mailer";
import { getCachedProvinces } from "@/lib/dict-cache";
import { SEO_TYPE_SLUGS } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 每小时重建站点地图缓存

/**
 * 仅收录「无需登录即可访问」的公开页面。
 * 说明：站内业务页面（/list、/tender/[id]、/regions/[code] 等）目前均要求登录，
 * 收录它们会让爬虫持续撞击登录跳转、浪费抓取预算，故不在此列出。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/gonggao`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // 全国 × 公告类型（4）
  const nationalTypeRoutes: MetadataRoute.Sitemap = SEO_TYPE_SLUGS.map((s) => ({
    url: `${baseUrl}/gonggao/${s.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  // 省份 × 公告类型（31 × 4）
  let provinceTypeRoutes: MetadataRoute.Sitemap = [];
  try {
    const provinces = await getCachedProvinces();
    provinceTypeRoutes = provinces.flatMap((p) =>
      SEO_TYPE_SLUGS.map((s) => ({
        url: `${baseUrl}/gonggao/${p.code}/${s.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    );
  } catch (err) {
    console.error("Failed to load provinces for sitemap:", err);
  }

  return [...staticRoutes, ...nationalTypeRoutes, ...provinceTypeRoutes];
}
