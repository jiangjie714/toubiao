import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCachedProvinces } from "@/lib/dict-cache";
import { getProjectList, projectStageBadgeColor, type ProjectStage } from "@/lib/project";
import {
  BriefcaseIcon,
  SearchIcon,
  MapPinIcon,
  ArrowRightIcon,
  RadarIcon,
  TrophyIcon,
  BuildingIcon,
  ClockIcon,
  CheckIcon,
} from "@/components/icons";

export const metadata = {
  title: "采购项目全生命周期穿透大盘 - 标讯通",
  description: "汇聚全国政府采购与工程招标项目主数据，全链路穿透采购意向预告、招标公告、更正澄清与中标结果公告",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    province?: string;
    stage?: string;
    sort?: "latest" | "budget" | "notices";
    page?: string;
  }>;
}) {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/projects");
  }

  const {
    q = "",
    province = "",
    stage = "all",
    sort = "latest",
    page = "1",
  } = await searchParams;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  const [projectData, provinces] = await Promise.all([
    getProjectList({
      query: q,
      provinceCode: province,
      stage: stage as "all" | "bidding" | "clarifying" | "awarded" | "terminated",
      sortBy: sort,
      page: pageNum,
      pageSize: 15,
    }),
    getCachedProvinces(),
  ]);

  const { projects, total, totalPages, metrics } = projectData;

  const STAGE_TABS: Array<{ value: string; label: string }> = [
    { value: "all", label: "全部阶段" },
    { value: "bidding", label: "正在招标" },
    { value: "clarifying", label: "更正澄清" },
    { value: "awarded", label: "已中标成交" },
    { value: "terminated", label: "流标/终止" },
  ];

  return (
    <div className="space-y-6">
      {/* 头部标题与价值主张 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-xs">
              <BriefcaseIcon className="h-4.5 w-4.5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              采购项目全生命周期穿透大盘
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            打破单篇公告割裂孤岛：同一项目全链路穿透【意向预告 → 招标申报 → 答疑更正 → 中标成交】，预算对比与动态追踪一览无余。
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
            href="/watches"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs"
          >
            <RadarIcon className="h-3.5 w-3.5 text-purple-600" />
            <span>我的项目雷达</span>
          </Link>
        </div>
      </div>

      {/* 四大核心宏观指标看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-surface p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">全库追踪项目</span>
            <BriefcaseIcon className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tnum">
            {metrics.totalProjects.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-slate-500">个</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            涵盖全网重点政府采购与工程项目
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-medium">在招与答疑项目</span>
            <ClockIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-blue-700 tnum">
            {metrics.biddingCount.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-blue-500">个</span>
          </div>
          <div className="mt-1 text-xs text-blue-600/80">处于关键窗口期，抢抓商机</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-medium">已中标成交项目</span>
            <CheckIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 tnum">
            {metrics.awardedCount.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-emerald-500">个</span>
          </div>
          <div className="mt-1 text-xs text-emerald-600/80">已产生中标人与成交下浮数据</div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-medium">多阶段全周期穿透</span>
            <RadarIcon className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-indigo-700 tnum">
            {metrics.multiStageCount.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-indigo-500">个</span>
          </div>
          <div className="mt-1 text-xs text-indigo-600/80">串联意向/招标/澄清/中标时间轴</div>
        </div>
      </div>

      {/* 阶段过滤 Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        {STAGE_TABS.map((tab) => {
          const active = stage === tab.value;
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (province) params.set("province", province);
          if (sort !== "latest") params.set("sort", sort);
          if (tab.value !== "all") params.set("stage", tab.value);

          return (
            <Link
              key={tab.value}
              href={`/projects?${params.toString()}`}
              className={`cursor-pointer whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-primary text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* 搜索与过滤筛选栏 */}
      <form
        method="GET"
        action="/projects"
        className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-xs"
      >
        {stage !== "all" && <input type="hidden" name="stage" value={stage} />}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="搜索项目名称、项目编号、采购人或中标供应商..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-primary focus:bg-surface focus:outline-none"
            />
          </div>

          <div>
            <select
              name="province"
              defaultValue={province}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-700 transition-colors focus:border-primary focus:bg-surface focus:outline-none"
            >
              <option value="">全部省份 / 区域</option>
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
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-700 transition-colors focus:border-primary focus:bg-surface focus:outline-none"
            >
              <option value="latest">按最新动态</option>
              <option value="budget">按预算金额</option>
              <option value="notices">按公告频次</option>
            </select>

            <button
              type="submit"
              className="cursor-pointer inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-strong transition-colors"
            >
              筛选
            </button>
          </div>
        </div>
      </form>

      {/* 项目列表卡片流 */}
      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
            <BriefcaseIcon className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              未找到匹配的项目主数据
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              请尝试调整搜索关键词或清空省份与阶段过滤条件
            </p>
            <div className="mt-4">
              <Link
                href="/projects"
                className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                重置所有筛选
              </Link>
            </div>
          </div>
        ) : (
          projects.map((project) => {
            const badgeClass = projectStageBadgeColor(project.stage as ProjectStage);

            return (
              <div
                key={project.id}
                className="group relative rounded-2xl border border-slate-200 bg-surface p-5 transition-all duration-200 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* 左侧主体信息 */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border ${badgeClass}`}
                      >
                        {project.stageLabel}
                      </span>

                      {project.projectNo && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 font-mono">
                          {project.projectNo}
                        </span>
                      )}

                      {project.provinceName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          <MapPinIcon className="h-3 w-3 text-slate-400" />
                          <span>{project.provinceName}</span>
                        </span>
                      )}

                      {project.noticeCount > 1 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          <ClockIcon className="h-3 w-3 text-indigo-500" />
                          <span>{project.noticeCount} 篇全周期公告</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2">
                      <Link href={`/projects/${project.id}`} className="cursor-pointer">
                        {project.displayTitle}
                      </Link>
                    </h2>

                    {/* 关系链：采购买方与中标商 */}
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                      {project.purchaser && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">采购人:</span>
                          <Link
                            href={`/purchasers/${encodeURIComponent(project.purchaser)}`}
                            className="font-medium text-slate-700 hover:text-primary hover:underline"
                          >
                            {project.purchaser}
                          </Link>
                        </div>
                      )}

                      {project.winningSupplier && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">中标商:</span>
                          <Link
                            href={`/suppliers/${encodeURIComponent(project.winningSupplier)}`}
                            className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            {project.winningSupplier}
                          </Link>
                        </div>
                      )}

                      <div className="text-slate-400">
                        最新更新: <span className="font-mono text-slate-600">{project.latestDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右侧金额指标与直达操作 */}
                  <div className="flex md:flex-col items-end justify-between md:justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 min-w-[180px]">
                    <div className="text-right">
                      {project.awardAmountWan ? (
                        <div>
                          <div className="text-xs text-slate-400">中标金额</div>
                          <div className="text-lg font-bold text-emerald-700 font-mono tnum">
                            {project.awardAmountWan.toLocaleString()}
                            <span className="ml-0.5 text-xs font-normal text-emerald-600">万元</span>
                          </div>
                          {project.budgetAmountWan && project.savingsRate ? (
                            <div className="text-[11px] text-slate-500">
                              预算 {project.budgetAmountWan}万 (下浮 {project.savingsRate}%)
                            </div>
                          ) : null}
                        </div>
                      ) : project.budgetAmountWan ? (
                        <div>
                          <div className="text-xs text-slate-400">采购预算</div>
                          <div className="text-lg font-bold text-blue-700 font-mono tnum">
                            {project.budgetAmountWan.toLocaleString()}
                            <span className="ml-0.5 text-xs font-normal text-blue-600">万元</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">暂未公布预算金额</div>
                      )}
                    </div>

                    <Link
                      href={`/projects/${project.id}`}
                      className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-2xs"
                    >
                      <span>全生命周期穿透</span>
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
          <div>
            共 <span className="font-semibold text-slate-800 font-mono">{total}</span> 个项目，当前第{" "}
            <span className="font-semibold text-slate-800 font-mono">{pageNum}</span> / {totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            {pageNum > 1 && (
              <Link
                href={`/projects?q=${encodeURIComponent(q)}&province=${province}&stage=${stage}&sort=${sort}&page=${pageNum - 1}`}
                className="cursor-pointer rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                上一页
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`/projects?q=${encodeURIComponent(q)}&province=${province}&stage=${stage}&sort=${sort}&page=${pageNum + 1}`}
                className="cursor-pointer rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                下一页
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
