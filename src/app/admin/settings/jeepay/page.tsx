import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJeepayConfig, isJeepayConfigured } from "@/lib/jeepay";
import JeepayDiagnosticClient, {
  type JeepayConfigInfo,
} from "@/components/admin/jeepay-diagnostic-client";
import { BoltIcon, DocumentTextIcon } from "@/components/icons";

export const metadata = {
  title: "Jeepay 支付联调与诊断 - 标讯通管理后台",
};

const STATUS_STYLE: Record<string, string> = {
  RECEIVED: "bg-blue-50 text-blue-700",
  PROCESSED: "bg-emerald-50 text-emerald-600",
  FAILED: "bg-red-50 text-red-600",
};

export default async function JeepaySettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/admin");
  }

  // 获取最近 10 条 Jeepay 回调事件流水
  const events = await prisma.paymentEvent.findMany({
    where: { provider: "jeepay" },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  // 提取环境变量配置（脱敏 apiKey）
  const rawConfig = getJeepayConfig();
  const configInfo: JeepayConfigInfo = {
    isConfigured: isJeepayConfigured(),
    payUrl: rawConfig?.payUrl || process.env.JEEPAY_PAY_URL || "未配置",
    mchNo: rawConfig?.mchNo || process.env.JEEPAY_MCH_NO || "未配置",
    appId: rawConfig?.appId || process.env.JEEPAY_APP_ID || "未配置",
    maskedApiKey: rawConfig?.apiKey
      ? rawConfig.apiKey.length > 8
        ? `${rawConfig.apiKey.slice(0, 4)}••••••••${rawConfig.apiKey.slice(-4)}`
        : "••••••••"
      : "未配置",
    notifyUrl:
      rawConfig?.notifyUrl ||
      process.env.JEEPAY_NOTIFY_URL ||
      "http://127.0.0.1:3000/api/payment/jeepay/notify",
    returnUrl:
      rawConfig?.returnUrl || process.env.JEEPAY_RETURN_URL || undefined,
  };

  return (
    <div className="space-y-6">
      {/* 头部标题区 */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Jeepay 支付中心联调与诊断
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          集中管理 Jeepay 开源支付中心对接状态，支持一键连通性探针测试、0.01
          元扫码联调以及 Webhook 异步回调审计
        </p>
      </div>

      {/* 交互式诊断组件（连通性测试 + 0.01元联调扫码） */}
      <JeepayDiagnosticClient config={configInfo} />

      {/* 下方：最近 Jeepay 支付回调流水 */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600">
              <BoltIcon className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-slate-800">
              最近 Jeepay 支付事件记录 (Payment Events)
            </h2>
          </div>
          <span className="text-xs text-slate-400">保留最新 10 条流水</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">接收时间</th>
                <th className="px-5 py-3 font-medium">事件 ID (PayOrderId)</th>
                <th className="px-5 py-3 font-medium">商户订单号</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">处理时间 / 错误说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="transition-colors duration-150 hover:bg-blue-50/40"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 tnum">
                    {event.receivedAt.toLocaleString("zh-CN")}
                  </td>
                  <td
                    className="max-w-[200px] truncate px-5 py-3.5 font-mono text-xs text-slate-600"
                    title={event.providerEventId}
                  >
                    {event.providerEventId}
                  </td>
                  <td
                    className="max-w-[180px] truncate px-5 py-3.5 font-mono text-xs text-slate-700"
                    title={event.orderNo ?? "-"}
                  >
                    {event.orderNo ?? "-"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[event.status] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-5 py-3.5 text-xs text-slate-500">
                    {event.processedAt?.toLocaleString("zh-CN") ?? "-"}
                    {event.error && (
                      <span
                        className="mt-1 block truncate text-red-500"
                        title={event.error}
                      >
                        {event.error}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    暂无 Jeepay 回调事件。完成测试扫码支付后将在此自动刷新流水。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 底部：本地部署与配置说明卡片 */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5 text-xs text-slate-600">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-semibold text-slate-800">
          <DocumentTextIcon className="h-4 w-4 text-primary" />
          <span>Jeepay 本地私有化部署与联调指南</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <div className="font-semibold text-slate-900">1. 服务端口规划</div>
            <ul className="list-inside list-disc space-y-1 text-slate-500">
              <li>
                <strong className="text-slate-700">9217:</strong> 支付网关服务
                (jeepay-payment)，即 <code className="text-slate-800 font-mono">JEEPAY_PAY_URL</code>
              </li>
              <li>
                <strong className="text-slate-700">9218:</strong> 运营运营平台
                (jeepay-manager)，配置商户与渠道
              </li>
              <li>
                <strong className="text-slate-700">9219:</strong> 商户自服务后台
                (jeepay-merchant)，管理应用与 API Key
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-900">
              2. 渠道与应用配置
            </div>
            <ul className="list-inside list-disc space-y-1 text-slate-500">
              <li>
                进入商户平台 (9219)，在「应用列表」新建应用并生成 32 位{" "}
                <code className="text-slate-800 font-mono">apiKey</code>
              </li>
              <li>
                在应用的「支付配置」中开通相应通道：推荐开通{" "}
                <code className="text-slate-800 font-mono">QR_CASHIER</code>、
                <code className="text-slate-800 font-mono">WX_NATIVE</code> 或{" "}
                <code className="text-slate-800 font-mono">ALI_QR</code>
              </li>
              <li>本地联调可挂载沙箱通道或模拟支付插件快速验证。</li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-900">
              3. Webhook 异步回调网络
            </div>
            <ul className="list-inside list-disc space-y-1 text-slate-500">
              <li>
                系统内置回调端点：
                <code className="text-slate-800 font-mono">
                  /api/payment/jeepay/notify
                </code>
              </li>
              <li>
                若 Jeepay 运行于 Docker 容器中，请勿将通知 URL 设为{" "}
                <code className="text-slate-800 font-mono">127.0.0.1</code>，可使用
                宿主机桥接 IP 或内网穿透工具。
              </li>
              <li>接收到回调后，系统将自动进行签名校验、幂等防重放及订阅开通。</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
