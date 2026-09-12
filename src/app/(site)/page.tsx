import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  TENDER_TYPES,
  tenderTypeLabel,
  tenderTypeColor,
  formatDate,
} from "@/lib/constants";
import {
  SearchIcon,
  MegaphoneIcon,
  TrophyIcon,
  ArrowsRightLeftIcon,
  ChatBubbleIcon,
  ArrowRightIcon,
  MapPinIcon,
  BoltIcon,
} from "@/components/icons";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTICE: MegaphoneIcon,
  RESULT: TrophyIcon,
  CHANGE: ArrowsRightLeftIcon,
  INQUIRY: ChatBubbleIcon,
};

export default async function HomePage() {
  const [latest, byType, provinces, byProvince] = await Promise.all([
    prisma.tender.findMany({ orderBy: { publishDate: "desc" }, take: 10 }),
    prisma.tender.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.region.findMany({ where: { level: 1 }, orderBy: { code: "asc" } }),
    prisma.tender.groupBy({ by: ["provinceCode"], _count: { _all: true } }),
  ]);
  const countOf = (t: string) => byType.find((x) => x.type === t)?._count._all ?? 0;
  const countByProvince = new Map(
    byProvince.filter((x) => x.provinceCode).map((x) => [x.provinceCode!, x._count._all]),
  );
  const regionChips = provinces
    .map((p) => ({
      ...p,
      count: countByProvince.get(p.code) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-10">
      {/* Hero：分层光晕 + 数据跑马灯 */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-strong via-primary to-accent px-6 py-14 text-center">
        <div className="pointer-events-none absolute -top-28 right-8 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-6 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight text-white">招投标信息 · 一站检索</h1>
          <p className="mt-3 text-sm text-blue-100">
            招标 · 中标 · 变更更正 · 询价竞谈，覆盖全国公开渠道，每日更新
          </p>
          <form action="/list" method="get" className="mx-auto mt-8 flex max-w-2xl gap-3">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                name="q"
                placeholder="输入项目名称、单位名称等关键字"
                className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm text-slate-900 shadow-lg outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-highlight"
              />
            </div>
            <button
              type="submit"
              className="h-12 cursor-pointer rounded-xl bg-highlight px-7 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-600"
            >
              搜索
            </button>
          </form>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            {TENDER_TYPES.map((t) => (
              <Link
                key={t.value}
                href={`/list?type=${t.value}`}
                className="cursor-pointer rounded-full border border-white/30 px-3.5 py-1.5 text-blue-50 transition-colors duration-200 hover:border-white/60 hover:bg-white/10"
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* 最新公告跑马灯（悬停暂停，reduced-motion 时静态） */}
          {latest.length > 0 && (
            <div className="ticker relative mt-7 overflow-hidden rounded-xl border border-white/15 bg-white/10 [mask-image:linear-gradient(to_right,transparent,black_44px,black_calc(100%-36px),transparent)]">
              <span className="absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 bg-primary-strong/90 px-3.5 text-xs font-semibold text-blue-100">
                <BoltIcon className="h-3.5 w-3.5 text-highlight" />
                最新
              </span>
              <div className="ticker-track flex w-max items-center gap-9 py-2.5 pl-16">
                {[...latest, ...latest].map((t, i) => (
                  <Link
                    key={`${t.id}-${i}`}
                    href={`/tender/${t.id}`}
                    className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-blue-100 transition-colors duration-150 hover:text-white"
                  >
                    <span className="tnum text-blue-200/90">{formatDate(t.publishDate).slice(5)}</span>
                    <span className="max-w-[300px] truncate">{t.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 类型分段带：单卡分段，非同质卡片网格 */}
      <section className="grid grid-cols-2 divide-slate-100 rounded-xl border border-slate-200 bg-surface md:grid-cols-4 md:divide-x">
        {TENDER_TYPES.map((t, i) => {
          const Icon = TYPE_ICONS[t.value] ?? MegaphoneIcon;
          return (
            <Link
              key={t.value}
              href={`/list?type=${t.value}`}
              className={`group flex cursor-pointer items-center gap-3.5 px-5 py-4 transition-colors duration-200 hover:bg-blue-50/50 ${
                i % 2 === 1 ? "max-md:border-l max-md:border-slate-100" : ""
              } ${i >= 2 ? "max-md:border-t max-md:border-slate-100" : ""}`}
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors duration-200 ${tenderTypeColor(t.value)}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-bold text-slate-900 tnum leading-6">
                  {countOf(t.value)}
                </span>
                <span className="block text-xs text-slate-500">{t.label}</span>
              </span>
              <ArrowRightIcon className="ml-auto hidden h-4 w-4 shrink-0 text-slate-300 transition-colors duration-200 group-hover:text-accent md:block" />
            </Link>
          );
        })}
      </section>

      {/* 最新公告 + 地区侧栏 */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">最新公告</h2>
            <Link
              href="/list"
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-accent transition-colors duration-200 hover:text-primary"
            >
              查看全部
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-surface">
            {latest.map((t) => (
              <li key={t.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tenderTypeColor(t.type)}`}
                  >
                    {tenderTypeLabel(t.type)}
                  </span>
                  <Link
                    href={`/tender/${t.id}`}
                    className="flex-1 cursor-pointer truncate text-sm text-slate-800 transition-colors duration-150 hover:text-primary"
                  >
                    {t.title}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500 tnum">
                    {formatDate(t.publishDate)}
                  </span>
                </div>
              </li>
            ))}
            {latest.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-slate-500">
                暂无数据，可先在后台触发抓取
              </li>
            )}
          </ul>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-amber-100/50 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                <TrophyIcon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">标讯通会员特权</h3>
                <p className="text-[11px] text-slate-500">升级套餐 解锁商业新商机</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                无限次搜索与公告正文全文
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                采购单位联系人与预算金额
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                标书附件下载与 Excel 批量导出
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                关键词订阅与每日早报送达
              </li>
            </ul>
            <Link
              href="/pricing"
              className="mt-4 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-amber-700"
            >
              查看会员套餐与特权
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <MapPinIcon className="h-4 w-4 text-accent" />
              按地区浏览
            </h2>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-surface p-4">
              {regionChips.map((p) => (
                <Link
                  key={p.code}
                  href={`/list?province=${p.code}`}
                  className="cursor-pointer rounded-lg border border-slate-100 bg-canvas px-2.5 py-1 text-xs text-slate-600 transition-colors duration-200 hover:border-accent/60 hover:bg-blue-50 hover:text-primary"
                >
                  {p.name.replace(/(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/, "")}
                  {p.count > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400 tnum">{p.count}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
