import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cancelOrderAction, confirmOrderPaidAction } from "./actions";

export const metadata = { title: "订单管理" };

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  PAID: "bg-emerald-50 text-emerald-600",
  CANCELED: "bg-slate-100 text-slate-500",
  FAILED: "bg-red-50 text-red-600",
};

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { name: true, username: true } },
      plan: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">订单管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          确认对公转账到账后，系统会自动开通或续期对应套餐。
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">订单号</th>
              <th className="px-5 py-3 font-medium">用户</th>
              <th className="px-5 py-3 font-medium">套餐规格</th>
              <th className="px-5 py-3 font-medium">渠道 / 合同</th>
              <th className="px-5 py-3 font-medium">金额</th>
              <th className="px-5 py-3 font-medium">状态 / 打款凭证</th>
              <th className="px-5 py-3 font-medium">创建时间</th>
              <th className="px-5 py-3 font-medium">财务核销操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-blue-50/40">
                <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                  <div>{order.orderNo}</div>
                  <Link
                    href={`/pay/${order.orderNo}`}
                    target="_blank"
                    className="text-[11px] text-slate-400 hover:text-primary transition"
                  >
                    查看收银台 →
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-800">{order.user.name}</div>
                  <div className="text-xs text-slate-500">{order.user.username}</div>
                </td>
                <td className="px-5 py-3.5 text-slate-700">
                  <div className="font-medium">{order.plan.name}</div>
                  <span className="text-xs text-slate-500">
                    {order.billingCycle === "monthly" ? "按月订购" : "按年订购 (12个月)"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      order.channel === "bank"
                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                        : order.channel === "wechat"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {order.channel === "bank" ? "企业对公转账" : order.channel === "wechat" ? "微信支付" : "支付宝"}
                  </span>
                  <div className="mt-1">
                    <Link
                      href={`/contract/${order.orderNo}`}
                      target="_blank"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      查看电子合同 →
                    </Link>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-semibold text-slate-900 tnum font-mono">
                  ¥{order.amount.toFixed(2)}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {order.status}
                  </span>
                  {order.note && (
                    <div className="mt-1.5 max-w-[260px] rounded bg-slate-50 p-1.5 text-[11px] text-slate-600 border border-slate-200 leading-tight">
                      {order.note}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500 tnum">
                  {order.createdAt.toLocaleString("zh-CN")}
                </td>
                <td className="px-5 py-3.5">
                  {order.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <form action={confirmOrderPaidAction}>
                        <input type="hidden" name="id" value={order.id} />
                        <button
                          className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-primary-strong shadow-xs"
                          title="确认资金已到账，自动开通或续期用户套餐"
                        >
                          确认到账开通
                        </button>
                      </form>
                      <form action={cancelOrderAction}>
                        <input type="hidden" name="id" value={order.id} />
                        <button className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                          取消
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">已于 {order.paidAt?.toLocaleDateString("zh-CN") ?? "-"} 核销</span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">
                  暂无订单
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
