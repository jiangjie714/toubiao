"use client";

import { useState } from "react";
import QRCode from "qrcode";
import {
  testJeepayConnectionAction,
  createJeepayTestOrderAction,
  type JeepayConnectionTestResult,
  type JeepayTestOrderResult,
} from "@/app/actions/jeepay-admin";
import {
  BoltIcon,
  CreditCardIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ArrowPathIcon,
  ExternalLinkIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@/components/icons";

export interface JeepayConfigInfo {
  isConfigured: boolean;
  payUrl: string;
  mchNo: string;
  appId: string;
  maskedApiKey: string;
  notifyUrl: string;
  returnUrl?: string;
}

interface JeepayDiagnosticClientProps {
  config: JeepayConfigInfo;
}

const WAY_CODES = [
  {
    code: "ALI_PC",
    name: "支付宝支付 (ALI_PC)",
    desc: "支付宝电脑网站支付，支持扫码与新窗口直连",
  },
  {
    code: "WX_NATIVE",
    name: "微信扫码 (WX_NATIVE)",
    desc: "微信 Native 原生支付二维码",
  },
  {
    code: "QR_CASHIER",
    name: "聚合收银台",
    desc: "多端自适应扫码收银台",
  },
  {
    code: "ALI_QR",
    name: "支付宝当面付 (ALI_QR)",
    desc: "支付宝原生当面付条码/二维码",
  },
];

export default function JeepayDiagnosticClient({
  config,
}: JeepayDiagnosticClientProps) {
  // 连通性测试状态
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] =
    useState<JeepayConnectionTestResult | null>(null);

  // 测试订单状态
  const [selectedWayCode, setSelectedWayCode] = useState("ALI_PC");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<JeepayTestOrderResult | null>(
    null
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showJsonRaw, setShowJsonRaw] = useState(false);

  // 执行一键连通性测试
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await testJeepayConnectionAction();
      setConnectionResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConnectionResult({
        success: false,
        message: msg || "连通性测试遇到异常",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // 执行创建 0.01 元测试订单
  const handleCreateTestOrder = async () => {
    setCreatingOrder(true);
    setOrderResult(null);
    setQrCodeDataUrl(null);

    try {
      const res = await createJeepayTestOrderAction(selectedWayCode);
      setOrderResult(res);

      if (res.success && res.payData) {
        // 使用 qrcode 生成用于实时手机扫码的 base64 图片 (高分辨率与适度边距，保证手机扫码高识别率)
        const dataUrl = await QRCode.toDataURL(res.payData, {
          width: 280,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });
        setQrCodeDataUrl(dataUrl);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOrderResult({
        success: false,
        error: msg || "发起测试订单异常",
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部：当前网关环境变量状态 */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                config.isConfigured
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <ShieldCheckIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Jeepay 支付中心环境配置
              </h2>
              <p className="text-xs text-slate-500">
                服务接入环境变量状态与基础网关路由配置
              </p>
            </div>
          </div>
          <div>
            {config.isConfigured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                已就绪 (Configured)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <AlertCircleIcon className="h-4 w-4" />
                未完整配置 (.env 缺失)
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">网关地址 (JEEPAY_PAY_URL)</div>
            <div className="mt-1 font-mono font-medium text-slate-800 break-all">
              {config.payUrl}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">商户号 (JEEPAY_MCH_NO)</div>
            <div className="mt-1 font-mono font-medium text-slate-800 break-all">
              {config.mchNo}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">应用 ID (JEEPAY_APP_ID)</div>
            <div className="mt-1 font-mono font-medium text-slate-800 break-all">
              {config.appId}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">API 签名密钥 (JEEPAY_API_KEY)</div>
            <div className="mt-1 font-mono font-medium text-slate-800 break-all">
              {config.maskedApiKey}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">异步通知 (JEEPAY_NOTIFY_URL)</div>
            <div className="mt-1 font-mono font-medium text-slate-800 break-all">
              {config.notifyUrl}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">跳转返回 (JEEPAY_RETURN_URL)</div>
            <div className="mt-1 font-mono font-medium text-slate-800 break-all">
              {config.returnUrl || "未配置 (默认原路返回)"}
            </div>
          </div>
        </div>
      </section>

      {/* 中部双列：连通性诊断 + 测试联调下单 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 工具 1: 一键连通性测试 */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-surface p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <BoltIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  一键连通性测试
                </h3>
                <p className="text-xs text-slate-500">
                  向网关发送探针报文，校验 HTTP 响应、MD5 签名与商户连通性
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50/80 p-3.5 text-xs text-slate-600 space-y-1.5">
              <p>• 探针接口：POST {config.payUrl}/api/pay/query</p>
              <p>• 探针机制：发送合规签名的探针单号 `PROBE_PING`</p>
              <p>• 验证标准：网关返回 200 HTTP 响应且无验签报错即确认正常</p>
            </div>

            {/* 连通性测试结果展示 */}
            {connectionResult && (
              <div
                className={`mt-4 rounded-lg border p-4 text-xs ${
                  connectionResult.success
                    ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                    : "border-red-200 bg-red-50/70 text-red-900"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {connectionResult.success ? (
                    <CheckCircleIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircleIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-600" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-sm">
                      {connectionResult.success ? "连通正常" : "连接失败"}
                    </div>
                    <div>{connectionResult.message}</div>
                    {typeof connectionResult.latencyMs === "number" && (
                      <div className="flex items-center gap-1.5 pt-1 text-slate-600 font-medium">
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span>网关网络延迟：</span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[11px] tnum ${
                            connectionResult.latencyMs < 300
                              ? "bg-emerald-100 text-emerald-800"
                              : connectionResult.latencyMs < 1000
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {connectionResult.latencyMs} ms
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {Boolean(connectionResult.data) && (
                  <div className="mt-3 border-t border-emerald-200/60 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowJsonRaw(!showJsonRaw)}
                      className="cursor-pointer text-[11px] font-semibold text-emerald-700 underline hover:text-emerald-900"
                    >
                      {showJsonRaw ? "收起网关返回详情" : "查看网关原始返回报文"}
                    </button>
                    {showJsonRaw && (
                      <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-slate-900 p-2 text-[11px] font-mono text-slate-100">
                        {JSON.stringify(connectionResult.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testingConnection ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  <span>正在请求 Jeepay 网关...</span>
                </>
              ) : (
                <>
                  <BoltIcon className="h-4 w-4" />
                  <span>一键连通性测试</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* 工具 2: 生成 0.01 元测试二维码 */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-surface p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CreditCardIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  生成 0.01 元测试二维码
                </h3>
                <p className="text-xs text-slate-500">
                  创建小额联调单，现场扫码检验 Native / 收银台通道与 Webhook 闭环
                </p>
              </div>
            </div>

            {/* 支付通道选择 */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                测试支付渠道 (Way Code)
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {WAY_CODES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setSelectedWayCode(item.code)}
                    className={`cursor-pointer rounded-lg border p-2.5 text-left transition ${
                      selectedWayCode === item.code
                        ? "border-primary bg-blue-50/50 text-primary"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-xs">{item.name}</div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {item.code}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 测试订单结果与二维码展示 */}
            {orderResult && (
              <div className="mt-4">
                {orderResult.success ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    {/* 顶部状态与渠道信息 */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span>测试下单成功</span>
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-800">
                          ¥0.01
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-400">当前通道:</span>
                        <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {selectedWayCode}
                        </span>
                      </div>
                    </div>

                    {/* 核心二维码呈现区：居中独立卡片，彻底规避挤压与裁切 */}
                    <div className="my-5 flex flex-col items-center justify-center">
                      {qrCodeDataUrl ? (
                        <div className="flex flex-col items-center">
                          <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-md transition hover:shadow-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={qrCodeDataUrl}
                              alt="0.01元联调支付二维码"
                              className="h-48 w-48 object-contain block shrink-0"
                            />
                          </div>
                          <p className="mt-2.5 text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <span>📱 请使用手机支付宝/微信扫码完成支付</span>
                          </p>
                        </div>
                      ) : (
                        <div className="flex h-48 w-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-xs text-slate-400">
                          暂无二维码数据
                        </div>
                      )}

                      {/* 电脑端直连跳转链接 */}
                      {orderResult.payData?.startsWith("http") && (
                        <div className="mt-3.5">
                          <a
                            href={orderResult.payData}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-primary-strong active:scale-95"
                          >
                            <span>在新窗口直接打开付款页面 (电脑端支付)</span>
                            <ExternalLinkIcon className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* 底部：订单明细与原始参数（防溢出容器） */}
                    <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-2 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">支付系统单号:</span>
                        <span className="font-mono font-medium text-slate-900 select-all break-all">
                          {orderResult.payOrderId}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">返回数据类型:</span>
                        <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] text-slate-800 font-semibold">
                          {orderResult.payDataType}
                        </span>
                      </div>
                      {orderResult.payData && (
                        <div className="pt-1.5 border-t border-slate-200/60">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span>支付地址/参数内容:</span>
                            <span className="text-[10px] text-slate-400">已自动换行防截断</span>
                          </div>
                          <div className="max-h-24 overflow-y-auto rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-600 break-all select-all">
                            {orderResult.payData}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                    <AlertCircleIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-600" />
                    <div>
                      <div className="font-bold text-sm">发起测试订单失败</div>
                      <div className="mt-1 text-red-700">{orderResult.error}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCreateTestOrder}
              disabled={creatingOrder}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingOrder ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  <span>正在生成测试订单...</span>
                </>
              ) : (
                <>
                  <CreditCardIcon className="h-4 w-4" />
                  <span>生成 0.01 元测试二维码</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
