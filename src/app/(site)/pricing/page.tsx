import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { createBankOrderAction } from "@/app/actions/orders";
import { createOnlineOrderAction } from "@/app/actions/payments";
import { ShieldCheckIcon } from "@/components/icons";

export const metadata = { title: "套餐与价格" };

type PlanFeaturesDisplay = {
  searchQuota: number;
  fullText: boolean;
  contacts: boolean;
  attachments: boolean;
  pushGroups: number;
  exportDaily: number;
  apiAccess: boolean;
};

const FEATURE_LABELS: [keyof PlanFeaturesDisplay, string][] = [
  ["searchQuota", "每日搜索"],
  ["fullText", "正文全文"],
  ["contacts", "联系方式"],
  ["attachments", "附件查看"],
  ["pushGroups", "关键词推送"],
  ["exportDaily", "导出额度"],
];


function priceLabel(monthly: number | null, yearly: number | null) {
  if (monthly === null && yearly === null) return "免费";
  if (monthly === null) return `¥${yearly?.toFixed(2)} / 年`;
  if (yearly === null) return `¥${monthly.toFixed(2)} / 月`;
  return `¥${monthly.toFixed(2)} / 月 · ¥${yearly.toFixed(2)} / 年`;
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { submitted, error } = await searchParams;
  const user = await getSession();
  if (!user) redirect("/login?next=/pricing");

  const [plans, entitlement, order] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getEntitlement(user.uid),
    submitted
      ? prisma.order.findFirst({
          where: { id: Number(submitted), userId: user.uid },
          include: { plan: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">套餐与价格</h1>
        <p className="mt-2 text-sm text-slate-600">
          当前套餐：<b className="text-primary">{entitlement.planName}</b>
          {entitlement.subscriptionEndsAt && (
            <span className="ml-2 text-xs text-slate-500">
              有效期至 {entitlement.subscriptionEndsAt.toLocaleDateString("zh-CN")}
            </span>
          )}
        </p>
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            下单参数无效，请重新选择套餐。
          </p>
        )}
      </div>

      {order && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-6">
          <h2 className="text-base font-bold text-slate-900">订单已提交，等待对公转账</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">订单号</dt>
              <dd className="mt-1 font-mono font-semibold text-slate-900">{order.orderNo}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">套餐</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {order.plan.name} · {order.billingCycle === "monthly" ? "月付" : "年付"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">应付金额</dt>
              <dd className="mt-1 font-semibold text-primary tnum">¥{order.amount.toFixed(2)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-6 text-slate-600">
            请将对公转账备注填写订单号，付款后联系商务或管理员确认到账。确认后系统会自动开通对应套餐。
          </p>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const features = plan.features as PlanFeaturesDisplay;
          return (
            <article
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-surface p-5 ${
                plan.code === entitlement.planCode ? "border-primary shadow-sm" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">{plan.name}</h2>
                {plan.code === entitlement.planCode && (
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
                    当前
                  </span>
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-primary tnum">
                {priceLabel(
                  plan.priceMonthly === null ? null : Number(plan.priceMonthly),
                  plan.priceYearly === null ? null : Number(plan.priceYearly),
                )}
              </p>
              <ul className="mt-4 flex-1 space-y-2.5 text-sm text-slate-700">
                {FEATURE_LABELS.map(([key, label]) => {
                  const value = features[key];
                  const text =
                    typeof value === "boolean"
                      ? value
                        ? "支持"
                        : "不支持"
                      : value >= 10000
                        ? "不限"
                        : `${value} ${key === "searchQuota" ? "次/日" : key === "pushGroups" ? "组" : "条/日"}`;
                  return (
                    <li key={key} className="flex items-center gap-2">
                      <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{label}</span>
                      <span className="ml-auto text-xs font-medium text-slate-500">{text}</span>
                    </li>
                  );
                })}
              </ul>

              {plan.code !== "FREE" && (
                <div className="mt-5 space-y-2">
                  {plan.priceMonthly !== null && (
                    <div className="grid grid-cols-2 gap-2">
                      <form action={createOnlineOrderAction}>
                        <input type="hidden" name="planCode" value={plan.code} />
                        <input type="hidden" name="billingCycle" value="monthly" />
                        <input type="hidden" name="channel" value="wechat" />
                        <button className="w-full cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong">
                          微信月付
                        </button>
                      </form>
                      <form action={createOnlineOrderAction}>
                        <input type="hidden" name="planCode" value={plan.code} />
                        <input type="hidden" name="billingCycle" value="monthly" />
                        <input type="hidden" name="channel" value="alipay" />
                        <button className="w-full cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-blue-50">
                          支付宝月付
                        </button>
                      </form>
                    </div>
                  )}
                  {plan.priceYearly !== null && (
                    <div className="grid grid-cols-2 gap-2">
                      <form action={createOnlineOrderAction}>
                        <input type="hidden" name="planCode" value={plan.code} />
                        <input type="hidden" name="billingCycle" value="yearly" />
                        <input type="hidden" name="channel" value="wechat" />
                        <button className="w-full cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong">
                          微信年付
                        </button>
                      </form>
                      <form action={createOnlineOrderAction}>
                        <input type="hidden" name="planCode" value={plan.code} />
                        <input type="hidden" name="billingCycle" value="yearly" />
                        <input type="hidden" name="channel" value="alipay" />
                        <button className="w-full cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-blue-50">
                          支付宝年付
                        </button>
                      </form>
                    </div>
                  )}
                  <form action={createBankOrderAction}>
                    <input type="hidden" name="planCode" value={plan.code} />
                    <input type="hidden" name="billingCycle" value={plan.priceYearly !== null ? "yearly" : "monthly"} />
                    <button className="w-full cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900">
                      对公转账订购
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        套餐价格与权益为 v1 草案，上线前会根据转化数据校准。微信/支付宝扫码支付成功后自动开通；对公订单仍由管理员确认后开通。
      </p>
      <Link href="/list" className="text-sm text-accent hover:underline">
        返回信息检索
      </Link>
    </div>
  );
}
