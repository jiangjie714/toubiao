import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { getRegionDossier } from "@/lib/region";
import RegionTrackButton from "@/components/region-track-button";
import { tenderTypeColor, tenderTypeLabel } from "@/lib/constants";
import {
  MapPinIcon,
  SparklesIcon,
  BuildingIcon,
  TrophyIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const dossier = await getRegionDossier(code, null);
  if (!dossier) return { title: "区域未找到 - 标讯通" };

  return {
    title: `【区域作战大盘】${dossier.name}招投标公共资源交易全景透视 - 标讯通`,
    description: `${dossier.name}政府采购预算池、在招重大项目、省内核心发包金主与领军标王透视`,
  };
}

export default async function RegionDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getSession();
  const entitlement = user ? await getEntitlement(user.uid) : null;

  const dossier = await getRegionDossier(
    code,
    user ? { id: user.uid, role: user.role, planCode: entitlement?.planCode } : null
  );

  if (!dossier) {
    notFound();
  }

  const canTrack = entitlement ? entitlement.features.pushGroups > 0 : false;
  const canExport = entitlement ? entitlement.features.exportDaily > 0 : false;

  return (
    <div className="space-y-8">
      {/* 顶部导航与操作控制台 */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/regions" className="hover:text-primary transition">
              ← 全国招投标大盘
            </Link>
            <span>/</span>
            <span>{dossier.zone}</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">{dossier.name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              {dossier.name}招投标区域作战地图
            </h1>
            <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
              {dossier.zone}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
              行政代码: {dossier.code}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <RegionTrackButton
            provinceCode={dossier.code}
            provinceName={dossier.name}
            initialIsWatched={dossier.isWatched}
            isLoggedIn={!!user}
            canTrack={canTrack}
          />

          <Link
            href={canExport ? `/exports?province=${dossier.code}` : "/pricing"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>导出本省商机报表</span>
          </Link>
        </div>
      </div>

      {/* 5 大核心宏观指标卡 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">全省发包预算池</div>
          <div className="mt-2 text-2xl font-black text-blue-700 font-mono">
            {dossier.totalBudgetWan > 0
              ? `${dossier.totalBudgetWan.toLocaleString()}万`
              : "待更新"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            约 {(dossier.totalBudgetWan / 10000).toFixed(2)} 亿元
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">中标成交总额</div>
          <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
            {dossier.totalAwardWan > 0
              ? `${dossier.totalAwardWan.toLocaleString()}万`
              : "待统计"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            已公布结果项目成交累计
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">平均单标客单价</div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {dossier.avgBudgetWan > 0 ? `${dossier.avgBudgetWan}万` : "-"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            单项目平均采购预算体量
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">采购节资下浮率</div>
          <div className="mt-2 text-2xl font-black text-amber-600 font-mono">
            {dossier.savingsRate ? `${dossier.savingsRate}%` : "3.2%"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            预算与最终成交价资金节约率
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-slate-500">在库标讯体量</div>
          <div className="mt-2 text-2xl font-black text-purple-700 font-mono">
            {dossier.tenderCount}{" "}
            <span className="text-xs font-normal text-slate-500">篇</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            招标 {dossier.noticeCount} · 中标 {dossier.resultCount}
          </div>
        </div>
      </div>

      {/* 两栏主体布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：重大标讯雷达与实时标讯流（占据 7 列） */}
        <div className="lg:col-span-7 space-y-6">
          {/* 百万级重磅商机雷达 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-4.5 w-4.5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">
                  {dossier.name}重磅大额商机雷达 (百万级以上)
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">按预算降序</span>
            </div>

            <div className="space-y-3">
              {dossier.featuredTenders.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center">
                  暂未收录该省份百万级以上在招标的
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
                          {t.winningSupplier && (
                            <div className="font-medium text-emerald-700">
                              中标: {t.winningSupplier}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 全省最新标讯实时流 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4.5 w-4.5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  {dossier.name}最新招投标公告流
                </h2>
              </div>
              <Link
                href={`/list?province=${dossier.code}`}
                className="text-xs text-primary hover:underline"
              >
                查看全部 {dossier.tenderCount} 篇 →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {dossier.recentTenders.map((t) => (
                <div
                  key={t.id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tenderTypeColor(
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
                      className="text-xs font-semibold text-slate-800 hover:text-primary transition line-clamp-1"
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

        {/* 右侧：买方金主榜、标王榜、地市分布与主导行业（占据 5 列） */}
        <div className="lg:col-span-5 space-y-6">
          {/* 省内核心发包金主 Top 10 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <BuildingIcon className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {dossier.name}发包金主 Top 10
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
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({p.count}标)
                    </span>
                  </div>
                </div>
              ))}

              {dossier.topPurchasers.length === 0 && (
                <div className="text-xs text-slate-400 py-4 text-center">
                  暂无采购单位统计
                </div>
              )}
            </div>
          </div>

          {/* 省内中标标王 Top 10 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <TrophyIcon className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {dossier.name}领军中标标王 Top 10
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">按中标成交额</span>
            </div>

            <div className="space-y-2">
              {dossier.topSuppliers.map((s, idx) => (
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
                        className="font-medium text-slate-800 hover:text-primary hover:underline truncate"
                      >
                        {s.name}
                      </Link>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-semibold text-emerald-700 font-mono">
                      {s.isLocked ? "***" : `${s.awardWan}万`}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({s.count}标)
                    </span>
                  </div>
                </div>
              ))}

              {dossier.topSuppliers.length === 0 && (
                <div className="text-xs text-slate-400 py-4 text-center">
                  暂无中标供应商统计
                </div>
              )}
            </div>
          </div>

          {/* 下辖地级市商机分布 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  下辖地级市商机分布
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">覆盖地市</span>
            </div>

            <div className="space-y-2">
              {dossier.cities.map((c) => (
                <div
                  key={c.code}
                  className="flex items-center justify-between text-xs rounded-lg p-2 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ({c.code})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-500">{c.count} 篇</span>
                    <span className="font-bold text-blue-700">
                      {c.budgetWan > 0 ? `${c.budgetWan}万` : "-"}
                    </span>
                  </div>
                </div>
              ))}

              {dossier.cities.length === 0 && (
                <div className="text-xs text-slate-400 py-3 text-center">
                  暂无地级市细分数据
                </div>
              )}
            </div>
          </div>

          {/* 省内主导产业赛道分布 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <ChartBarIcon className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  省内主导产业赛道
                </h3>
              </div>
              <Link href="/industries" className="text-[11px] text-primary hover:underline">
                行业大盘 →
              </Link>
            </div>

            <div className="space-y-2">
              {dossier.industries.map((ind) => (
                <Link
                  key={ind.code}
                  href={`/industries/${ind.code}`}
                  className="flex items-center justify-between text-xs rounded-lg p-2 hover:bg-slate-50 transition block"
                >
                  <span className="font-medium text-slate-800">{ind.name}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400">{ind.count} 标</span>
                    <span className="font-bold text-blue-700">{ind.budgetWan}万</span>
                  </div>
                </Link>
              ))}

              {dossier.industries.length === 0 && (
                <div className="text-xs text-slate-400 py-3 text-center">
                  暂无产业细分统计
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 免费用户付费墙尊贵会员引导卡 */}
      {!dossier.isPremium && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/80 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-blue-700" />
                <span className="text-sm font-bold text-blue-900">
                  白金与企业会员专享：{dossier.name}招投标情报全量穿透特权
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                当前仅展示部分脱敏数据。升级白金版即可 100% 解锁全省全部发包金主联系通讯录、
                省内中标标王名单与百万级重大在招商机，享受区域商机每周自动推送与 Excel 批量导出特权！
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/pricing"
                className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-strong"
              >
                立即升级白金会员
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
