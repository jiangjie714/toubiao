import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { getTopPurchasers } from "@/lib/purchaser";
import {
  BuildingIcon,
  SearchIcon,
  MapPinIcon,
  ArrowRightIcon,
  RadarIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@/components/icons";

export const metadata = {
  title: "采购买方机构与发包金主大厅 - 标讯通",
  description: "全网重点招投标采购买方机构画像、预算释放走势、首选供应商合作伙伴网络与发包全貌分析",
};

export default async function PurchasersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    province?: string;
    sort?: "budget" | "count";
  }>;
}) {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/purchasers");
  }

  const { q = "", province = "", sort = "count" } = await searchParams;
  const entitlement = await getEntitlement(user.uid);

  const [purchasers, provinces] = await Promise.all([
    getTopPurchasers({
      query: q,
      provinceCode: province,
      sortBy: sort === "budget" ? "budget" : "count",
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
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-xs">
              <BuildingIcon className="h-4.5 w-4.5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              采购买方机构与发包金主大厅
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            洞悉各省重点党政机关、企事业单位与高校科研院所的年度采购总额、首选合作商圈子与直达联络图谱。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/suppliers"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
          >
            <TrophyIcon className="h-3.5 w-3.5 text-amber-600" />
            <span>中标供应商库 →</span>
          </Link>
          <Link
            href="/watches"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs"
          >
            <RadarIcon className="h-3.5 w-3.5 text-purple-600" />
            <span>我的监控雷达</span>
          </Link>
        </div>
      </div>

      {/* 搜索与过滤筛选栏 */}
      <form
        method="GET"
        action="/purchasers"
        className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="搜索采购单位、招标业主或发包金主全称..."
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
              <option value="count">按发包标讯数排序</option>
              <option value="budget">按发包预算总额排序</option>
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

      {/* 采购买方机构数据表格 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <div>
            已收录 <strong className="font-semibold text-slate-800">{purchasers.length}</strong> 家采购买方机构
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
                <th className="px-4 py-3.5 font-medium">采购买方 / 招标业主单位</th>
                <th className="px-4 py-3.5 font-medium text-right">历史发包数</th>
                <th className="px-4 py-3.5 font-medium text-right">发包总预算 (万元)</th>
                <th className="px-4 py-3.5 font-medium text-right">已成交中标 (万元)</th>
                <th className="px-4 py-3.5 font-medium">首选合作供应商</th>
                <th className="px-4 py-3.5 font-medium">所在战区</th>
                <th className="px-4 py-3.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchasers.map((p, idx) => {
                const rank = idx + 1;
                let rankBadge = (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {rank}
                  </span>
                );
                if (rank === 1) {
                  rankBadge = (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-2xs">
                      1
                    </span>
                  );
                } else if (rank === 2) {
                  rankBadge = (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white shadow-2xs">
                      2
                    </span>
                  );
                } else if (rank === 3) {
                  rankBadge = (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white shadow-2xs">
                      3
                    </span>
                  );
                }

                return (
                  <tr key={p.name} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-4 text-center">{rankBadge}</td>
                    <td className="px-4 py-4 max-w-[256px]">
                      <Link
                        href={`/purchasers/${encodeURIComponent(p.name)}`}
                        className="cursor-pointer font-semibold text-slate-900 hover:text-primary transition-colors flex items-center gap-1.5 min-w-0"
                      >
                        <BuildingIcon className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        发布跨度：{p.firstDate} 至 {p.latestDate}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-bold text-slate-900 tnum">{p.noticeCount}</span> 标
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-blue-700 tnum">
                      {p.totalBudgetWan > 0 ? `¥${p.totalBudgetWan.toLocaleString()}` : "详见公告"}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-amber-600 tnum">
                      {p.totalAwardWan > 0 ? `¥${p.totalAwardWan.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {p.topSuppliers.length > 0 ? (
                          p.topSuppliers.map((s, sIdx) => (
                            <Link
                              key={sIdx}
                              href={`/suppliers/${encodeURIComponent(s)}`}
                              className="inline-flex rounded-md bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 truncate max-w-[140px]"
                              title={s}
                            >
                              {s}
                            </Link>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">公开招标中</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {p.provinces.length > 0 ? (
                          p.provinces.map((prov, prIdx) => (
                            <span
                              key={prIdx}
                              className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                            >
                              <MapPinIcon className="h-3 w-3 text-slate-400" />
                              {prov}
                            </span>
                          ))
                        ) : (
                          <span className="whitespace-nowrap text-xs text-slate-400">全国/直属</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/purchasers/${encodeURIComponent(p.name)}`}
                        className="cursor-pointer inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary transition-colors"
                      >
                        <span>发包画像</span>
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {purchasers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    未检索到符合条件的采购买方机构，您可以尝试更换关键词或在上方直接搜索单位全称。
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
