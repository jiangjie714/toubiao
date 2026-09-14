import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { getTopSuppliers } from "@/lib/competitor";
import {
  TrophyIcon,
  SearchIcon,
  BuildingIcon,
  MapPinIcon,
  ArrowRightIcon,
  RadarIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
} from "@/components/icons";

export const metadata = {
  title: "竞争对手中标情报与供应商全景库 - 标讯通",
  description: "全网招投标中标供应商大数据画像、亿元标王排行、核心发包买方朋友圈与同业竞争穿透分析",
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    province?: string;
    sort?: "amount" | "count";
  }>;
}) {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/suppliers");
  }

  const { q = "", province = "", sort = "count" } = await searchParams;
  const entitlement = await getEntitlement(user.uid);

  const [suppliers, provinces] = await Promise.all([
    getTopSuppliers({
      query: q,
      provinceCode: province,
      sortBy: sort === "amount" ? "amount" : "count",
      limit: 50,
    }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* 头部标题与价值主张 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-xs">
              <TrophyIcon className="h-4.5 w-4.5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              竞争对手与中标供应商情报库
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            穿透全网供应商的中标总金额、常驻战区、核心发包买方机构朋友圈与同业正面交锋雷达。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/suppliers/compare"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors shadow-2xs"
          >
            <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
            <span>同业对标PK</span>
          </Link>
          <Link
            href="/competitors"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs"
          >
            <RadarIcon className="h-3.5 w-3.5 text-purple-600" />
            <span>我的竞对监控雷达</span>
          </Link>
          <Link
            href="/analytics"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <span>行业情报大盘 →</span>
          </Link>
        </div>
      </div>

      {/* 搜索与过滤筛选栏 */}
      <form
        method="GET"
        action="/suppliers"
        className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="搜索竞争对手、中标单位或供应商名称..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm outline-none transition-colors focus:border-accent focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <select
              name="province"
              defaultValue={province}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">全部省份/战区</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <select
              name="sort"
              defaultValue={sort}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="count">按中标次数排序</option>
              <option value="amount">按中标总额排序</option>
            </select>
            <button
              type="submit"
              className="cursor-pointer shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong transition-colors"
            >
              筛选
            </button>
          </div>
        </div>
      </form>

      {/* 供应商情报数据表格 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <div>
            已检索到 <strong className="font-semibold text-slate-800">{suppliers.length}</strong> 家中标企业
            {q && `（关键词「${q}」）`}
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>当前身份：{entitlement.planName}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/40 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3.5 font-medium w-16 text-center">排名</th>
                <th className="px-4 py-3.5 font-medium">供应商 / 竞争对手单位</th>
                <th className="px-4 py-3.5 font-medium text-right">历史中标数</th>
                <th className="px-4 py-3.5 font-medium text-right">中标总额 (万元)</th>
                <th className="px-4 py-3.5 font-medium text-right">平均标的 (万元)</th>
                <th className="px-4 py-3.5 font-medium">核心合作发包买方</th>
                <th className="px-4 py-3.5 font-medium">主要覆盖战区</th>
                <th className="px-4 py-3.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s, idx) => {
                const rank = idx + 1;
                let rankBadge = (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {rank}
                  </span>
                );
                if (rank === 1) {
                  rankBadge = (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow-2xs">
                      1
                    </span>
                  );
                } else if (rank === 2) {
                  rankBadge = (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white shadow-2xs">
                      2
                    </span>
                  );
                } else if (rank === 3) {
                  rankBadge = (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/80 text-xs font-bold text-white shadow-2xs">
                      3
                    </span>
                  );
                }

                return (
                  <tr key={s.name} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-4 text-center">{rankBadge}</td>
                    <td className="px-4 py-4 max-w-[256px]">
                      <Link
                        href={`/suppliers/${encodeURIComponent(s.name)}`}
                        className="cursor-pointer font-semibold text-slate-900 hover:text-primary transition-colors flex items-center gap-1.5 min-w-0"
                      >
                        <BuildingIcon className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="truncate">{s.name}</span>
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        首中：{s.firstDate} · 最近中标：{s.latestDate}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-bold text-slate-900 tnum">{s.winCount}</span> 标
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-amber-600 tnum">
                      {s.totalAwardWan > 0 ? `¥${s.totalAwardWan.toLocaleString()}` : "详见公告"}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 tnum">
                      {s.avgAwardWan > 0 ? `¥${s.avgAwardWan.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {s.mainPurchasers.length > 0 ? (
                          s.mainPurchasers.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 truncate max-w-[140px]"
                              title={p}
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">公开招采</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {s.provinces.length > 0 ? (
                          s.provinces.map((prov, prIdx) => (
                            <span
                              key={prIdx}
                              className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                            >
                              <MapPinIcon className="h-3 w-3" />
                              {prov}
                            </span>
                          ))
                        ) : (
                          <span className="whitespace-nowrap text-xs text-slate-400">全国</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/suppliers/compare?names=${encodeURIComponent(s.name)}`}
                          className="cursor-pointer inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                          title="将此企业加入同业对标PK"
                        >
                          <ArrowsRightLeftIcon className="h-3 w-3" />
                          <span>对标</span>
                        </Link>
                        <Link
                          href={`/suppliers/${encodeURIComponent(s.name)}`}
                          className="cursor-pointer inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary transition-colors"
                        >
                          <span>画像</span>
                          <ArrowRightIcon className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    未检索到符合条件的中标供应商，您可以尝试更换关键词或在上方直接搜索企业全称。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
