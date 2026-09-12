import { prisma } from "@/lib/prisma";
import { ClipboardIcon, BoltIcon, ChartBarIcon, DatabaseIcon } from "@/components/icons";

export const metadata = { title: "支付事件" };

const STATUS_STYLE: Record<string, string> = {
  RECEIVED: "bg-blue-50 text-blue-700",
  PROCESSED: "bg-emerald-50 text-emerald-600",
  FAILED: "bg-red-50 text-red-600",
};

export default async function PaymentEventsPage() {
  const [total, processed, failed, events] = await Promise.all([
    prisma.paymentEvent.count(),
    prisma.paymentEvent.count({ where: { processedAt: { not: null } } }),
    prisma.paymentEvent.count({ where: { status: "FAILED" } }),
    prisma.paymentEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 30 }),
  ]);

  const cards = [
    { label: "事件总量", value: total, Icon: ClipboardIcon, tone: "bg-blue-50 text-blue-700" },
    { label: "已处理", value: processed, Icon: BoltIcon, tone: "bg-emerald-50 text-emerald-600" },
    { label: "处理失败", value: failed, Icon: DatabaseIcon, tone: "bg-red-50 text-red-600" },
    { label: "待人工检查", value: total - processed - failed, Icon: ChartBarIcon, tone: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">支付事件</h1>
        <p className="mt-1 text-sm text-slate-500">微信 / 支付宝回调事件、幂等状态与失败原因</p>
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
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">最近事件</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">接收时间</th>
                <th className="px-5 py-3 font-medium">渠道</th>
                <th className="px-5 py-3 font-medium">事件 ID</th>
                <th className="px-5 py-3 font-medium">订单号</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">处理时间 / 错误</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 tnum">
                    {event.receivedAt.toLocaleString("zh-CN")}
                  </td>
                  <td className="px-5 py-3.5 text-slate-700">
                    {event.provider === "wechat" ? "微信支付" : event.provider === "alipay" ? "支付宝" : event.provider}
                  </td>
                  <td className="max-w-[220px] truncate px-5 py-3.5 font-mono text-xs text-slate-600" title={event.providerEventId}>
                    {event.providerEventId}
                  </td>
                  <td className="max-w-[180px] truncate px-5 py-3.5 font-mono text-xs text-slate-700" title={event.orderNo ?? "-"}>
                    {event.orderNo ?? "-"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[event.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-5 py-3.5 text-xs text-slate-500">
                    {event.processedAt?.toLocaleString("zh-CN") ?? "-"}
                    {event.error && <span className="mt-1 block truncate text-red-500" title={event.error}>{event.error}</span>}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">暂无支付事件</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
