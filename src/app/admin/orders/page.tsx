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
              <th className="px-5 py-3 font-medium">套餐</th>
              <th className="px-5 py-3 font-medium">金额</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">创建时间</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-blue-50/40">
                <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{order.orderNo}</td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-800">{order.user.name}</div>
                  <div className="text-xs text-slate-500">{order.user.username}</div>
                </td>
                <td className="px-5 py-3.5 text-slate-700">
                  {order.plan.name}
                  <span className="ml-1 text-xs text-slate-500">
                    {order.billingCycle === "monthly" ? "月付" : "年付"}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-semibold text-slate-900 tnum">
                  ¥{order.amount.toFixed(2)}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500 tnum">
                  {order.createdAt.toLocaleString("zh-CN")}
                </td>
                <td className="px-5 py-3.5">
                  {order.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <form action={confirmOrderPaidAction}>
                        <input type="hidden" name="id" value={order.id} />
                        <button className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-primary-strong">
                          确认到账
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
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">
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
