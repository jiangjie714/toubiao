import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tenderTypeLabel } from "@/lib/constants";
import { BoltIcon, ChartBarIcon, ClipboardIcon, UsersIcon } from "@/components/icons";

export const metadata = { title: "推送监控" };

export default async function PushesPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalWatches, enabledWatches, activeUsers, todayRecords, watches, recentRecords] =
    await Promise.all([
      prisma.pushWatch.count(),
      prisma.pushWatch.count({ where: { enabled: true } }),
      prisma.user.count({
        where: { status: "ACTIVE", emailVerified: true, pushWatches: { some: { enabled: true } } },
      }),
      prisma.pushRecord.count({ where: { sentAt: { gte: todayStart } } }),
      prisma.pushWatch.findMany({
        include: {
          user: { select: { name: true, username: true, email: true } },
          _count: { select: { records: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.pushRecord.findMany({
        include: {
          user: { select: { name: true, email: true } },
          watch: { select: { name: true, keyword: true } },
          tender: { select: { id: true, title: true, type: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 20,
      }),
    ]);

  const cards = [
    { label: "订阅规则", value: totalWatches, Icon: ClipboardIcon, tone: "bg-blue-50 text-blue-700" },
    { label: "启用规则", value: enabledWatches, Icon: BoltIcon, tone: "bg-emerald-50 text-emerald-600" },
    { label: "活跃订阅用户", value: activeUsers, Icon: UsersIcon, tone: "bg-amber-50 text-amber-600" },
    { label: "今日送达", value: todayRecords, Icon: ChartBarIcon, tone: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">推送监控</h1>
        <p className="mt-1 text-sm text-slate-500">
          每日邮件推送的订阅状态、最近调度时间与送达记录
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-5"
          >
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
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
          订阅规则
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">规则</th>
                <th className="px-5 py-3 font-medium">用户</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">最近调度</th>
                <th className="px-5 py-3 font-medium">累计送达</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {watches.map((watch) => (
                <tr key={watch.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{watch.name}</div>
                    <div className="text-xs text-slate-500">关键词：{watch.keyword}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{watch.user.name}</div>
                    <div className="text-xs text-slate-500">{watch.user.email ?? watch.user.username}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        watch.enabled
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {watch.enabled ? "启用" : "停用"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 tnum">
                    {watch.lastPushAt?.toLocaleString("zh-CN") ?? "-"}
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 tnum">{watch._count.records}</td>
                </tr>
              ))}
              {watches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                    暂无关键词订阅
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
          最近送达
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">收件人</th>
                <th className="px-5 py-3 font-medium">规则</th>
                <th className="px-5 py-3 font-medium">公告</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRecords.map((record) => (
                <tr key={record.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 tnum">
                    {record.sentAt.toLocaleString("zh-CN")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{record.user.name}</div>
                    <div className="text-xs text-slate-500">{record.user.email ?? "-"}</div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700">
                    {record.watch?.name ?? "-"}
                    <span className="ml-1 text-xs text-slate-500">
                      {record.watch ? `· ${record.watch.keyword}` : ""}
                    </span>
                  </td>
                  <td className="max-w-[360px] px-5 py-3.5">
                    <Link
                      href={`/tender/${record.tender.id}`}
                      className="block truncate text-slate-700 transition-colors duration-150 hover:text-primary"
                      title={record.tender.title}
                    >
                      {record.tender.title}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {tenderTypeLabel(record.tender.type)}
                    </span>
                  </td>
                </tr>
              ))}
              {recentRecords.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-500">
                    还没有推送记录
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
