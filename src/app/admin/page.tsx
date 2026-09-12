import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TENDER_TYPES } from "@/lib/constants";
import {
  DatabaseIcon,
  BoltIcon,
  ClipboardIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from "@/components/icons";

export const metadata = { title: "仪表盘" };

export default async function AdminDashboard() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, todayCount, byType, recentLogs, failedSources] = await Promise.all([
    prisma.tender.count(),
    prisma.tender.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.tender.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.crawlLog.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.crawlSource.count({ where: { enabled: true, status: "FAILED" } }),
  ]);

  const maxTypeCount = Math.max(1, ...byType.map((x) => x._count._all));
  const cards = [
    { label: "公告总量", value: total, Icon: DatabaseIcon, tone: "bg-blue-50 text-blue-700" },
    { label: "今日新增", value: todayCount, Icon: BoltIcon, tone: "bg-amber-50 text-amber-600" },
    { label: "数据源异常", value: failedSources, Icon: ChartBarIcon, tone: "bg-red-50 text-red-600" },
    {
      label: "信息类型",
      value: `${byType.length} / 4`,
      Icon: ClipboardIcon,
      tone: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">仪表盘</h1>
        <p className="mt-1 text-sm text-slate-500">数据总览与抓取运行状况</p>
      </div>

      {/* 统计分段带：单卡分段，非同质卡片网格 */}
      <section className="grid grid-cols-2 divide-slate-100 rounded-xl border border-slate-200 bg-surface xl:grid-cols-4 xl:divide-x">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={`flex items-center gap-4 px-6 py-5 ${
              i % 2 === 1 ? "max-xl:border-l max-xl:border-slate-100" : ""
            } ${i >= 2 ? "max-xl:border-t max-xl:border-slate-100" : ""}`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${c.tone}`}>
              <c.Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-slate-900 tnum leading-7">{c.value}</div>
              <div className="text-xs text-slate-500">{c.label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-surface">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
            分类统计
          </div>
          <div className="space-y-3 px-5 py-4">
            {TENDER_TYPES.map((t) => {
              const count = byType.find((x) => x.type === t.value)?._count._all ?? 0;
              return (
                <div key={t.value}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600">{t.label}</span>
                    <span className="font-semibold text-slate-900 tnum">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${Math.max(2, (count / maxTypeCount) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 px-5 py-2.5">
            <Link
              href="/admin/tenders"
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-accent transition-colors duration-200 hover:text-primary"
            >
              管理公告
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface">
          <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
            最近抓取
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {recentLogs.map((log) => (
              <li key={log.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">{log.sourceName}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      log.status === "OK"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-600"
                    } tnum`}
                  >
                    {log.status === "OK" ? `成功 +${log.newCount}` : "失败"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {log.startedAt.toLocaleString("zh-CN")} {log.message ? `· ${log.message}` : ""}
                </p>
              </li>
            ))}
            {recentLogs.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-slate-500">
                还没有抓取记录
              </li>
            )}
          </ul>
          <div className="border-t border-slate-100 px-5 py-2.5">
            <Link
              href="/admin/sources"
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-accent transition-colors duration-200 hover:text-primary"
            >
              数据源管理
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
