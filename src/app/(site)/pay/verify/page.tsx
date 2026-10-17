import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAuditToken } from "@/lib/payments";
import { getSession } from "@/lib/auth";
import VerifyClientForm from "./verify-client-form";
import { ShieldCheckIcon, AlertCircleIcon, DocumentTextIcon } from "@/components/icons";

export const metadata = { title: "收款核销放行中枢 - 标讯通" };

const CHANNEL_LABEL: Record<string, string> = {
  wechat: "微信支付(个人码)",
  alipay: "支付宝(个人码)",
  bank: "企业对公转账",
};

export default async function PayVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNo?: string; token?: string }>;
}) {
  const { orderNo, token } = await searchParams;
  if (!orderNo || !token) notFound();

  // 1. 签名安全性校验
  const isValid = verifyAuditToken(token, orderNo);
  const user = await getSession();
  const isAdmin = user?.role === "ADMIN";

  if (!isValid && !isAdmin) {
    return (
      <div className="mx-auto max-w-md py-12 px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-900 shadow-sm">
          <AlertCircleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-bold">审核授权令牌无效或已过期</h2>
          <p className="mt-2 text-xs text-red-700 leading-relaxed">
            该放行链接已超过 48 小时有效期，或签名参数已被篡改。如需核销，请使用管理员账号登录电脑端管理后台进行处理。
          </p>
        </div>
      </div>
    );
  }

  // 2. 查询待核销订单详情
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-lg py-8 px-4 font-sans">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* 顶部标头 */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-transparent p-5">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold text-slate-900">
              标讯通 · 移动端收款放行中枢
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            管理员专属免密核验通道 · 请务必核对银行/微信到账流水
          </p>
        </div>

        {/* 订单明细清单 */}
        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">订单编号</dt>
                <dd className="mt-0.5 font-mono font-bold text-slate-900 select-all">
                  {order.orderNo}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">应付金额</dt>
                <dd className="mt-0.5 font-mono text-base font-black text-primary">
                  ¥{Number(order.amount).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">专属识别码</dt>
                <dd className="mt-0.5 font-mono text-base font-black text-red-600 select-all">
                  {order.matchingCode || "未生成"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">支付渠道</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">
                  {CHANNEL_LABEL[order.channel] || order.channel}
                </dd>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200/60">
                <dt className="text-slate-500">订购套餐</dt>
                <dd className="mt-0.5 font-bold text-slate-900 text-sm">
                  {order.plan.name}（{order.billingCycle === "monthly" ? "月付" : "年付"}）
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">客户账号</dt>
                <dd className="mt-0.5 text-slate-800">
                  {order.user.name ? `${order.user.name} (${order.user.username})` : order.user.username}
                  {order.user.email ? ` · ${order.user.email}` : ""}
                </dd>
              </div>
            </dl>
          </div>

          {/* 转账水单/备注展示 */}
          {order.note && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <DocumentTextIcon className="h-4 w-4" />
                <span>客户提交的转账登记信息：</span>
              </div>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-amber-900/90 whitespace-pre-wrap break-all">
                {order.note}
              </p>
            </div>
          )}

          {/* 交互核销表单 */}
          <VerifyClientForm
            orderNo={order.orderNo}
            auditToken={token}
            currentStatus={order.status}
          />
        </div>
      </div>
    </div>
  );
}
