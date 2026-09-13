import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { getProjectDetail, projectStageBadgeColor } from "@/lib/project";
import ProjectTrackButton from "@/components/project-track-button";
import {
  MapPinIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  PhoneIcon,
  MailIcon,
  CheckIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return { title: "项目未找到 - 标讯通" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { canonicalTitle: true, projectNo: true },
  });

  if (!project) return { title: "项目未找到 - 标讯通" };

  return {
    title: `【全生命周期穿透】${project.canonicalTitle} - 标讯通`,
    description: `项目编号：${project.projectNo || "无"}，全链路穿透意向预告、招标申报、答疑更正与中标成交详情`,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) {
    const { id } = await params;
    redirect(`/login?next=/projects/${id}`);
  }

  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) {
    notFound();
  }

  const entitlement = await getEntitlement(user.uid);
  const dbUser = await prisma.user.findUnique({
    where: { id: user.uid },
    select: { teamMembership: { select: { teamId: true } } },
  });

  const project = await getProjectDetail(projectId, {
    id: user.uid,
    role: user.role,
    planCode: entitlement.planCode,
    teamId: dbUser?.teamMembership?.teamId ?? null,
  });

  if (!project) {
    notFound();
  }

  const stageBadgeClass = projectStageBadgeColor(project.stage);

  return (
    <div className="space-y-6">
      {/* 顶部面包屑导航 */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-primary transition-colors">
          首页
        </Link>
        <span>/</span>
        <Link href="/projects" className="hover:text-primary transition-colors">
          项目大盘
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate max-w-md">
          {project.projectNo || project.displayTitle}
        </span>
      </nav>

      {/* 项目头部 Header */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold border ${stageBadgeClass}`}
              >
                {project.stageLabel}
              </span>

              {project.projectNo && (
                <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
                  项目编号: {project.projectNo}
                </span>
              )}

              {project.provinceName && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>{project.provinceName}</span>
                </span>
              )}

              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 border border-indigo-100"
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
              {project.displayTitle}
            </h1>

            <p className="text-xs text-slate-500">
              全链路生命周期追踪系统已自动归集该项目各个阶段官方推进公报，实时监控澄清变更与中标结果。
            </p>
          </div>

          {/* 右侧操作区 */}
          <div className="flex flex-wrap items-center gap-3">
            <ProjectTrackButton
              projectId={project.id}
              initialIsWatched={project.isWatched}
            />
            <Link
              href="/projects"
              className="cursor-pointer rounded-xl border border-slate-200 bg-surface px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              返回项目大盘
            </Link>
          </div>
        </div>

        {/* 4 项核心财务指标看板 */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-5">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">采购预算总额</div>
            <div className="text-xl font-bold text-blue-700 font-mono tnum">
              {project.budgetAmountWan ? (
                <>
                  {project.budgetAmountWan.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-blue-600">万元</span>
                </>
              ) : (
                <span className="text-sm font-normal text-slate-400">未公示金额</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">最终中标金额</div>
            <div className="text-xl font-bold text-emerald-700 font-mono tnum">
              {project.awardAmountWan ? (
                <>
                  {project.awardAmountWan.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-emerald-600">万元</span>
                </>
              ) : project.stage === "AWARDED" && !project.isPremium ? (
                <span className="text-sm font-normal text-slate-400">*** 万元 (会员可见)</span>
              ) : (
                <span className="text-sm font-normal text-slate-400">推进中 / 待开标</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">节约资金 / 节资率</div>
            <div className="text-xl font-bold text-indigo-700 font-mono tnum">
              {project.savingsWan && project.isPremium ? (
                <>
                  {project.savingsWan}
                  <span className="ml-0.5 text-xs font-normal text-indigo-600">万元</span>
                  <span className="ml-1 text-xs font-semibold text-emerald-600">
                    ({project.savingsRate}%)
                  </span>
                </>
              ) : project.stage === "AWARDED" && !project.isPremium ? (
                <span className="text-sm font-normal text-slate-400">*** 万元 (脱敏)</span>
              ) : (
                <span className="text-sm font-normal text-slate-400">-</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">全周期推进公告</div>
            <div className="text-xl font-bold text-slate-800 font-mono tnum">
              {project.timeline.length}
              <span className="ml-1 text-xs font-normal text-slate-500">篇公报</span>
            </div>
          </div>
        </div>
      </div>

      {/* 两栏主体布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：全生命周期时间轴（占据 8 列） */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-base font-bold text-slate-900">
                  全生命周期推进时间轴 (Lifecycle Timeline)
                </h2>
              </div>
              <span className="text-xs text-slate-500">按发布时间顺序编排</span>
            </div>

            <div className="mt-6 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              <div className="space-y-8">
                {project.timeline.map((node) => {
                  return (
                    <div key={node.id} className="relative group">
                      {/* 时间轴圆点 */}
                      <div
                        className={`absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-surface transition-colors ${
                          node.isLocked
                            ? "border-slate-300 text-slate-400"
                            : "border-primary text-primary shadow-xs"
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${
                            node.isLocked ? "bg-slate-300" : "bg-primary"
                          }`}
                        />
                      </div>

                      {/* 节点卡片 */}
                      <div
                        className={`rounded-xl border p-4.5 transition-all ${
                          node.isLocked
                            ? "border-slate-200 bg-slate-50/50 opacity-80"
                            : "border-slate-200 bg-surface hover:border-slate-300 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${node.typeColor}`}
                            >
                              {node.typeLabel}
                            </span>
                            <span className="text-xs font-medium text-slate-500 font-mono">
                              {node.publishDate}
                            </span>
                          </div>

                          {!node.isLocked && (
                            <Link
                              href={`/tender/${node.id}`}
                              className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <span>查看原公告详情</span>
                              <ArrowRightIcon className="h-3 w-3" />
                            </Link>
                          )}
                        </div>

                        <h3 className="mt-2 text-sm font-bold text-slate-900">
                          {node.isLocked ? (
                            <span className="text-slate-500">{node.title}</span>
                          ) : (
                            <Link
                              href={`/tender/${node.id}`}
                              className="hover:text-primary transition-colors"
                            >
                              {node.title}
                            </Link>
                          )}
                        </h3>

                        {/* 摘要与指标 */}
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {node.summary}
                        </p>

                        {!node.isLocked && (
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                            {node.budgetAmountWan && (
                              <div>
                                预算:{" "}
                                <span className="font-semibold text-blue-700 font-mono">
                                  {node.budgetAmountWan} 万元
                                </span>
                              </div>
                            )}
                            {node.awardAmountWan && (
                              <div>
                                中标价:{" "}
                                <span className="font-semibold text-emerald-700 font-mono">
                                  {node.awardAmountWan} 万元
                                </span>
                              </div>
                            )}
                            {node.winningSupplier && (
                              <div>
                                中标人:{" "}
                                <Link
                                  href={`/suppliers/${encodeURIComponent(node.winningSupplier)}`}
                                  className="font-semibold text-emerald-700 hover:underline"
                                >
                                  {node.winningSupplier}
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 免费版脱敏付费墙卡片 */}
            {project.lockedTimelineCount > 0 && (
              <div className="mt-8 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                    <ShieldCheckIcon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-950">
                      解锁该项目全周期剩余 {project.lockedTimelineCount} 篇推进公报
                    </h3>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      当前为免费体验模式，部分澄清答疑细节、评审得分、最终成交金额与中标合同明细仅对白金版/企业版会员开放。
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/pricing"
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
                      >
                        <span>升级白金会员立即穿透全部节点</span>
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：主体网络与采购人通讯录（占据 4 列） */}
        <div className="lg:col-span-4 space-y-6">
          {/* 项目核心主体关系透视 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              项目核心关联主体
            </h3>

            {/* 采购人 */}
            <div className="space-y-1">
              <div className="text-xs text-slate-400">采购人 (发包甲方)</div>
              {project.purchaser ? (
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {project.purchaser}
                  </div>
                  <Link
                    href={`/purchasers/${encodeURIComponent(project.purchaser)}`}
                    className="cursor-pointer mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>查看买方发包 360° 画像</span>
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-slate-400">未公示采购人</div>
              )}
            </div>

            {/* 代理机构 */}
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <div className="text-xs text-slate-400">招标代理机构</div>
              <div className="font-medium text-slate-800 text-sm">
                {project.agency || "采购人自行组织招标"}
              </div>
            </div>

            {/* 中标供应商 */}
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <div className="text-xs text-slate-400">中标成交商</div>
              {project.winningSupplier ? (
                <div>
                  <div className="font-semibold text-emerald-800 text-sm">
                    {project.winningSupplier}
                  </div>
                  <Link
                    href={`/suppliers/${encodeURIComponent(project.winningSupplier)}`}
                    className="cursor-pointer mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    <span>穿透该企业历史战绩与竞对画像</span>
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-slate-400">尚未公布中标结果</div>
              )}
            </div>
          </div>

          {/* 直连采购人通讯录 */}
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                直连采购人通讯录
              </h3>
              <span className="text-[11px] text-slate-400">官方认证联络渠道</span>
            </div>

            {project.contacts.length === 0 ? (
              <div className="text-xs text-slate-500 py-3 text-center">
                暂未从官方公告正文中提取到联络方式
              </div>
            ) : (
              <div className="space-y-3">
                {project.contacts.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-1.5 text-xs"
                  >
                    <div className="font-semibold text-slate-800">{c.role}</div>
                    {c.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <PhoneIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{c.phone}</span>
                        {c.isLocked && (
                          <span className="rounded bg-amber-100 px-1 py-0.2 text-[10px] text-amber-800">
                            脱敏保护
                          </span>
                        )}
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MailIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{c.email}</span>
                      </div>
                    )}
                    {c.address && (
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <MapPinIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    )}
                  </div>
                ))}

                {!project.isPremium && (
                  <div className="text-[11px] text-slate-500 text-center pt-1">
                    <Link href="/pricing" className="text-primary hover:underline">
                      升级白金版会员
                    </Link>{" "}
                    可解锁采购人明文真实手机号与座机
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 实时雷达推送说明卡片 */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-indigo-950">
              <CheckIcon className="h-4 w-4 text-indigo-600" />
              <span>多通道实时雷达已就绪</span>
            </div>
            <p className="text-indigo-800 leading-relaxed">
              点击上方【跟踪项目全周期动态】，系统将持续监测中国政府采购网与全国公共资源交易平台；该项目后续若发生更正答疑、流标或公布中标，将在 10 分钟内向您的企业微信、钉钉或飞书群聊推送提醒。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
