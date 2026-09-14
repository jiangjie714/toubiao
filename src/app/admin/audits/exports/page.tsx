import { prisma } from "@/lib/prisma";
import {
  ClipboardIcon,
  BoltIcon,
  UsersIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ArrowDownTrayIcon,
} from "@/components/icons";

export const metadata = { title: "商机导出风控审计" };

function formatFilterBadges(filters: Record<string, unknown>, industryMap: Map<string, string>) {
  const badges: { label: string; value: string; highlight?: boolean }[] = [];

  if (filters.keyword) {
    badges.push({ label: "关键词", value: String(filters.keyword), highlight: true });
  }
  if (filters.type) {
    const typeLabel =
      filters.type === "NOTICE"
        ? "招标公告"
        : filters.type === "INTENTION"
        ? "采购意向"
        : filters.type === "RESULT"
        ? "中标结果"
        : filters.type === "CHANGE"
        ? "变更答疑"
        : String(filters.type);
    badges.push({ label: "标讯类型", value: typeLabel });
  }
  if (filters.industryCode) {
    const indName = industryMap.get(String(filters.industryCode)) ?? String(filters.industryCode);
    badges.push({ label: "行业分类", value: indName });
  }
  if (filters.minBudget || filters.maxBudget) {
    const min = filters.minBudget ? `≥${filters.minBudget}万` : "";
    const max = filters.maxBudget ? `≤${filters.maxBudget}万` : "";
    badges.push({ label: "预算范围", value: `${min}${min && max ? " ~ " : ""}${max}` });
  }
  if (filters.hasAttachment) {
    badges.push({ label: "标书附件", value: "仅含附件", highlight: true });
  }
  if (filters.province || filters.city) {
    const region = [filters.province, filters.city].filter(Boolean).join(" / ");
    badges.push({ label: "地域范围", value: region });
  }
  if (filters.startDate || filters.endDate) {
    const dateRange = [filters.startDate, filters.endDate].filter(Boolean).join(" 至 ");
    badges.push({ label: "发布时间", value: dateRange });
  }

  return badges;
}

export default async function ExportAuditPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, sensitiveCount, activeUsers, industries, audits] = await Promise.all([
    prisma.exportAudit.count(),
    prisma.exportAudit.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.exportAudit.count({
      where: { filters: { path: ["exportedSensitiveContacts"], equals: true } },
    }),
    prisma.user.count({ where: { exportAudits: { some: {} } } }),
    prisma.industryDict.findMany({ select: { code: true, name: true } }),
    prisma.exportAudit.findMany({
      include: {
        user: {
          select: {
            name: true,
            username: true,
            role: true,
            subscription: {
              select: {
                plan: {
                  select: { name: true, code: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const industryMap = new Map(industries.map((ind) => [ind.code, ind.name]));

  const cards = [
    { label: "累计导出记录", value: total, unit: "次", Icon: ClipboardIcon, tone: "bg-blue-50 text-blue-700" },
    { label: "今日导出频次", value: today, unit: "次", Icon: BoltIcon, tone: "bg-emerald-50 text-emerald-600" },
    {
      label: "敏感信息明文导出",
      value: sensitiveCount,
      unit: "次",
      Icon: ShieldAlertIcon,
      tone: "bg-amber-50 text-amber-600",
    },
    { label: "活跃导出客户数", value: activeUsers, unit: "人", Icon: UsersIcon, tone: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">商机批量导出与风控审计</h1>
          <p className="mt-1 text-sm text-slate-500">
            监控全平台企业客户数据导出轨迹、行业组合筛选条件与敏感联系人明文合规审计
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-5 shadow-xs">
            <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.tone}`}>
              <card.Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold leading-7 text-slate-900 tnum">{card.value}</span>
                <span className="text-xs text-slate-400">{card.unit}</span>
              </div>
              <div className="text-xs text-slate-500">{card.label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ArrowDownTrayIcon className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">最新导出轨迹 (最近 50 条)</span>
          </div>
          <span className="text-xs text-slate-400">实时审计流</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">操作客户</th>
                <th className="px-5 py-3 font-medium">筛选画像与条件</th>
                <th className="px-5 py-3 font-medium">命中 / 导出量</th>
                <th className="px-5 py-3 font-medium">合规与风控等级</th>
                <th className="px-5 py-3 font-medium">客户端环境</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audits.map((audit) => {
                const filterObj = (audit.filters || {}) as Record<string, unknown>;
                const badges = formatFilterBadges(filterObj, industryMap);
                const isSensitive = filterObj.exportedSensitiveContacts === true;
                const isHighVolume = audit.exportedCount >= 200;
                const format = String(filterObj.format || "xlsx").toUpperCase();

                return (
                  <tr key={audit.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 tnum">
                      {audit.createdAt.toLocaleString("zh-CN")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span>{audit.user.name}</span>
                        {audit.user.role === "ADMIN" && (
                          <span className="rounded bg-rose-50 px-1 py-0.2 text-[10px] font-semibold text-rose-600">
                            管理员
                          </span>
                        )}
                        {audit.user.subscription?.plan && audit.user.subscription.plan.code !== "FREE" && (
                          <span className="rounded bg-blue-50 px-1 py-0.2 text-[10px] font-semibold text-blue-600">
                            {audit.user.subscription.plan.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{audit.user.username}</div>
                    </td>
                    <td className="max-w-[340px] px-5 py-3.5">
                      {badges.length === 0 ? (
                        <span className="text-xs text-slate-400">全库范围导出</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {badges.map((b, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
                                b.highlight
                                  ? "bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <span className="text-slate-400">{b.label}:</span>
                              <span>{b.value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-700 tnum">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>{audit.exportedCount}</span>
                        <span className="text-xs font-normal text-slate-400">/ 匹配 {audit.matchedCount}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600 font-semibold">
                          {format}
                        </span>

                        {isSensitive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/30">
                            <ShieldAlertIcon className="h-3.5 w-3.5 text-amber-600" />
                            明文联系人
                          </span>
                        )}

                        {isHighVolume && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/30">
                            批量大额 (≥200)
                          </span>
                        )}

                        {!isSensitive && !isHighVolume && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                            常规合规
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[200px] px-5 py-3.5">
                      <div className="truncate text-xs font-mono text-slate-600" title={audit.ip ?? "-"}>
                        {audit.ip ?? "-"}
                      </div>
                      <div className="truncate text-[11px] text-slate-400" title={audit.userAgent ?? "-"}>
                        {audit.userAgent ?? "-"}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {audits.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                    暂无导出审计记录
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
