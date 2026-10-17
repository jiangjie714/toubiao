import Link from "next/link";
import {
  BuildingIcon,
  CheckIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@/components/icons";

export interface EnterprisePaywallProps {
  title: string;
  description: string;
  badge?: string;
  features?: string[];
  backHref?: string;
  backText?: string;
}

export default function EnterprisePaywall({
  title,
  description,
  badge = "企业版专属特权",
  features = [
    "3~10 独立团队账号席位，全员白金权益共享与分权协作",
    "企业微信 / 钉钉 / 飞书群机器人秒级实时事件推送到作战群",
    "投标全流程风险拦截（资质临期预警、保证金催退、AI清标）",
    "支持企业银行公对公转账结算，提供规范《技术服务采购合同》",
    "开具“*信息技术服务*软件信息技术服务”6% 增值税专用发票抵扣税额",
  ],
  backHref = "/tracker",
  backText = "返回工作台",
}: EnterprisePaywallProps) {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50/60 via-white to-white p-8 shadow-xl shadow-amber-900/5 sm:p-12">
        {/* 顶部标签 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/80 px-3.5 py-1 text-xs font-bold text-amber-800 shadow-xs">
            <TrophyIcon className="h-3.5 w-3.5 text-amber-600" />
            {badge}
          </span>
          <span className="text-xs font-medium text-slate-500">
            支持对公转账 · 增值税专票 · 电子合同
          </span>
        </div>

        {/* 标题与简介 */}
        <div className="mt-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            {description}
          </p>
        </div>

        {/* 核心权益网格 */}
        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-surface p-6 shadow-xs">
          <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
            企业客户尊享生产力与风控护城河
          </h2>
          <ul className="mt-4 grid gap-3.5 sm:grid-cols-2">
            {features.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckIcon className="h-3 w-3" />
                </span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 为什么企业必须选对公采购 */}
        <div className="mt-6 grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-primary">
              <BuildingIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">银行对公转账</p>
              <p className="mt-1 text-[11px] leading-normal text-slate-500">
                专属对公订单识别码，支持公司财务网银直接汇款出账
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-primary">
              <DocumentTextIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">6% 增值税专用发票</p>
              <p className="mt-1 text-[11px] leading-normal text-slate-500">
                抵扣 408~1,008 元税额，严格符合金税四期合规报销
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-primary">
              <ShieldCheckIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">加盖公章技术合同</p>
              <p className="mt-1 text-[11px] leading-normal text-slate-500">
                在线一键生成防伪盖章电子合同，满足企业请款法务审核
              </p>
            </div>
          </div>
        </div>

        {/* 底部促单与操作栏 */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-200/60 pt-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <span className="text-xs text-slate-500">企业标准版起售价</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-primary tnum">¥6,800</span>
              <span className="text-xs text-slate-500">/ 年（含 3 席位与全量风控）</span>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:w-auto">
            <Link
              href={backHref}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {backText}
            </Link>
            <Link
              href="/pricing"
              className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-primary to-blue-700 px-6 py-2.5 text-center text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:brightness-110 sm:flex-none"
            >
              立即开通企业版 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
