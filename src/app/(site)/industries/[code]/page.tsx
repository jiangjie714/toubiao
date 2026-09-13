import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { getIndustryDossier, INDUSTRY_META } from "@/lib/industry";
import IndustryTrackButton from "@/components/industry-track-button";
import { tenderTypeColor, tenderTypeLabel } from "@/lib/constants";
import {
  SparklesIcon,
  BuildingIcon,
  TrophyIcon,
  ShieldCheckIcon,
  MapPinIcon,
  ClockIcon,
  ArrowDownTrayIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const meta = INDUSTRY_META[code];
  if (!meta) return { title: "赛道未找到 - 标讯通" };

  return {
    title: `【行业情报包】${meta.name}深度大盘 - 标讯通`,
    description: meta.description,
  };
}

export default async function IndustryDossierPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const user = await getSession();
  if (!user) {
    const { code } = await params;
    redirect(`/login?next=/industries/${code}`);
  }

  const { code } = await params;
  const entitlement = await getEntitlement(user.uid);
  const dbUser = await prisma.user.findUnique({
    where: { id: user.uid },
    select: { teamMembership: { select: { teamId: true } } },
  });

  const dossier = await getIndustryDossier(code, {
    id: user.uid,
    role: user.role,
    planCode: entitlement.planCode,
    teamId: dbUser?.teamMembership?.teamId ?? null,
  });

  if (!dossier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* 顶部面包屑导航 */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-primary transition-colors">
          首页
        </Link>
        <span>/</span>
        <Link href="/industries" className="hover:text-primary transition-colors">
          垂直行业赛道
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{dossier.name}</span>
      </nav>

      {/* 头部 Header */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200/60">
                {dossier.category}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-600">
                行业代码: {dossier.code}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {dossier.name} 360° 深度情报大盘
            </h1>

            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              {dossier.description}
            </p>
          </div>

          {/* 右侧操作栏 */}
          <div className="flex flex-wrap items-center gap-3">
            <IndustryTrackButton
              industryCode={dossier.code}
              initialIsWatched={dossier.isWatched}
            />

            <Link
              href={`/exports?q=${encodeURIComponent(dossier.name.slice(0, 4))}`}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              <span>导出该赛道商机</span>
            </Link>
          </div>
        </div>

        {/* 4 项核心宏观财务指标 */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-5">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">赛道发包总预算</div>
            <div className="text-xl font-bold text-blue-700 font-mono tnum">
              {dossier.totalBudgetWan >= 10000 ? (
                <>
                  {(dossier.totalBudgetWan / 10000).toFixed(2)}
                  <span className="ml-1 text-xs font-normal text-blue-600">亿元</span>
                </>
              ) : (
                <>
                  {dossier.totalBudgetWan.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-blue-600">万元</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">中标成交总额</div>
            <div className="text-xl font-bold text-emerald-700 font-mono tnum">
              {dossier.totalAwardWan > 0 ? (
                <>
                  {dossier.totalAwardWan >= 10000
                    ? `${(dossier.totalAwardWan / 10000).toFixed(2)} 亿元`
                    : `${dossier.totalAwardWan.toLocaleString()} 万元`}
                </>
              ) : (
                <span className="text-sm font-normal text-slate-400">大额统计中</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">平均单标客单价</div>
            <div className="text-xl font-bold text-slate-800 font-mono tnum">
              {dossier.avgBudgetWan.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-slate-500">万元/标</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">归集标讯 / 活跃买方</div>
            <div className="text-xl font-bold text-indigo-700 font-mono tnum">
              {dossier.tenderCount}
              <span className="ml-0.5 text-xs font-normal text-indigo-600">篇</span>
              <span className="ml-1 text-xs text-slate-400">
                ({dossier.purchaserCount} 家买方)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 两栏主体布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：重大标讯雷达与实时标讯流（占据 7 列） */}
        <div className="lg:col-span-7 space-y-6">
          {/* 重磅大额商机精选 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-4.5 w-4.5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">
                  赛道重磅大额商机雷达 (百万级重大项目)
                </h2>
              </div>
              <span className="text-xs text-slate-400">按预算体量排序</span>
            </div>

            <div className="space-y-3">
              {dossier.featuredTenders.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center">
                  暂未收录该赛道百万级以上重大在招标的
                </div>
              ) : (
                dossier.featuredTenders.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-4 transition-all ${
                      t.isLocked
                        ? "border-slate-200 bg-slate-50/50"
                        : "border-slate-200 bg-surface hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${tenderTypeColor(
                          t.type
                        )}`}
                      >
                        {tenderTypeLabel(t.type)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {t.publishDate}
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-bold text-slate-900">
                      {t.isLocked ? (
                        <span className="text-slate-500">{t.title}</span>
                      ) : (
                        <Link
                          href={`/tender/${t.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {t.title}
                        </Link>
                      )}
                    </h3>

                    {!t.isLocked && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100 pt-2 text-slate-500">
                        <div>
                          采购人:{" "}
                          {t.purchaser ? (
                            <Link
                              href={`/purchasers/${encodeURIComponent(t.purchaser)}`}
                              className="font-medium text-slate-700 hover:text-primary hover:underline"
                            >
                              {t.purchaser}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {t.budgetAmountWan && (
                            <div className="font-semibold text-blue-700 font-mono">
                              预算: {t.budgetAmountWan.toLocaleString()} 万元
                            </div>
                          )}
                          {t.awardAmountWan && (
                            <div className="font-semibold text-emerald-700 font-mono">
                              中标: {t.awardAmountWan.toLocaleString()} 万元
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 免费用户解锁提示 */}
            {!dossier.isPremium && (
              <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheckIcon className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="text-xs text-amber-900">
                      <span className="font-bold">解锁该行业全部重大招标项目</span>：当前免费版仅展示前 2 个标的，升级白金版解锁全量千万级商机与联系人。
                    </div>
                  </div>
                  <Link
                    href="/pricing"
                    className="cursor-pointer shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-xs"
                  >
                    升级白金版
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 实时行业标讯流 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-base font-bold text-slate-900">
                  {dossier.name} 实时标讯流
                </h2>
              </div>
              <span className="text-xs text-slate-400">持续监测入库</span>
            </div>

            <div className="space-y-3">
              {dossier.recentTenders.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${tenderTypeColor(
                          t.type
                        )}`}
                      >
                        {tenderTypeLabel(t.type)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {t.publishDate}
                      </span>
                    </div>
                    <Link
                      href={`/tender/${t.id}`}
                      className="block truncate text-xs font-bold text-slate-800 hover:text-primary transition-colors"
                    >
                      {t.title}
                    </Link>
                    {t.purchaser && (
                      <div className="text-[11px] text-slate-500 truncate">
                        采购单位: {t.purchaser}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {t.awardAmountWan ? (
                      <div className="text-xs font-bold text-emerald-700 font-mono">
                        {t.awardAmountWan} 万元
                      </div>
                    ) : t.budgetAmountWan ? (
                      <div className="text-xs font-bold text-blue-700 font-mono">
                        {t.budgetAmountWan} 万元
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">未注预算</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：行业买方榜、供应商榜与核心战区（占据 5 列） */}
        <div className="lg:col-span-5 space-y-6">
          {/* 行业 Top 10 发包金主买方榜 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <BuildingIcon className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  行业核心发包金主 Top 10
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">按发包体量</span>
            </div>

            <div className="space-y-2">
              {dossier.topPurchasers.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold ${
                        idx === 0
                          ? "bg-amber-100 text-amber-800"
                          : idx === 1
                          ? "bg-slate-200 text-slate-700"
                          : idx === 2
                          ? "bg-orange-100 text-orange-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    {p.isLocked ? (
                      <span className="text-slate-500 truncate font-mono">
                        {p.name}
                      </span>
                    ) : (
                      <Link
                        href={`/purchasers/${encodeURIComponent(p.name)}`}
                        className="font-medium text-slate-800 hover:text-primary hover:underline truncate"
                      >
                        {p.name}
                      </Link>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-semibold text-blue-700 font-mono">
                      {p.isLocked ? "***" : `${p.budgetWan}万`}
                    </span>
                    <span className="ml-1 text-[11px] text-slate-400">
                      ({p.count}标)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {dossier.lockedPurchasersCount > 0 && (
              <div className="pt-2 text-center text-[11px] text-slate-500">
                剩余 {dossier.lockedPurchasersCount} 家买方已脱敏，
                <Link href="/pricing" className="text-primary hover:underline font-semibold">
                  升级白金版
                </Link>{" "}
                查看全貌
              </div>
            )}
          </div>

          {/* 行业 Top 10 中标超级标王榜 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <TrophyIcon className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  行业领军中标标王 Top 10
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">按中标金额</span>
            </div>

            <div className="space-y-2">
              {dossier.topSuppliers.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">
                  暂未录得该赛道的中标战绩
                </div>
              ) : (
                dossier.topSuppliers.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold ${
                          idx === 0
                            ? "bg-amber-100 text-amber-800"
                            : idx === 1
                            ? "bg-slate-200 text-slate-700"
                            : idx === 2
                            ? "bg-orange-100 text-orange-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>

                      {s.isLocked ? (
                        <span className="text-slate-500 truncate font-mono">
                          {s.name}
                        </span>
                      ) : (
                        <Link
                          href={`/suppliers/${encodeURIComponent(s.name)}`}
                          className="font-medium text-slate-800 hover:text-emerald-700 hover:underline truncate"
                        >
                          {s.name}
                        </Link>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-semibold text-emerald-700 font-mono">
                        {s.isLocked ? "***" : `${s.awardWan}万`}
                      </span>
                      <span className="ml-1 text-[11px] text-slate-400">
                        ({s.count}标)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {dossier.lockedSuppliersCount > 0 && (
              <div className="pt-2 text-center text-[11px] text-slate-500">
                剩余 {dossier.lockedSuppliersCount} 家中标商已锁定，
                <Link href="/pricing" className="text-emerald-700 hover:underline font-semibold">
                  升级白金版
                </Link>{" "}
                查看竞对战报
              </div>
            )}
          </div>

          {/* 行业核心活跃战区省份 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  行业核心发包战区 (Top 6 省份)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {dossier.activeProvinces.map((prov) => (
                <div
                  key={prov.code}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-xs space-y-1"
                >
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>{prov.name}</span>
                    <span className="text-slate-400 font-normal font-mono">
                      {prov.count} 标
                    </span>
                  </div>
                  <div className="text-blue-700 font-semibold font-mono">
                    {prov.budgetWan.toLocaleString()} 万元
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
