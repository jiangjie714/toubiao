import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPurchaserProfileAction } from "@/app/actions/purchaser";
import PurchaserTrackButton from "@/components/purchaser-track-button";
import { tenderTypeLabel, tenderTypeColor } from "@/lib/constants";
import {
  BuildingIcon,
  TrophyIcon,
  PhoneIcon,
  MapPinIcon,
  LockClosedIcon,
  ArrowRightIcon,
  ClipboardIcon,
  ShieldCheckIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return {
    title: `${decoded} - 采购买方发包全景与首选供应商图谱 - 标讯通`,
    description: `查看${decoded}的历史发包总预算、首选合作供应商圈子、常用招标代理机构与直联采购人联系电话`,
  };
}

export default async function PurchaserDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const user = await getSession();
  if (!user) {
    const { name } = await params;
    redirect(`/login?next=/purchasers/${encodeURIComponent(name)}`);
  }

  const { name } = await params;
  const purchaserName = decodeURIComponent(name);
  const result = await getPurchaserProfileAction(purchaserName);

  if (!result.success || !result.data) {
    notFound();
  }

  const profile = result.data;

  return (
    <div className="space-y-6">
      {/* 顶部返回导航 */}
      <div className="flex items-center justify-between">
        <Link
          href="/purchasers"
          className="cursor-pointer text-sm text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
        >
          <span>← 返回采购买方大厅</span>
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
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md">
              <BuildingIcon className="h-7 w-7" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {profile.name}
                </h1>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-primary">
                  认证采购买方档案
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                发包跨度：{profile.firstDate} 至 {profile.latestDate} · 活跃周期约 {profile.activeDaysSpan} 天
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
            <PurchaserTrackButton
              purchaserName={profile.name}
              initialIsWatched={profile.isWatched}
            />
            <span className="text-[11px] text-slate-400">
              关注后，该甲方有新招标公告将触发即时推送
            </span>
          </div>
        </div>

        {/* 关键核心发包看板 */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-xs font-medium text-slate-500">累计发包标讯数</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tnum">
              {profile.noticeCount} <span className="text-xs font-normal text-slate-500">标</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              招标中 {profile.noticeTenderCount} · 已成交 {profile.noticeResultCount}
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="text-xs font-medium text-primary">发包累计总预算</div>
            <div className="mt-1 text-2xl font-bold text-primary tnum">
              {profile.totalBudgetWan > 0 ? (
                <>
                  ¥{profile.totalBudgetWan.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-blue-700">万元</span>
                </>
              ) : (
                <span className="text-base text-slate-500">见具体标段</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              平均单标预算：{profile.avgBudgetWan > 0 ? `¥${profile.avgBudgetWan}万` : "-"}
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <div className="text-xs font-medium text-amber-800">实际中标成交金额</div>
            <div className="mt-1 text-2xl font-bold text-amber-600 tnum">
              {profile.totalAwardWan > 0 ? (
                <>
                  ¥{profile.totalAwardWan.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-amber-700">万元</span>
                </>
              ) : (
                "-"
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">已落地成交统计</div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-xs font-medium text-slate-500">平均发包节资率</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600 tnum">
              {profile.savingsRate !== null ? (
                <>
                  {profile.savingsRate}%
                </>
              ) : (
                <span className="text-base text-slate-400">合规招标</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">预算 vs 中标差额比</div>
          </div>
        </div>
      </div>

      {/* 核心首选供应商网络 & 代理机构 & 采购人联系方式 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：首选合作供应商朋友圈 & 直联采购人通讯 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 首选供应商圈子 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <TrophyIcon className="h-4 w-4" />
                </span>
                <h2 className="text-base font-bold text-slate-900">首选合作供应商圈子</h2>
              </div>
              <span className="text-xs text-slate-400">
                按历史中标频次与中标总额综合排序
              </span>
            </div>

            <p className="text-xs text-slate-500">
              洞察该采购单位历史最信赖的供应商名单，分析其是否具备长期战略合作或固定合作商圈子。
            </p>

            <div className="space-y-3 pt-2">
              {profile.preferredSuppliers.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-amber-50/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        {s.isLocked ? (
                          <span>{s.name}</span>
                        ) : (
                          <Link
                            href={`/suppliers/${encodeURIComponent(s.name)}`}
                            className="cursor-pointer hover:text-primary hover:underline transition-colors"
                          >
                            {s.name}
                          </Link>
                        )}
                        {s.isLocked && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <LockClosedIcon className="h-3 w-3" />
                            脱敏保护
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        在该单位中标次数：{s.count} 次
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-600 tnum">
                      {s.awardWan > 0 ? `¥${s.awardWan.toLocaleString()} 万` : "-"}
                    </div>
                    <div className="text-[11px] text-slate-400">已斩获金额</div>
                  </div>
                </div>
              ))}

              {profile.preferredSuppliers.length === 0 && (
                <div className="text-xs text-slate-400 py-6 text-center">
                  暂无已归档中标供应商（当前公告多为招标预告或处于评标中）
                </div>
              )}
            </div>

            {/* 免费版付费墙提示 */}
            {profile.lockedSuppliersCount > 0 && (
              <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong className="font-bold">更多首选供应商已脱敏保护：</strong>
                  <span>
                    当前账号为免费版，尚有 <strong>{profile.lockedSuppliersCount}</strong> 家深度合作供应商被隐匿。
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

          {/* 直连采购人档案与联络人图谱 */}
          {profile.contacts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <h2 className="text-base font-bold text-slate-900">直联采购人档案与联络图谱</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span>官方公告提取</span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {profile.contacts.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                        <span>{c.role}</span>
                        {c.isLocked && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                            <LockClosedIcon className="h-2.5 w-2.5" />
                            号码已脱敏
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-900 tnum flex items-center gap-2">
                        <span>{c.phone || "未留联系电话"}</span>
                        {!c.isLocked && c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="cursor-pointer text-xs font-medium text-primary hover:underline"
                          >
                            直拨
                          </a>
                        )}
                      </div>
                      {c.address && (
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPinIcon className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{c.address}</span>
                        </div>
                      )}
                    </div>

                    {c.isLocked && (
                      <Link
                        href="/pricing"
                        className="cursor-pointer text-xs font-semibold text-amber-700 hover:text-amber-800 underline"
                      >
                        升级解锁真实号码
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：常用代理机构 & 发包特征 */}
        <div className="space-y-6">
          {/* 常用代理机构 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <ClipboardIcon className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">常用招标代理机构</h2>
            </div>
            <p className="text-xs text-slate-500">
              分析该甲方经常委托的代理机构，有助于提前获知项目筹备进展。
            </p>

            <div className="space-y-3 pt-2">
              {profile.preferredAgencies.map((agency, aIdx) => (
                <div
                  key={aIdx}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
                      {aIdx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 line-clamp-1" title={agency.name}>
                      {agency.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-primary tnum shrink-0 ml-2">
                    {agency.count} 次代理
                  </span>
                </div>
              ))}

              {profile.preferredAgencies.length === 0 && (
                <div className="text-xs text-slate-400 py-6 text-center">多为业主自行组织采购</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 历史发包公告清单 */}
      <div className="rounded-2xl border border-slate-200 bg-surface shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BuildingIcon className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900">历史发包公告清单</h2>
          </div>
          <span className="text-xs text-slate-500">
            共收录 {profile.noticeCount} 条发包标讯 · 时间倒序排列
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/30 text-xs text-slate-500">
              <tr>
                <th className="px-6 py-3.5 font-medium">项目名称</th>
                <th className="px-6 py-3.5 font-medium">类型</th>
                <th className="px-6 py-3.5 font-medium text-right">预算金额 (万元)</th>
                <th className="px-6 py-3.5 font-medium text-right">中标金额 (万元)</th>
                <th className="px-6 py-3.5 font-medium">中标供应商</th>
                <th className="px-6 py-3.5 font-medium">发布日期</th>
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
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tenderTypeColor(
                        t.type
                      )}`}
                    >
                      {tenderTypeLabel(t.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-blue-700 tnum">
                    {t.isLocked
                      ? "******"
                      : t.budgetAmountWan
                      ? `¥${t.budgetAmountWan.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-amber-600 tnum">
                    {t.isLocked
                      ? "******"
                      : t.awardAmountWan
                      ? `¥${t.awardAmountWan.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-700 max-w-xs truncate">
                    {t.winningSupplier ? (
                      t.isLocked ? (
                        <span>{t.winningSupplier}</span>
                      ) : (
                        <Link
                          href={`/suppliers/${encodeURIComponent(t.winningSupplier)}`}
                          className="cursor-pointer hover:text-primary hover:underline transition-colors"
                        >
                          {t.winningSupplier}
                        </Link>
                      )
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
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
              尚有 {profile.lockedTendersCount} 条该买方的历史招标与中标记录受会员特权保护
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              升级至白金会员或企业多席位版，即可无限穿透所有甲方的历史预算金额、中标成交价格与直达联系人！
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
