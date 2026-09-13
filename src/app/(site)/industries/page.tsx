import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getIndustryList } from "@/lib/industry";
import {
  BriefcaseIcon,
  BuildingIcon,
  TrophyIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClockIcon,
  RadarIcon,
} from "@/components/icons";

export const metadata = {
  title: "重点垂直行业情报包与赛道大盘 - 标讯通",
  description: "全网重点招投标行业赛道全景分析、采购买方金主排行榜、中标标王名录与专属精准商机包",
};

export default async function IndustriesPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/industries");
  }

  const industries = await getIndustryList();

  const totalBudgetWan = industries.reduce((acc, i) => acc + i.totalBudgetWan, 0);
  const totalTenders = industries.reduce((acc, i) => acc + i.tenderCount, 0);
  const totalPurchasers = industries.reduce((acc, i) => acc + i.purchaserCount, 0);

  return (
    <div className="space-y-6">
      {/* 头部标题与价值主张 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs">
              <SparklesIcon className="h-4.5 w-4.5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              垂直行业情报包与重点赛道大盘
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            赋能企业深耕特定专业赛道：全景洞察 IT 信创、医疗器械、市政工程等重点赛道的年度预算释放、核心买方圈子与超级标王名录。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/purchasers"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
          >
            <BuildingIcon className="h-3.5 w-3.5 text-blue-600" />
            <span>买方金主大厅 →</span>
          </Link>
          <Link
            href="/suppliers"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
          >
            <TrophyIcon className="h-3.5 w-3.5 text-amber-600" />
            <span>中标竞对库 →</span>
          </Link>
          <Link
            href="/exports"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs"
          >
            <RadarIcon className="h-3.5 w-3.5 text-purple-600" />
            <span>商机批量导出</span>
          </Link>
        </div>
      </div>

      {/* 四大核心宏观指标看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-surface p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">监测重点赛道</span>
            <SparklesIcon className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tnum">
            {industries.length}
            <span className="ml-1 text-xs font-normal text-slate-500">大垂直赛道</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">数字政务、医疗器械、市政基建等</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-medium">累计监测预算总额</span>
            <BriefcaseIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-blue-700 tnum">
            {(totalBudgetWan / 10000).toFixed(1)}
            <span className="ml-1 text-xs font-normal text-blue-600">亿元</span>
          </div>
          <div className="mt-1 text-xs text-blue-600/80">全网政府采购与重大工程发包</div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-medium">归集专业标讯</span>
            <ClockIcon className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-indigo-700 tnum">
            {totalTenders.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-indigo-500">篇公报</span>
          </div>
          <div className="mt-1 text-xs text-indigo-600/80">100% 规则清洗精准打标分类</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-medium">活跃采购买方</span>
            <BuildingIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 tnum">
            {totalPurchasers.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-emerald-500">家机构</span>
          </div>
          <div className="mt-1 text-xs text-emerald-600/80">各行业省市机关与企事业单位</div>
        </div>
      </div>

      {/* 行业赛道网格卡片矩阵 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {industries.map((ind) => {
          return (
            <div
              key={ind.code}
              className="group rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* 头部：分类标签与热度 */}
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {ind.category}
                  </span>
                  <div className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600 ring-1 ring-rose-500/20">
                    <span>🔥 赛道热度</span>
                    <span className="font-mono">{ind.hotScore}</span>
                  </div>
                </div>

                {/* 赛道名称 */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                    <Link href={`/industries/${ind.code}`} className="cursor-pointer">
                      {ind.name}
                    </Link>
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ind.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-blue-50/70 px-2 py-0.5 text-[11px] font-medium text-primary border border-blue-100/60"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 赛道关键指标 */}
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50/60 p-3 text-center">
                  <div>
                    <div className="text-[11px] text-slate-400">发包总预算</div>
                    <div className="mt-1 text-sm font-bold text-blue-700 font-mono tnum">
                      {ind.totalBudgetWan >= 10000
                        ? `${(ind.totalBudgetWan / 10000).toFixed(1)} 亿元`
                        : `${ind.totalBudgetWan.toLocaleString()} 万元`}
                    </div>
                  </div>
                  <div className="border-x border-slate-200/60">
                    <div className="text-[11px] text-slate-400">标讯总数</div>
                    <div className="mt-1 text-sm font-bold text-slate-800 font-mono tnum">
                      {ind.tenderCount} 篇
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">活跃买方</div>
                    <div className="mt-1 text-sm font-bold text-slate-800 font-mono tnum">
                      {ind.purchaserCount} 家
                    </div>
                  </div>
                </div>
              </div>

              {/* 底部操作与直达 */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  最新动态: <span className="font-mono text-slate-600">{ind.latestDate}</span>
                </span>
                <Link
                  href={`/industries/${ind.code}`}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 font-semibold text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-2xs"
                >
                  <span>进入 360° 深度大盘</span>
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
