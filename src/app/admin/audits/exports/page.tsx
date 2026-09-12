import { prisma } from "@/lib/prisma";
import { ClipboardIcon, BoltIcon, UsersIcon, ChartBarIcon } from "@/components/icons";

export const metadata = { title: "导出审计" };

function filterSummary(filters: Record<string, unknown>): string {
  const entries = Object.entries(filters).filter(([, value]) => value !== "" && value !== null && value !== undefined);
  if (entries.length === 0) return "全量导出";
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(" · ");
}

export default async function ExportAuditPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, activeUsers, audits] = await Promise.all([
    prisma.exportAudit.count(),
    prisma.exportAudit.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { exportAudits: { some: {} } } }),
    prisma.exportAudit.findMany({
      include: { user: { select: { name: true, username: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const cards = [
    { label: "累计导出", value: total, Icon: ClipboardIcon, tone: "bg-blue-50 text-blue-700" },
    { label: "今日导出", value: today, Icon: BoltIcon, tone: "bg-emerald-50 text-emerald-600" },
    { label: "导出用户", value: activeUsers, Icon: UsersIcon, tone: "bg-amber-50 text-amber-600" },
    { label: "最近记录", value: audits.length, Icon: ChartBarIcon, tone: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">导出审计</h1>
        <p className="mt-1 text-sm text-slate-500">谁在何时导出了哪些数据，供风控与企业客户对账</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-5">
            <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.tone}`}>
              <card.Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-2xl font-bold leading-7 text-slate-900 tnum">{card.value}</div>
              <div className="text-xs text-slate-500">{card.label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">导出记录</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">用户</th>
                <th className="px-5 py-3 font-medium">筛选条件</th>
                <th className="px-5 py-3 font-medium">命中 / 导出</th>
                <th className="px-5 py-3 font-medium">客户端</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audits.map((audit) => (
                <tr key={audit.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 tnum">
                    {audit.createdAt.toLocaleString("zh-CN")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{audit.user.name}</div>
                    <div className="text-xs text-slate-500">{audit.user.username}</div>
                  </td>
                  <td className="max-w-[360px] px-5 py-3.5">
                    <span className="block truncate text-xs text-slate-600" title={filterSummary(audit.filters as Record<string, unknown>)}>
                      {filterSummary(audit.filters as Record<string, unknown>)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-700 tnum">
                    {audit.matchedCount} / {audit.exportedCount}
                  </td>
                  <td className="max-w-[240px] px-5 py-3.5">
                    <div className="truncate text-xs text-slate-600" title={audit.ip ?? "-"}>{audit.ip ?? "-"}</div>
                    <div className="truncate text-[11px] text-slate-400" title={audit.userAgent ?? "-"}>{audit.userAgent ?? "-"}</div>
                  </td>
                </tr>
              ))}
              {audits.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">暂无导出审计记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
