import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { getCachedProvinces, getCachedIndustriesData } from "@/lib/dict-cache";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 每小时动态重新构建站点地图缓存

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppUrl();
  const now = new Date();

  // 1. 核心固定功能页面与大盘枢纽
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/list`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/history`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/regions`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/industries`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compliance`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // 2. 全国 31 省市落地页矩阵
  let regionRoutes: MetadataRoute.Sitemap = [];
  try {
    const provinces = await getCachedProvinces();
    regionRoutes = provinces.map((p) => ({
      url: `${baseUrl}/regions/${p.code}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    }));
  } catch (err) {
    console.error("Failed to load provinces for sitemap:", err);
  }

  // 3. 重点行业赛道落地页矩阵
  let industryRoutes: MetadataRoute.Sitemap = [];
  try {
    const { industries } = await getCachedIndustriesData();
    industryRoutes = industries.map((ind) => ({
      url: `${baseUrl}/industries/${ind.code}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    }));
  } catch (err) {
    console.error("Failed to load industries for sitemap:", err);
  }

  // 4. 最新已发布公开标讯详情页（按发布时间倒序，抽取最新 5,000 条）
  let tenderRoutes: MetadataRoute.Sitemap = [];
  try {
    const tenders = await prisma.tender.findMany({
      select: {
        id: true,
        publishDate: true,
      },
      orderBy: { publishDate: "desc" },
      take: 5000,
    });

    tenderRoutes = tenders.map((t) => ({
      url: `${baseUrl}/tender/${t.id}`,
      lastModified: t.publishDate,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch (err) {
    console.error("Failed to load tenders for sitemap:", err);
  }

  return [
    ...staticRoutes,
    ...regionRoutes,
    ...industryRoutes,
    ...tenderRoutes,
  ];
}
