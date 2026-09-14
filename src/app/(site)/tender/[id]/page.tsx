import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { tenderTypeLabel, tenderTypeColor, formatDate } from "@/lib/constants";
import { parseTenderSections, type SectionKind } from "@/lib/tender-sections";
import { TenderRichContent } from "@/components/tender-rich-content";
import TenderFeedbackButton from "@/components/tender-feedback-button";
import { TenderAiCard } from "@/components/tender-ai-card";
import { TenderFollowButton } from "@/components/tender-follow-button";
import { getProjectTimeline } from "@/lib/project-timeline";
import TenderProjectTimeline from "@/components/tender-project-timeline";
import TenderContactsCard from "@/components/tender-contacts-card";
import TenderAttachmentsCard from "@/components/tender-attachments-card";
import TenderExportActions from "@/components/tender-export-actions";
import TenderWinnerCard from "@/components/tender-winner-card";
import TenderCompareButton from "@/components/tender-compare-button";
import TenderCompareTray from "@/components/tender-compare-tray";
import TenderComplianceButton from "@/components/tender-compliance-button";
import { TenderPricingCompassButton } from "@/components/bidding-pricing-compass";
import { TenderProposalOutlineButton } from "@/components/tender-proposal-outline";
import { TenderCaseMatchButton } from "@/components/tender-case-match";
import {
  ExternalLinkIcon,
  CalendarIcon,
  ClockIcon,
  BuildingIcon,
  PhoneIcon,
  ClipboardIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  BriefcaseIcon,
  ChartBarIcon,
  MapPinIcon,
} from "@/components/icons";
import { INDUSTRY_META } from "@/lib/industry";

const KIND_ICONS: Record<SectionKind, React.ComponentType<{ className?: string }>> = {
  project: BuildingIcon,
  requirement: ShieldCheckIcon,
  time: ClockIcon,
  contact: PhoneIcon,
  misc: ClipboardIcon,
};

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenderId = parseInt(id, 10) || -1;
  const [tender, timeline] = await Promise.all([
    prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        orgContacts: {
          select: {
            id: true,
            orgName: true,
            role: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        attachments: {
          select: {
            id: true,
            name: true,
            sourceUrl: true,
            contentType: true,
            size: true,
            status: true,
          },
        },
      },
    }),
    getProjectTimeline(tenderId),
  ]);
  if (!tender) notFound();

  const province = tender.provinceCode
    ? await prisma.region.findFirst({
        where: { code: tender.provinceCode, level: 1 },
        select: { name: true },
      })
    : null;
  const provinceName = province?.name ?? null;

  const user = await getSession();
  const entitlement = user ? await getEntitlement(user.uid) : null;
  const canViewFullText = entitlement?.features.fullText ?? false;
  const canViewContacts = entitlement?.features.contacts ?? false;
  const canViewAttachments = entitlement?.features.attachments ?? false;
  const planName = entitlement?.planName ?? "免费版";

  const sections = parseTenderSections(
    canViewFullText ? tender.content : `${tender.content.slice(0, 300)}…`,
    tender.sourceUrl ?? undefined,
  );
  const facts = [
    { label: "发布日期", value: formatDate(tender.publishDate), Icon: CalendarIcon },
    {
      label: "截止时间",
      value: tender.expireDate ? formatDate(tender.expireDate) : null,
      Icon: ClockIcon,
    },
    {
      label: "采购人/招标人",
      value: tender.purchaser,
      Icon: BuildingIcon,
      href: tender.purchaser ? `/purchasers/${encodeURIComponent(tender.purchaser)}` : undefined,
    },
    { label: "代理机构", value: tender.agency, Icon: ClipboardIcon },
    {
      label: "所属项目",
      value: tender.projectNo ? `${tender.projectNo}` : (timeline.projectId ? "查看生命周期" : null),
      Icon: BriefcaseIcon,
      href: timeline.projectId ? `/projects/${timeline.projectId}` : undefined,
    },
    {
      label: "垂直赛道",
      value: tender.industryCode && INDUSTRY_META[tender.industryCode] ? INDUSTRY_META[tender.industryCode].name : null,
      Icon: ChartBarIcon,
      href: tender.industryCode ? `/industries/${tender.industryCode}` : undefined,
    },
    {
      label: "行政战区",
      value: provinceName,
      Icon: MapPinIcon,
      href: tender.provinceCode ? `/regions/${tender.provinceCode}` : undefined,
    },
  ].filter((f) => f.value);

  const isWatchedSupplier = user && tender.winningSupplier
    ? (await prisma.pushWatch.count({
        where: { userId: user.uid, keyword: tender.winningSupplier.trim(), enabled: true },
      })) > 0
    : false;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 顶部导航与操作控制台 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/list"
          className="cursor-pointer text-sm text-slate-500 transition-colors duration-150 hover:text-primary print:hidden"
        >
          ← 返回列表
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <TenderExportActions tenderId={tender.id} canExport={canViewFullText} />
          <div className="flex items-center gap-2 print:hidden">
            <TenderCompareButton
              tender={{
                id: tender.id,
                title: tender.title,
                type: tender.type,
                budgetAmount: tender.budgetAmount ? Number(tender.budgetAmount) : null,
              }}
              variant="detail"
            />
            <TenderPricingCompassButton tenderId={tender.id} />
            <TenderProposalOutlineButton tenderId={tender.id} />
            <TenderCaseMatchButton tenderId={tender.id} />
            <TenderComplianceButton tenderId={tender.id} />
            <TenderFollowButton tenderId={tender.id} />
            <TenderFeedbackButton tenderId={tender.id} />
          </div>
        </div>
      </div>

      {timeline.hasMultipleNotices && (
        <div className="print:hidden">
          <TenderProjectTimeline data={timeline} />
        </div>
      )}

      {/* 商业化核心模块：中标结果与供应商穿透透视 */}
      {tender.winningSupplier && (
        <div className="print:break-inside-avoid">
          <TenderWinnerCard
            tenderId={tender.id}
            winningSupplier={tender.winningSupplier}
            awardAmountWan={tender.awardAmount ? Number(tender.awardAmount) : null}
            purchaser={tender.purchaser}
            initialIsWatched={isWatchedSupplier}
            canViewIntelligence={entitlement?.planCode !== "FREE"}
            planName={planName}
          />
        </div>
      )}

      {/* 公告主体 */}
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs print:border-none print:shadow-none">
        {/* 头部：类型 + 行业 + 标题 */}
        <header className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 to-transparent px-7 py-6 print:bg-none print:px-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tenderTypeColor(tender.type)} print:border print:border-slate-300`}
            >
              {tenderTypeLabel(tender.type)}
            </span>
            {tender.industryCode && INDUSTRY_META[tender.industryCode] && (
              <Link
                href={`/industries/${tender.industryCode}`}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 transition hover:bg-blue-100"
                title="查看该垂直赛道招投标宏观大盘与金主标王榜单"
              >
                <ChartBarIcon className="h-3 w-3" />
                <span>{INDUSTRY_META[tender.industryCode].name}</span>
                <span className="text-[10px] text-blue-500">赛道大盘 →</span>
              </Link>
            )}
            {provinceName && tender.provinceCode && (
              <Link
                href={`/regions/${tender.provinceCode}`}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50/80 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 transition hover:bg-emerald-100"
                title={`查看${provinceName}招投标区域作战大盘与金主标王`}
              >
                <MapPinIcon className="h-3 w-3" />
                <span>{provinceName}</span>
                <span className="text-[10px] text-emerald-500">区域大盘 →</span>
              </Link>
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold leading-relaxed tracking-tight text-slate-900">
            {tender.title}
          </h1>
        </header>

        {/* 关键事实带：何时截止、谁在采购，一眼可扫 */}
        {facts.length > 0 && (
          <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 md:grid-cols-4 print:border print:border-slate-200">
            {facts.map((f) => (
              <div key={f.label} className="bg-slate-50/70 px-6 py-4 print:bg-white print:p-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <f.Icon className="h-3.5 w-3.5" />
                  {f.label}
                </div>
                {f.href ? (
                  <Link
                    href={f.href}
                    className="mt-1.5 block truncate text-sm font-semibold text-primary hover:underline tnum"
                    title={`${f.value}（点击穿透查看买方发包全貌与首选供应商）`}
                  >
                    {f.value}
                  </Link>
                ) : (
                  <div
                    className="mt-1.5 truncate text-sm font-semibold text-slate-800 tnum"
                    title={f.value ?? undefined}
                  >
                    {f.value}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AI 智能标书速读与投标风险雷达 */}
        <div className="border-b border-slate-100 bg-slate-50/30 px-7 pt-6 pb-2 print:bg-white print:px-0">
          <TenderAiCard tenderId={tender.id} />
        </div>

        {/* 正文：按公告结构分类展示 */}
        <div className="divide-y divide-slate-100">
          {sections.map((s, i) => {
            const Icon = KIND_ICONS[s.kind];
            return (
              <section key={`${s.kind}-${i}`} className="px-7 py-6 print:px-0 print:py-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary print:hidden">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-semibold text-slate-900">{s.title}</h2>
                </div>
                <TenderRichContent blocks={s.blocks} />
              </section>
            );
          })}
        </div>

        {!canViewFullText && (
          <div className="border-t border-slate-100 bg-amber-50/60 px-7 py-6 print:hidden">
            <h2 className="text-sm font-bold text-slate-900">升级后查看完整公告</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              免费版仅提供标题与摘要。升级黄金会员可查看正文全文；铂金会员还可查看联系方式与附件。
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
            >
              查看套餐并升级
            </Link>
          </div>
        )}

        {/* 出处 */}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-7 py-4 text-xs text-slate-500 print:px-0">
          <span className="flex items-center gap-1.5">
            <DatabaseIcon className="h-3.5 w-3.5" />
            {tender.sourceName}
          </span>
          {tender.sourceUrl && (
            <a
              href={tender.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 text-accent transition-colors duration-150 hover:text-primary hover:underline print:hidden"
            >
              查看原文
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </footer>
      </article>

      {/* 商业化特权模块 1：机构联络人图谱 */}
      {tender.orgContacts && tender.orgContacts.length > 0 && (
        <div className="print:break-inside-avoid">
          <TenderContactsCard
            contacts={tender.orgContacts}
            canViewContacts={canViewContacts}
            planName={planName}
          />
        </div>
      )}

      {/* 商业化特权模块 2：标书附件与采购清单安全存管中心 */}
      {tender.attachments && tender.attachments.length > 0 && (
        <div className="print:break-inside-avoid">
          <TenderAttachmentsCard
            tenderId={tender.id}
            attachments={tender.attachments}
            canViewAttachments={canViewAttachments}
            planName={planName}
          />
        </div>
      )}

      <TenderCompareTray />
    </div>
  );
}
