import { prisma } from "@/lib/prisma";

const PROV_SUFFIX =
  /(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/;
const CITY_SUFFIX = /(市|地区|自治州|盟)$/;

type Keyed = { code: string; keys: string[] };

export type RegionMatch = { provinceCode: string | null; cityCode: string | null };

/**
 * 从数据库加载省/市两级区划，提供基于文本包含关系的地区识别。
 * 匹配键同时含全名与去后缀短名（如「浙江省」→「浙江」，「石家庄市」→「石家庄」），
 * 长键优先，避免「吉林」/「吉林市」这类歧义时选错。
 */
export async function loadRegionMatcher() {
  const [provs, cities] = await Promise.all([
    prisma.region.findMany({ where: { level: 1 } }),
    prisma.region.findMany({ where: { level: 2 } }),
  ]);

  const provinces: Keyed[] = provs
    .map((p) => ({
      code: p.code,
      keys: [...new Set([p.name, p.name.replace(PROV_SUFFIX, "")])],
    }))
    .sort((a, b) => Math.max(...b.keys.map(k => k.length)) - Math.max(...a.keys.map(k => k.length)));

  const citiesByProv = new Map<string, Keyed[]>();
  for (const c of cities) {
    const parent = c.parentCode ?? "";
    if (!citiesByProv.has(parent)) citiesByProv.set(parent, []);
    citiesByProv.get(parent)!.push({
      code: c.code,
      keys: [...new Set([c.name, c.name.replace(CITY_SUFFIX, "")])],
    });
  }
  for (const list of citiesByProv.values()) {
    list.sort((a, b) => Math.max(...b.keys.map(k => k.length)) - Math.max(...a.keys.map(k => k.length)));
  }

  function match(text: string): RegionMatch {
    const scope = text.replace(/\s+/g, "").slice(0, 600);
    // 取在文本中最早出现的省份（同位置取更长键），避免遍历顺序导致误判
    let best: { prov: Keyed; key: string; pos: number } | null = null;
    for (const prov of provinces) {
      for (const k of prov.keys) {
        const i = scope.indexOf(k);
        if (i < 0) continue;
        if (!best || i < best.pos || (i === best.pos && k.length > best.key.length)) {
          best = { prov, key: k, pos: i };
        }
        break;
      }
    }
    if (!best) return { provinceCode: null, cityCode: null };

    const cityList = citiesByProv.get(best.prov.code) ?? [];
    const near = scope.slice(best.pos, best.pos + 40);
    for (const city of cityList) {
      if (city.keys.some((k) => near.includes(k))) {
        return { provinceCode: best.prov.code, cityCode: city.code };
      }
    }
    // 兜底：城市关键词出现在正文其它位置（实施地点/联系方式等），取全文最早命中
    let fallback: { city: Keyed; pos: number } | null = null;
    for (const city of cityList) {
      for (const k of city.keys) {
        const i = scope.indexOf(k);
        if (i < 0) continue;
        if (!fallback || i < fallback.pos) fallback = { city, pos: i };
        break;
      }
    }
    if (fallback) return { provinceCode: best.prov.code, cityCode: fallback.city.code };
    return { provinceCode: best.prov.code, cityCode: null };
  }

  /** 名称精确映射（用于列表接口直接给出地区名的情况） */
  function byName(name: string): RegionMatch {
    const clean = name.replace(/\s+/g, "");
    for (const prov of provinces) {
      if (!prov.keys.includes(clean)) continue;
      return { provinceCode: prov.code, cityCode: null };
    }
    return match(clean);
  }

  return { match, byName };
}
