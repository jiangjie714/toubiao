import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cancelOrderAction, confirmOrderPaidAction, rejectOrderAction } from "./actions";

import BatchReconcileModal from "@/components/admin/batch-reconcile-modal";

export const metadata = { title: "订单管理" };

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  WAIT_VERIFY: "bg-rose-50 text-rose-700 border border-rose-300 font-semibold",
  PAID: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium",
  CANCELED: "bg-slate-100 text-slate-500 border border-slate-200",
  FAILED: "bg-red-50 text-red-700 border border-red-200",
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: "待支付",
  WAIT_VERIFY: "待核销 (已报备)",
  PAID: "已核销到账",
  CANCELED: "已取消",
  FAILED: "支付失败",
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">订单管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理用户在线订购及对公转账订单。用户完成支付并上报流水/匹配码后，点击「确认到账开通」即可自动开通或续期对应套餐。
          </p>
        </div>
        <div className="shrink-0">
          <BatchReconcileModal />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
        <table className="data-table w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">订单号 / 匹配码</th>
              <th className="px-5 py-3 font-medium">用户</th>
              <th className="px-5 py-3 font-medium">套餐规格</th>
              <th className="px-5 py-3 font-medium">渠道 / 合同</th>
              <th className="px-5 py-3 font-medium">金额</th>
              <th className="px-5 py-3 font-medium">状态 / 凭证</th>
              <th className="px-5 py-3 font-medium">创建时间</th>
              <th className="px-5 py-3 font-medium">财务核销操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-blue-50/40">
                <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                  <div className="font-medium text-slate-900">{order.orderNo}</div>
                  {order.matchingCode && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">附言匹配码:</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-mono font-bold tracking-wider border border-amber-300">
                        {order.matchingCode}
                      </span>
                    </div>
                  )}
                  <div className="mt-1">
                    <Link
                      href={`/pay/${order.orderNo}`}
                      target="_blank"
                      className="text-[11px] text-slate-400 hover:text-primary transition"
                    >
                      查看收银台 →
                    </Link>
                  </div>
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
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${STATUS_STYLE[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {order.status === "WAIT_VERIFY" && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                      )}
                      {STATUS_TEXT[order.status] ?? order.status}
                    </span>
                  </div>
                  {order.proofUrl && (
                    <div className="mt-1.5">
                      <a
                        href={order.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        查看打款凭证 →
                      </a>
                    </div>
                  )}
                  {order.note && (
                    <div className="mt-1.5 max-w-[240px] rounded bg-slate-50 p-1.5 text-[11px] text-slate-600 border border-slate-200 leading-tight">
                      <span className="font-medium text-slate-700">备注:</span> {order.note}
                    </div>
                  )}
                  {order.auditNote && (
                    <div className="mt-1.5 max-w-[240px] rounded bg-rose-50/80 p-1.5 text-[11px] text-rose-700 border border-rose-200 leading-tight">
                      <span className="font-medium">审核记录:</span> {order.auditNote}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500 tnum">
                  {order.createdAt.toLocaleString("zh-CN")}
                </td>
                <td className="px-5 py-3.5">
                  {order.status === "PENDING" || order.status === "WAIT_VERIFY" ? (
                    <div className="space-y-2 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <form action={confirmOrderPaidAction}>
                          <input type="hidden" name="id" value={order.id} />
                          <button
                            type="submit"
                            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 shadow-xs ${
                              order.status === "WAIT_VERIFY"
                                ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500/20"
                                : "bg-primary hover:bg-primary-strong"
                            }`}
                            title="确认资金已到账，自动开通或续期用户套餐"
                          >
                            确认到账开通
                          </button>
                        </form>
                        <form action={cancelOrderAction}>
                          <input type="hidden" name="id" value={order.id} />
                          <button
                            type="submit"
                            className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-100"
                            title="取消此订单"
                          >
                            取消
                          </button>
                        </form>
                      </div>
                      {order.status === "WAIT_VERIFY" && (
                        <details className="text-[11px]">
                          <summary className="cursor-pointer text-rose-600 hover:text-rose-700 font-medium select-none">
                            驳回核销申请
                          </summary>
                          <form action={rejectOrderAction} className="mt-1.5 space-y-1.5 bg-slate-50 p-2 rounded border border-slate-200">
                            <input type="hidden" name="id" value={order.id} />
                            <input
                              type="text"
                              name="reason"
                              placeholder="驳回说明 (如: 未查到流水)"
                              required
                              className="w-full text-xs px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:border-rose-400"
                            />
                            <button
                              type="submit"
                              className="cursor-pointer w-full text-center py-1 text-xs rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
                            >
                              确认驳回
                            </button>
                          </form>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      <div className="text-emerald-700 font-medium">已核销开通</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {order.paidAt ? order.paidAt.toLocaleString("zh-CN") : "-"}
                      </div>
                    </div>
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
