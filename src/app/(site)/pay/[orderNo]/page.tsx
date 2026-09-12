import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isPrepayUsable } from "@/lib/payment-prepay";
import { refreshPrepayAction } from "@/app/actions/payments";
import PaymentStatusPoller from "@/components/payment-status-poller";

export const metadata = { title: "订单支付" };

const CHANNEL_LABEL: Record<string, string> = {
  wechat: "微信支付",
  alipay: "支付宝",
  bank: "对公转账",
};

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ orderNo }, { error }] = await Promise.all([params, searchParams]);
  const user = await getSession();
  if (!user) redirect(`/login?next=/pay/${orderNo}`);

  const order = await prisma.order.findFirst({
    where: { orderNo, userId: user.uid },
    include: { plan: true },
  });
  if (!order) notFound();

  const usable = isPrepayUsable(order);
  const qrCode = usable && order.prepayCode
    ? await QRCode.toDataURL(order.prepayCode, { width: 240, margin: 1 })
    : null;
  const paid = order.status === "PAID";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">订单支付</h1>
          <p className="mt-2 text-sm text-slate-600">
            {order.plan.name} · {order.billingCycle === "monthly" ? "月付" : "年付"} ·{" "}
            {CHANNEL_LABEL[order.channel] ?? order.channel}
          </p>
        </div>
        <Link href="/pricing" className="text-sm text-accent hover:underline">
          返回套餐
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-surface p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">订单号</dt>
            <dd className="mt-1 font-mono font-semibold text-slate-900">{order.orderNo}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">应付金额</dt>
            <dd className="mt-1 text-lg font-bold text-primary tnum">¥{order.amount.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">订单状态</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {order.status === "PENDING"
                ? "待支付"
                : order.status === "PAID"
                  ? "已支付"
                  : order.status === "CANCELED"
                    ? "已取消"
                    : order.status}
            </dd>
          </div>
        </dl>

        {error === "prepay" && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            支付二维码生成失败，请稍后刷新重试；若持续失败，请联系管理员检查支付渠道配置。
          </p>
        )}

        {paid ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-5 text-center">
            <p className="text-sm font-semibold text-emerald-700">支付成功，套餐已开通</p>
            <p className="mt-1 text-xs text-emerald-600">
              支付时间：{order.paidAt?.toLocaleString("zh-CN") ?? "-"}
            </p>
            <Link
              href="/list"
              className="mt-4 inline-flex cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
            >
              开始检索
            </Link>
          </div>
        ) : order.status === "PENDING" ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            {qrCode ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt={`${CHANNEL_LABEL[order.channel]}支付二维码`} className="h-60 w-60" />
                </div>
                <p className="text-xs text-slate-500">
                  请使用{CHANNEL_LABEL[order.channel]}扫码完成支付，二维码有效期至{" "}
                  {order.prepayExpiresAt?.toLocaleTimeString("zh-CN")}
                </p>
                <PaymentStatusPoller orderNo={order.orderNo} />
              </>
            ) : (
              <div className="w-full rounded-lg bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">支付二维码未生成或已过期</p>
                <p className="mt-1 text-xs text-slate-500">订单仍为待支付状态，可重新获取二维码。</p>
                <form action={refreshPrepayAction} className="mt-4">
                  <input type="hidden" name="orderNo" value={order.orderNo} />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
                  >
                    重新获取二维码
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-600">
            当前订单不可支付。如已完成付款，请联系客服核实。
          </div>
        )}
      </section>
    </div>
  );
}
