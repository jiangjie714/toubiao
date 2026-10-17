import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isPrepayUsable } from "@/lib/payment-prepay";
import { isJeepayConfigured } from "@/lib/jeepay";
import { preparePrepay } from "@/app/actions/payments";
import { DocumentTextIcon } from "@/components/icons";
import { getCompanyPaymentConfig } from "@/lib/company-config";
import { allocateMatchingCode } from "@/lib/payments";
import PayCashierView from "@/components/pay-cashier-view";

export const metadata = { title: "订单结算收银台 - 标讯通" };

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const user = await getSession();
  if (!user) redirect(`/login?next=/pay/${orderNo}`);

  const order = await prisma.order.findFirst({
    where: { orderNo, userId: user.uid },
    include: { plan: true },
  });
  if (!order) notFound();

  // 保证订单始终拥有 4 位专属核销码
  if (!order.matchingCode) {
    const code = await allocateMatchingCode(order.orderNo);
    await prisma.order.update({
      where: { id: order.id },
      data: { matchingCode: code },
    });
    order.matchingCode = code;
  }

  const isJeepayEnabled = isJeepayConfigured();

  // 若订单状态为 PENDING 且非对公转账，且没有可用的 prepayCode（未生成或已过期），动态生成最新的预下单支付码
  if (order.status === "PENDING" && order.channel !== "bank" && !isPrepayUsable(order)) {
    await preparePrepay(order);
    const refreshed = await prisma.order.findUnique({
      where: { id: order.id },
      select: { prepayCode: true, prepayExpiresAt: true },
    });
    if (refreshed) {
      order.prepayCode = refreshed.prepayCode;
      order.prepayExpiresAt = refreshed.prepayExpiresAt;
    }
  }

  const companyConfig = getCompanyPaymentConfig();

  // 检测 prepayCode 是否为 HTTP/HTTPS 跳转链接 (payUrl)
  const isHttpUrl = Boolean(
    order.prepayCode && /^https?:\/\//i.test(order.prepayCode.trim())
  );
  const payUrl = isHttpUrl ? order.prepayCode!.trim() : null;

  // 1. 生成微信支付二维码
  let wechatQrDataUrl: string | null = null;
  try {
    const wechatCode =
      (order.channel === "wechat" || order.channel === "jeepay") && order.prepayCode
        ? order.prepayCode
        : `weixin://dl/business/?t=tb_${order.matchingCode || order.orderNo}`;
    wechatQrDataUrl = await QRCode.toDataURL(wechatCode, { width: 280, margin: 1 });
  } catch (err) {
    console.error("Generate WeChat QR error:", err);
  }

  // 2. 生成支付宝支付二维码
  let alipayQrDataUrl: string | null = null;
  try {
    const alipayCode =
      (order.channel === "alipay" || order.channel === "jeepay") && order.prepayCode
        ? order.prepayCode
        : `alipays://platformapi/startapp?appId=20000067&url=https://toubiao.com/pay/${order.orderNo}`;
    alipayQrDataUrl = await QRCode.toDataURL(alipayCode, { width: 280, margin: 1 });
  } catch (err) {
    console.error("Generate Alipay QR error:", err);
  }

  // 3. 若为 jeepay 渠道，生成聚合收银台专属二维码
  let cashierQrDataUrl: string | null = null;
  if (order.channel === "jeepay" && order.prepayCode) {
    try {
      cashierQrDataUrl = await QRCode.toDataURL(order.prepayCode, { width: 280, margin: 1 });
    } catch (err) {
      console.error("Generate Cashier QR error:", err);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 顶部标题与合同入口 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            订单结算收银台
          </h1>
          <p className="mt-1.5 text-xs text-slate-500">
            订购套餐：<span className="font-semibold text-slate-800">{order.plan.name}</span> ·{" "}
            {order.billingCycle === "monthly" ? "月付" : "年付"} · 专属识别码：
            <span className="font-mono font-bold text-red-600">{order.matchingCode}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/contract/${order.orderNo}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <DocumentTextIcon className="h-3.5 w-3.5" />
            <span>查看电子采购协议 (盖章版)</span>
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/pricing" className="text-xs text-slate-500 hover:underline">
            返回选购套餐
          </Link>
        </div>
      </div>

      {/* 订单核心摘要带 */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <dt className="text-slate-500">订单编号</dt>
            <dd className="mt-1 font-mono font-semibold text-slate-900 select-all">
              {order.orderNo}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">应付金额</dt>
            <dd className="mt-1 font-mono text-lg font-black text-primary tnum">
              ¥{Number(order.amount).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">专属核销码</dt>
            <dd className="mt-1 font-mono text-base font-black text-red-600 select-all">
              {order.matchingCode}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">当前状态</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {order.status === "PAID" ? (
                <span className="text-emerald-600">✓ 已生效</span>
              ) : order.status === "WAIT_VERIFY" ? (
                <span className="text-blue-600 animate-pulse">● 财务核对中</span>
              ) : (
                <span className="text-amber-600">待付款</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* 核心双轨收银交互视图 */}
      <PayCashierView
        order={{
          id: order.id,
          orderNo: order.orderNo,
          amount: Number(order.amount),
          channel: order.channel,
          status: order.status,
          billingCycle: order.billingCycle,
          matchingCode: order.matchingCode,
          paidAt: order.paidAt?.toISOString() ?? null,
          note: order.note,
          auditStatus: order.auditStatus,
          auditNote: order.auditNote,
          plan: {
            name: order.plan.name,
            code: order.plan.code,
          },
        }}
        user={{
          name: user.name,
          username: user.username,
        }}
        wechatQrDataUrl={wechatQrDataUrl}
        alipayQrDataUrl={alipayQrDataUrl}
        cashierQrDataUrl={cashierQrDataUrl}
        companyConfig={{
          companyName: companyConfig.companyName,
          bankName: companyConfig.bankName,
          bankAccount: companyConfig.bankAccount,
          bankBranchCode: companyConfig.bankBranchCode,
          taxNumber: companyConfig.taxNumber,
        }}
        isJeepayEnabled={isJeepayEnabled}
        payUrl={payUrl}
      />
    </div>
  );
}
