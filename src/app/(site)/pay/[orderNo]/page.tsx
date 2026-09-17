import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isPrepayUsable } from "@/lib/payment-prepay";
import { refreshPrepayAction } from "@/app/actions/payments";
import PaymentStatusPoller from "@/components/payment-status-poller";
import BankProofForm from "@/components/bank-proof-form";
import { BuildingIcon, DocumentTextIcon } from "@/components/icons";
import { getCompanyPaymentConfig } from "@/lib/company-config";

export const metadata = { title: "订单支付" };

const CHANNEL_LABEL: Record<string, string> = {
  wechat: "微信支付",
  alipay: "支付宝",
  bank: "企业对公转账",
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

  const isBank = order.channel === "bank";
  const usable = !isBank && isPrepayUsable(order);
  const companyConfig = getCompanyPaymentConfig();

  // 若具备官方直连 API 动态 code 则生成动态二维码；否则展示企业官方收款码/降级二维码
  let qrCode: string | null = null;
  let isFallbackQr = false;

  if (usable && order.prepayCode) {
    qrCode = await QRCode.toDataURL(order.prepayCode, { width: 240, margin: 1 });
  } else if (!isBank && order.status === "PENDING") {
    // 降级使用企业官方直接收款码链接 (生成带订单备注的收款提示二维码)
    const fallbackTarget =
      order.channel === "wechat"
        ? `weixin://dl/business/?t=toubiao_${order.orderNo}`
        : `alipays://platformapi/startapp?appId=20000067&url=https://toubiao.com/pay/${order.orderNo}`;
    qrCode = await QRCode.toDataURL(fallbackTarget, { width: 240, margin: 1 });
    isFallbackQr = true;
  }
  const paid = order.status === "PAID";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">订单结算收银台</h1>
          <p className="mt-2 text-sm text-slate-600">
            {order.plan.name} · {order.billingCycle === "monthly" ? "月付" : "年付"} ·{" "}
            {CHANNEL_LABEL[order.channel] ?? order.channel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/contract/${order.orderNo}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <DocumentTextIcon className="h-3.5 w-3.5" />
            <span>查看采购服务合同</span>
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/pricing" className="text-xs text-slate-500 hover:underline">
            返回套餐
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-surface p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">订单号</dt>
            <dd className="mt-1 font-mono font-semibold text-slate-900">{order.orderNo}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">应付金额</dt>
            <dd className="mt-1 text-lg font-bold text-primary tnum font-mono">
              ¥{order.amount.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">订单状态</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {order.status === "PENDING"
                ? "待支付 / 待核销"
                : order.status === "PAID"
                  ? "已支付已激活"
                  : order.status === "CANCELED"
                    ? "已取消"
                    : order.status}
            </dd>
          </div>
        </dl>

        {error === "prepay" && !isBank && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            支付二维码生成失败，请稍后刷新重试；若持续失败，请联系管理员检查支付渠道配置。
          </p>
        )}

        {paid ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-5 text-center">
            <p className="text-sm font-semibold text-emerald-700">支付成功，套餐特权已开通</p>
            <p className="mt-1 text-xs text-emerald-600">
              支付核销时间：{order.paidAt?.toLocaleString("zh-CN") ?? "-"}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/list"
                className="inline-flex cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
              >
                开始商机检索
              </Link>
              <Link
                href="/invoices"
                className="inline-flex cursor-pointer rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                申请增值税发票
              </Link>
            </div>
          </div>
        ) : order.status === "PENDING" ? (
          <div className="mt-6 space-y-6">
            {isBank ? (
              /* 企业对公转账专用面板 */
              <div className="space-y-6">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <BuildingIcon className="h-4.5 w-4.5 text-blue-700" />
                      <h2 className="text-sm font-bold text-blue-950">
                        标讯通官方企业收款账户（请使用企业网银转账）
                      </h2>
                    </div>
                    <Link
                      href={`/contract/${order.orderNo}`}
                      target="_blank"
                      className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <DocumentTextIcon className="h-3.5 w-3.5" />
                      <span>下载采购合同电子版 →</span>
                    </Link>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-500">收款单位全称（户名）</dt>
                      <dd className="mt-0.5 font-bold text-slate-900 select-all">
                        {getCompanyPaymentConfig().companyName}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">开户银行</dt>
                      <dd className="mt-0.5 font-bold text-slate-900 select-all">
                        {getCompanyPaymentConfig().bankName}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">对公银行账号</dt>
                      <dd className="mt-0.5 font-bold font-mono text-blue-800 text-sm select-all">
                        {getCompanyPaymentConfig().bankAccount}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">大额支付联行行号</dt>
                      <dd className="mt-0.5 font-bold font-mono text-slate-900 select-all">
                        {getCompanyPaymentConfig().bankBranchCode}
                      </dd>
                    </div>

                    <div className="sm:col-span-2 rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-amber-900">
                      <div className="font-bold flex items-center gap-1 text-[11px]">
                        <span>⚠️ 转账时请务必在附言 / 汇款备注栏注明：</span>
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 text-red-600 select-all">
                          {order.orderNo}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-amber-700">
                        银行系统将通过附言中的订单号快速匹配您的对公款项，加速开通！
                      </p>
                    </div>
                  </dl>
                </div>

                {/* 提交对公打款水单流水表单 */}
                <BankProofForm
                  orderNo={order.orderNo}
                  defaultPayerName={user.name}
                  existingNote={order.note}
                />
              </div>
            ) : (
              /* 微信/支付宝线上二维码支付 */
              <div className="flex flex-col items-center gap-4">
                {qrCode ? (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCode}
                        alt={`${CHANNEL_LABEL[order.channel]}支付二维码`}
                        className="h-60 w-60 mx-auto"
                      />
                      <div className="mt-3 text-xs font-bold text-slate-800">
                        收款方：{companyConfig.companyName}
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs text-slate-600">
                        请打开手机{CHANNEL_LABEL[order.channel]}扫描二维码完成付款
                      </p>
                      {isFallbackQr && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
                          提示：若扫码付款未自动跳转，可点击下方提交转账姓名，系统将快速核销开通。
                        </p>
                      )}
                    </div>
                    <PaymentStatusPoller orderNo={order.orderNo} />

                    {/* 辅助打款凭证表单 */}
                    <div className="w-full mt-4">
                      <BankProofForm
                        orderNo={order.orderNo}
                        defaultPayerName={user.name}
                        existingNote={order.note}
                      />
                    </div>
                  </>
                ) : (
                  <div className="w-full rounded-lg bg-slate-50 p-6 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      支付二维码未生成或已过期
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      订单仍为待支付状态，可重新获取二维码。
                    </p>
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
