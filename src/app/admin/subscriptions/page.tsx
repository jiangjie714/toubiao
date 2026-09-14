import Link from "next/link";
import { getSubscriptionAnalytics } from "@/lib/subscription-analytics";
import SubscriptionActionModal from "@/components/admin/subscription-action-modal";
import {
  ClockIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  SearchIcon,
  BoltIcon,
} from "@/components/icons";

export const metadata = {
  title: "订阅与流失分析看板 - 管理后台",
  description: "全站商业化付费订阅全景、经常性收入 MRR/ARR 与临期防流失预警",
};

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: "all" | "active" | "urgent" | "warning" | "expired";
    plan?: string;
    q?: string;
  }>;
}) {
  const { status = "all", plan = "all", q = "" } = await searchParams;

  const data = await getSubscriptionAnalytics({
    statusFilter: status,
    planFilter: plan,
    searchQuery: q,
  });

  const cards = [
    {
      label: "月度经常性收入 (MRR)",
      value: `¥${data.totalMrr.toLocaleString("zh-CN")}`,
      sub: `年化预期 ARR: ¥${data.totalArr.toLocaleString("zh-CN")}`,
      Icon: ChartBarIcon,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "活跃付费客户 (Active)",
      value: `${data.activeCount} 家`,
      sub: `客户留存率: ${data.retentionRate}%`,
      Icon: ShieldCheckIcon,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "7天内紧急到期 (Urgent)",
      value: `${data.urgent7DaysCount} 家`,
      sub: "加急外呼 / 重点挽留",
      Icon: ClockIcon,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: "30天内续约池 (Renewal)",
      value: `${data.warning30DaysCount} 家`,
      sub: "月度续费关怀跟进",
      Icon: BoltIcon,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 头部标题与描述 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            订阅与流失分析看板
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            全生命周期监控企业客户订阅状态、MRR经常性收入核算、到期流失预警与客户成功延期
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <span>查看订单流转 →</span>
          </Link>
        </div>
      </div>

      {/* 4 大核心指标卡片分段带 */}
      <section className="grid grid-cols-2 divide-slate-100 rounded-xl border border-slate-200 bg-surface xl:grid-cols-4 xl:divide-x">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={`flex items-center gap-4 px-6 py-5 ${
              i % 2 === 1 ? "max-xl:border-l max-xl:border-slate-100" : ""
            } ${i >= 2 ? "max-xl:border-t max-xl:border-slate-100" : ""}`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${c.tone}`}
            >
              <c.Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-slate-900 tnum leading-7">
                {c.value}
              </div>
              <div className="text-xs text-slate-500 font-medium">{c.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{c.sub}</div>
            </div>
          </div>
        ))}
      </section>

      {/* 套餐分布与营收构成卡片 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-800">
              各套餐席位分布与 MRR 贡献
            </h2>
            <span className="text-xs text-slate-400">
              平均客单价 ARPU: ¥{data.averageArpu} /月
            </span>
          </div>
          <div className="mt-4 space-y-3.5">
            {data.planDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">暂无付费套餐分布数据</p>
            ) : (
              data.planDistribution.map((item) => (
                <div key={item.planCode} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {item.planName} ({item.planCode})
                    </span>
                    <span className="font-mono text-slate-500">
                      {item.count} 家 ({item.percentage}%) · 贡献 MRR: ¥{item.monthlyMrr}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(5, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-800">
              续约流失预警队列
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-rose-50/70 p-3 text-xs">
              <span className="font-medium text-rose-800">7 天内紧急到期</span>
              <span className="font-bold font-mono text-rose-700 text-sm">
                {data.urgent7DaysCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50/70 p-3 text-xs">
              <span className="font-medium text-amber-800">30 天内待续费</span>
              <span className="font-bold font-mono text-amber-700 text-sm">
                {data.warning30DaysCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50/70 p-3 text-xs">
              <span className="font-medium text-emerald-800">稳定服务期 (30天+)</span>
              <span className="font-bold font-mono text-emerald-700 text-sm">
                {Math.max(0, data.activeCount - data.urgent7DaysCount - data.warning30DaysCount)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 text-xs">
              <span className="font-medium text-slate-700">已过期流失客户</span>
              <span className="font-bold font-mono text-slate-600 text-sm">
                {data.expiredCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索与过滤工具栏 */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* 状态 Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "all", label: `全部 (${data.totalCount})` },
            { key: "active", label: `生效中 (${data.activeCount})` },
            { key: "urgent", label: `7天内到期 (${data.urgent7DaysCount})` },
            { key: "warning", label: `30天内到期 (${data.warning30DaysCount})` },
            { key: "expired", label: `已过期 (${data.expiredCount})` },
          ].map((tab) => {
            const isActive = status === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/admin/subscriptions?status=${tab.key}&plan=${plan}&q=${encodeURIComponent(q)}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-blue-50 text-primary"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* 搜索框 */}
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="plan" value={plan} />
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="搜索企业/用户名/手机/邮箱"
              className="h-8 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
          >
            筛选
          </button>
        </form>
      </div>

      {/* 客户订阅清单表格 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-2xs">
        <table className="data-table w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">客户信息</th>
              <th className="px-5 py-3 font-medium">当前套餐规格</th>
              <th className="px-5 py-3 font-medium">月经常性贡献 (MRR)</th>
              <th className="px-5 py-3 font-medium">订阅状态</th>
              <th className="px-5 py-3 font-medium">服务有效期限</th>
              <th className="px-5 py-3 font-medium">临期预警</th>
              <th className="px-5 py-3 font-medium text-right">客户成功操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-400">
                  没有匹配的订阅记录
                </td>
              </tr>
            ) : (
              data.subscriptions.map((sub) => {
                const subMrr =
                  sub.billingCycle === "yearly"
                    ? Math.round(sub.priceYearly / 12)
                    : sub.priceMonthly;

                return (
                  <tr key={sub.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">
                        {sub.userName}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        @{sub.userUsername}
                      </div>
                      {sub.userEmail && (
                        <div className="text-[11px] text-slate-400">{sub.userEmail}</div>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-blue-700/10">
                        {sub.planName}
                      </span>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {sub.billingCycle === "yearly" ? "按年计费 (Yearly)" : "按月计费 (Monthly)"}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="font-mono font-semibold text-slate-900">
                        ¥{subMrr} <span className="text-[11px] font-normal text-slate-400">/月</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sub.billingCycle === "yearly"
                          ? `年费 ¥${sub.priceYearly}`
                          : `月费 ¥${sub.priceMonthly}`}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      {sub.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          生效中
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          已流失/已过期
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <div>起：{new Date(sub.startsAt).toLocaleDateString("zh-CN")}</div>
                      <div className="mt-0.5 font-medium">
                        止：{sub.endsAt ? new Date(sub.endsAt).toLocaleDateString("zh-CN") : "长期有效"}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      {sub.urgencyLevel === "urgent" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                          <ClockIcon className="h-3.5 w-3.5" />
                          剩 {sub.daysRemaining} 天 (加急)
                        </span>
                      ) : sub.urgencyLevel === "warning" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                          <ClockIcon className="h-3.5 w-3.5" />
                          剩 {sub.daysRemaining} 天 (待续)
                        </span>
                      ) : sub.urgencyLevel === "expired" ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-400">
                          已过期 {sub.daysRemaining ? Math.abs(sub.daysRemaining) : 0} 天
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          健康 ({sub.daysRemaining ? `${sub.daysRemaining} 天` : "无限期"})
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <SubscriptionActionModal
                        userId={sub.userId}
                        userName={sub.userName}
                        currentPlanCode={sub.planCode}
                        currentPlanName={sub.planName}
                        currentEndsAt={sub.endsAt}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
