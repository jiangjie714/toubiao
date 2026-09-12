import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupplierProfileAction } from "@/app/actions/competitor";
import SupplierTrackButton from "@/components/supplier-track-button";
import {
  BuildingIcon,
  TrophyIcon,
  MapPinIcon,
  LockClosedIcon,
  ArrowRightIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return {
    title: `${decoded} - 中标战绩与竞对穿透档案 - 标讯通`,
    description: `查看${decoded}的历史中标总额、核心发包买方朋友圈、作战区域分布与近期招投标态势`,
  };
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const user = await getSession();
  if (!user) {
    const { name } = await params;
    redirect(`/login?next=/suppliers/${encodeURIComponent(name)}`);
  }

  const { name } = await params;
  const supplierName = decodeURIComponent(name);
  const result = await getSupplierProfileAction(supplierName);

  if (!result.success || !result.data) {
    notFound();
  }

  const profile = result.data;

  return (
    <div className="space-y-6">
      {/* 顶部返回导航 */}
      <div className="flex items-center justify-between">
        <Link
          href="/suppliers"
          className="cursor-pointer text-sm text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
        >
          <span>← 返回供应商情报大厅</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/list"
            className="cursor-pointer text-xs text-slate-500 hover:text-primary transition-colors"
          >
            在标讯库中检索该单位全部公告 →
          </Link>
        </div>
      </div>

      {/* 头部 Hero 档案卡 */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md">
              <BuildingIcon className="h-7 w-7" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {profile.name}
                </h1>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  认证供应商档案
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                战绩跨度：{profile.firstWinDate} 至 {profile.latestWinDate} · 活跃周期约 {profile.activeDaysSpan} 天
              </p>

              {/* 智能能力与特征标签 */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-lg bg-blue-50/70 border border-blue-100 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <SupplierTrackButton
              supplierName={profile.name}
              initialIsWatched={profile.isWatched}
            />
            <span className="text-[11px] text-slate-400">
              加入雷达后，该对手有新中标将触发即时推送
            </span>
          </div>
        </div>

        {/* 关键核心战绩看板 */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-xs font-medium text-slate-500">历史中标次数</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tnum">
              {profile.winCount} <span className="text-xs font-normal text-slate-500">个标段</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <div className="text-xs font-medium text-amber-800">中标累计总额</div>
            <div className="mt-1 text-2xl font-bold text-amber-600 tnum">
              {profile.totalAwardWan > 0 ? (
                <>
                  ¥{profile.totalAwardWan.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-amber-700">万元</span>
                </>
              ) : (
                <span className="text-base text-slate-500">以各标段公布为准</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-xs font-medium text-slate-500">平均中标客单标的</div>
            <div className="mt-1 text-2xl font-bold text-slate-800 tnum">
              {profile.avgAwardWan > 0 ? (
                <>
                  ¥{profile.avgAwardWan.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">万元</span>
                </>
              ) : (
                "-"
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-xs font-medium text-slate-500">单笔最高斩获</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600 tnum">
              {profile.maxAwardWan > 0 ? (
                <>
                  ¥{profile.maxAwardWan.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">万元</span>
                </>
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 核心发包买方朋友圈 & 覆盖战区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：核心买方机构网络 */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <BuildingIcon className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">核心合作发包买方朋友圈</h2>
            </div>
            <span className="text-xs text-slate-400">
              按历史采购频次与发包金额综合加权
            </span>
          </div>

          <p className="text-xs text-slate-500">
            识别该竞争对手的核心政企金主网络，发现其在哪些招标人体系中具备高度黏性与先发优势。
          </p>

          <div className="space-y-3 pt-2">
            {profile.topPurchasers.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>{p.purchaser}</span>
                      {p.isLocked && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          <LockClosedIcon className="h-3 w-3" />
                          脱敏中
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      发包中标次数：{p.count} 次
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-slate-800 tnum">
                    {p.totalAwardWan > 0 ? `¥${p.totalAwardWan.toLocaleString()} 万` : "-"}
                  </div>
                  <div className="text-[11px] text-slate-400">贡献中标金额</div>
                </div>
              </div>
            ))}
          </div>

          {/* 免费版付费墙提示 */}
          {profile.lockedPurchasersCount > 0 && (
            <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong className="font-bold">更多核心金主已脱敏保护：</strong>
                <span>
                  当前账号为免费版，尚有 <strong>{profile.lockedPurchasersCount}</strong> 家买方机构被脱敏隐匿。
                </span>
              </div>
              <Link
                href="/pricing"
                className="cursor-pointer rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-2xs shrink-0"
              >
                升级白金会员解锁
              </Link>
            </div>
          )}
        </div>

        {/* 右侧：战区作战覆盖 */}
        <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <MapPinIcon className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900">核心作战省份与战区</h2>
          </div>

          <div className="space-y-3 pt-2">
            {profile.provinces.map((prov, pIdx) => (
              <div
                key={pIdx}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{prov.name}</span>
                  <span className="text-xs font-bold text-primary tnum">{prov.count} 次中标</span>
                </div>
                <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                  <span>战区斩获金额</span>
                  <span className="font-semibold text-slate-700 tnum">
                    {prov.awardWan > 0 ? `¥${prov.awardWan.toLocaleString()} 万元` : "以公告为准"}
                  </span>
                </div>
              </div>
            ))}

            {profile.provinces.length === 0 && (
              <div className="text-xs text-slate-400 py-6 text-center">暂无明确省份数据</div>
            )}
          </div>
        </div>
      </div>

      {/* 历史中标战绩清单 */}
      <div className="rounded-2xl border border-slate-200 bg-surface shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white">
              <TrophyIcon className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900">历史中标战绩清单</h2>
          </div>
          <span className="text-xs text-slate-500">
            共收录 {profile.winCount} 条中标记录 · 时间倒序排列
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/30 text-xs text-slate-500">
              <tr>
                <th className="px-6 py-3.5 font-medium">中标项目名称</th>
                <th className="px-6 py-3.5 font-medium text-right">中标金额 (万元)</th>
                <th className="px-6 py-3.5 font-medium">发包采购买方</th>
                <th className="px-6 py-3.5 font-medium">所属战区</th>
                <th className="px-6 py-3.5 font-medium">中标日期</th>
                <th className="px-6 py-3.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profile.recentTenders.map((t) => (
                <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4">
                    {t.isLocked ? (
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <LockClosedIcon className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>{t.title}</span>
                      </div>
                    ) : (
                      <Link
                        href={`/tender/${t.id}`}
                        className="cursor-pointer font-semibold text-slate-900 hover:text-primary transition-colors line-clamp-1"
                        title={t.title}
                      >
                        {t.title}
                      </Link>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-amber-600 tnum">
                    {t.isLocked
                      ? "******"
                      : t.awardAmountWan
                      ? `¥${t.awardAmountWan.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-700 max-w-xs truncate" title={t.purchaser ?? undefined}>
                    {t.purchaser || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{t.provinceName}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs tnum">{t.publishDate}</td>
                  <td className="px-6 py-4 text-right">
                    {t.isLocked ? (
                      <Link
                        href="/pricing"
                        className="cursor-pointer text-xs font-semibold text-amber-600 hover:underline"
                      >
                        解锁
                      </Link>
                    ) : (
                      <Link
                        href={`/tender/${t.id}`}
                        className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-strong"
                      >
                        <span>查看标讯</span>
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {profile.lockedTendersCount > 0 && (
          <div className="border-t border-slate-100 bg-amber-50/50 p-6 text-center space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-1">
              <LockClosedIcon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              尚有 {profile.lockedTendersCount} 条历史中标标段受会员特权保护
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              升级至白金会员或企业多席位版，即可无限穿透所有竞争对手历史成交价格、招标文件清单与核心项目联系人！
            </p>
            <div className="pt-2">
              <Link
                href="/pricing"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-strong transition-colors shadow-xs"
              >
                <span>立即升级会员 (¥799/年起)</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
