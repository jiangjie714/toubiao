import { prisma } from "@/lib/prisma";

export interface CachedRegionItem {
  code: string;
  name: string;
}

export interface CachedCityItem extends CachedRegionItem {
  parentCode: string | null;
}

export interface CachedIndustryItem {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
}

// 进程级持久内存缓存
let cachedProvinces: CachedRegionItem[] | null = null;
let cachedCities: CachedCityItem[] | null = null;
let cachedIndustries: CachedIndustryItem[] | null = null;
let provinceMap = new Map<string, string>();
let cityMap = new Map<string, string>();
let industryMap = new Map<string, string>();

let lastRegionsFetch = 0;
let lastIndustriesFetch = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1小时缓存，行政区划与行业字典属于绝对静态配置

/**
 * 获取内存缓存的省级区划列表 (level=1)
 */
export async function getCachedProvinces(): Promise<CachedRegionItem[]> {
  const now = Date.now();
  if (cachedProvinces && now - lastRegionsFetch < CACHE_TTL_MS) {
    return cachedProvinces;
  }

  await refreshRegionsCache();
  return cachedProvinces || [];
}

/**
 * 获取内存缓存的地级市区划列表 (level=2)
 */
export async function getCachedCities(): Promise<CachedCityItem[]> {
  const now = Date.now();
  if (cachedCities && now - lastRegionsFetch < CACHE_TTL_MS) {
    return cachedCities;
  }

  await refreshRegionsCache();
  return cachedCities || [];
}

/**
 * 获取全量省市数据与映射 Map (供列表页及详情页 0ms 查找)
 */
export async function getCachedRegionsData(): Promise<{
  provinces: CachedRegionItem[];
  cities: CachedCityItem[];
  provinceMap: Map<string, string>;
  cityMap: Map<string, string>;
}> {
  const now = Date.now();
  if (cachedProvinces && cachedCities && now - lastRegionsFetch < CACHE_TTL_MS) {
    return {
      provinces: cachedProvinces,
      cities: cachedCities,
      provinceMap,
      cityMap,
    };
  }

  await refreshRegionsCache();
  return {
    provinces: cachedProvinces || [],
    cities: cachedCities || [],
    provinceMap,
    cityMap,
  };
}

/**
 * 获取内存缓存的行业分类字典与映射 Map
 */
export async function getCachedIndustriesData(): Promise<{
  industries: CachedIndustryItem[];
  industryMap: Map<string, string>;
}> {
  const now = Date.now();
  if (cachedIndustries && now - lastIndustriesFetch < CACHE_TTL_MS) {
    return {
      industries: cachedIndustries,
      industryMap,
    };
  }

  try {
    const list = await prisma.industryDict.findMany({
      where: { parentId: null },
      select: { id: true, code: true, name: true, parentId: true },
      orderBy: { id: "asc" },
    });
    cachedIndustries = list;
    industryMap = new Map(list.map((item) => [item.code, item.name]));
    lastIndustriesFetch = now;
  } catch (err) {
    console.error("Failed to load industryDict cache:", err);
    if (!cachedIndustries) cachedIndustries = [];
  }

  return {
    industries: cachedIndustries || [],
    industryMap,
  };
}

async function refreshRegionsCache(): Promise<void> {
  try {
    const [provs, cits] = await Promise.all([
      prisma.region.findMany({
        where: { level: 1 },
        select: { code: true, name: true },
        orderBy: { code: "asc" },
      }),
      prisma.region.findMany({
        where: { level: 2 },
        select: { code: true, name: true, parentCode: true },
        orderBy: { code: "asc" },
      }),
    ]);

    cachedProvinces = provs;
    cachedCities = cits;
    provinceMap = new Map(provs.map((p) => [p.code, p.name]));
    cityMap = new Map(cits.map((c) => [c.code, c.name]));
    lastRegionsFetch = Date.now();
  } catch (err) {
    console.error("Failed to refresh regions cache:", err);
    if (!cachedProvinces) cachedProvinces = [];
    if (!cachedCities) cachedCities = [];
  }
}

/**
 * 根据区划代码快速获取中文名称（省或市）
 */
export async function getRegionDisplayName(code: string | null | undefined): Promise<string> {
  if (!code) return "";
  const { provinceMap, cityMap } = await getCachedRegionsData();
  return provinceMap.get(code) || cityMap.get(code) || "";
}

/**
 * 根据行业代码快速获取行业名称
 */
export async function getIndustryDisplayName(code: string | null | undefined): Promise<string> {
  if (!code) return "";
  const { industryMap } = await getCachedIndustriesData();
  return industryMap.get(code) || "";
}
