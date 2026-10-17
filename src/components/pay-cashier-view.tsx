"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import PaymentStatusPoller from "./payment-status-poller";
import BankProofForm from "./bank-proof-form";
import {
  BuildingIcon,
  DocumentTextIcon,
  CheckIcon,
  ClipboardIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "./icons";
import { notifyOrderPaidAction } from "@/app/actions/payments";

interface PayCashierViewProps {
  order: {
    id: number;
    orderNo: string;
    amount: number;
    channel: string;
    status: string;
    billingCycle: string;
    matchingCode: string | null;
    paidAt: string | null;
    note: string | null;
    auditStatus: string;
    auditNote: string | null;
    plan: {
      name: string;
      code: string;
    };
  };
  user: {
    name?: string | null;
    username: string;
  };
  wechatQrDataUrl: string | null;
  alipayQrDataUrl: string | null;
  cashierQrDataUrl?: string | null;
  companyConfig: {
    companyName: string;
    bankName: string;
    bankAccount: string;
    bankBranchCode: string;
    taxNumber?: string;
  };
  isJeepayEnabled?: boolean;
  payUrl?: string | null;
}

export default function PayCashierView({
  order,
  user,
  wechatQrDataUrl,
  alipayQrDataUrl,
  cashierQrDataUrl,
  companyConfig,
  isJeepayEnabled = false,
  payUrl = null,
}: PayCashierViewProps) {
  // 默认激活 Tab：若下单渠道为 bank 则默认对公转账，否则默认手机扫码快捷付
  const [activeTab, setActiveTab] = useState<"qr" | "bank">(
    order.channel === "bank" ? "bank" : "qr",
  );
  // 二维码渠道选择：wechat | alipay | jeepay
  const [qrChannel, setQrChannel] = useState<"wechat" | "alipay" | "jeepay">(
    order.channel === "alipay"
      ? "alipay"
      : order.channel === "jeepay"
        ? "jeepay"
        : "wechat",
  );

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isNotifying, startNotifyTransition] = useTransition();
  const [clientStatus, setClientStatus] = useState<string | null>(null);
  const [noticeSubmitted, setNoticeSubmitted] = useState(false);
  const [noticeError, setNoticeError] = useState("");

  const matchingCode = order.matchingCode || "8921";
  const activeQrUrl =
    order.channel === "jeepay"
      ? cashierQrDataUrl || wechatQrDataUrl || alipayQrDataUrl
      : qrChannel === "wechat"
        ? wechatQrDataUrl
        : alipayQrDataUrl;

  const currentStatus = clientStatus ?? order.status;
  const isPaid = currentStatus === "PAID" || order.status === "PAID";
  const isWaitVerify =
    currentStatus === "WAIT_VERIFY" ||
    order.status === "WAIT_VERIFY" ||
    noticeSubmitted;
  const isRejected = order.auditStatus === "REJECTED";

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleNotifyPaid = () => {
    setNoticeError("");
    startNotifyTransition(async () => {
      const res = await notifyOrderPaidAction({
        orderNo: order.orderNo,
        channel:
          activeTab === "bank"
            ? "bank"
            : order.channel === "jeepay"
              ? "jeepay"
              : qrChannel,
      });
      if (res.success) {
        setNoticeSubmitted(true);
        setClientStatus("WAIT_VERIFY");
      } else {
        setNoticeError(res.error || "提交通知失败，请稍后重试");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 支付成功状态展示 */}
      {isPaid ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircleIcon className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-emerald-950">
            款项已核对入账，套餐权限已全额开通！
          </h2>
          <p className="mt-2 text-sm text-emerald-700">
            感谢您选用标讯通！您的 {order.plan.name}（
            {order.billingCycle === "monthly" ? "月付" : "年付"}）权益已即刻生效。
          </p>
          {order.paidAt && (
            <p className="mt-1 font-mono text-xs text-emerald-600">
              核销生效时间：{new Date(order.paidAt).toLocaleString("zh-CN")}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/list"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-strong"
            >
              立即进入标讯检索
            </Link>
            <Link
              href={`/contract/${order.orderNo}`}
              target="_blank"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              <DocumentTextIcon className="mr-1.5 h-4 w-4" />
              下载盖章电子采购合同
            </Link>
            <Link
              href="/invoices"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              申请增值税发票
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 状态通报栏：待核验 / 被驳回 */}
          {isWaitVerify ? (
            <div className="rounded-xl border border-blue-300 bg-blue-50/90 p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <ClockIcon className="h-5 w-5 animate-spin" />
                </div>
                <div className="flex-1 text-xs text-blue-950">
                  <div className="font-bold text-sm text-blue-900">
                    已收到您的支付通知，财务专员正在核对入账流水
                  </div>
                  <p className="mt-1 text-blue-800 leading-relaxed">
                    系统已向财务管理终端发送即时核验工单。只要您的转账附言中填写了专属识别码{" "}
                    <span className="font-mono font-bold text-red-600 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                      {matchingCode}
                    </span>
                    ，通常将在 1~5 分钟内完成放行。页面将自动刷新，无需反复重填！
                  </p>
                </div>
              </div>
            </div>
          ) : isRejected ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs text-red-900">
                <AlertCircleIcon className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <span className="font-bold">上次转账审核未通过：</span>
                  <span>{order.auditNote || "未匹配到对应流水，请核实后重新提交。"}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* 核心双轨收银台 */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs">
            {/* 顶栏 Tab 切换 */}
            <div className="flex border-b border-slate-200 bg-slate-50/60 p-1.5 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("qr")}
                className={`flex-1 cursor-pointer rounded-lg py-2.5 text-center transition-all ${
                  activeTab === "qr"
                    ? "bg-white text-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ① 手机扫码快捷付（个人微信 / 支付宝）
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bank")}
                className={`flex-1 cursor-pointer rounded-lg py-2.5 text-center transition-all ${
                  activeTab === "bank"
                    ? "bg-white text-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ② 企业对公转账（网银电汇与盖章合同）
              </button>
            </div>

            <div className="p-6">
              {activeTab === "qr" ? (
                /* Tab 1: 手机扫码快捷付 */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  {/* 左侧：二维码展示区 */}
                  <div className="flex flex-col items-center text-center">
                    {/* 微信 / 支付宝切换子标签 */}
                    {order.channel === "jeepay" ? (
                      <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
                        <span>聚合扫码（微信 / 支付宝 / 云闪付通用）</span>
                      </div>
                    ) : (
                      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setQrChannel("wechat")}
                          className={`cursor-pointer rounded-md px-3.5 py-1.5 transition ${
                            qrChannel === "wechat"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          微信扫码
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrChannel("alipay")}
                          className={`cursor-pointer rounded-md px-3.5 py-1.5 transition ${
                            qrChannel === "alipay"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          支付宝扫码
                        </button>
                      </div>
                    )}

                    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      {activeQrUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={activeQrUrl}
                          alt="支付二维码"
                          className="h-56 w-56 object-contain mx-auto"
                        />
                      ) : (
                        <div className="flex h-56 w-56 flex-col items-center justify-center bg-slate-50 text-xs text-slate-400">
                          收款二维码加载中...
                        </div>
                      )}
                      <div className="mt-2 text-[11px] font-semibold text-slate-700">
                        收款单位：{companyConfig.companyName}
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      {order.channel === "jeepay"
                        ? `请使用手机 微信、支付宝或云闪付 扫描上方二维码支付 ¥${order.amount.toFixed(2)}`
                        : `请使用手机 ${qrChannel === "wechat" ? "微信" : "支付宝"} 扫描上方二维码支付 ¥${order.amount.toFixed(2)}`}
                    </p>

                    {/* 在浏览器中直接打开付款页面按钮 (payUrl) */}
                    {payUrl && (
                      <div className="mt-3">
                        <a
                          href={payUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary shadow-xs transition hover:bg-primary/10 hover:border-primary/50"
                        >
                          <span>在浏览器中直接打开付款页面 →</span>
                        </a>
                      </div>
                    )}

                    {/* Jeepay 聚合支付安全托管徽章 */}
                    {isJeepayEnabled && (
                      <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3.5 py-1 text-[11px] font-medium text-emerald-800 shadow-2xs">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        <span>由 Jeepay 聚合支付安全托管 · 支付成功秒级自动开通</span>
                      </div>
                    )}
                  </div>

                  {/* 右侧：附言识别码与付款通知操作 */}
                  <div className="space-y-5">
                    {/* 专属附言识别码卡片 */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                      <div className="text-xs font-bold text-amber-900">
                        ⚡ 关键步骤：转账务必填写「专属核销识别码」
                      </div>
                      <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                        付款时请在微信/支付宝转账界面的【添加备注 / 付款说明】栏中填入下方识别码：
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 rounded-lg border border-amber-300 bg-white px-4 py-2 font-mono text-2xl font-black text-red-600 tracking-widest text-center shadow-inner">
                          {matchingCode}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(matchingCode, "matchingCode")}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-amber-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700 shrink-0"
                        >
                          {copiedKey === "matchingCode" ? (
                            <>
                              <CheckIcon className="h-4 w-4" />
                              已复制
                            </>
                          ) : (
                            <>
                              <ClipboardIcon className="h-4 w-4" />
                              一键复制
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 我已完成支付确认按钮 */}
                    <div className="space-y-3 pt-2">
                      <button
                        type="button"
                        onClick={handleNotifyPaid}
                        disabled={isNotifying || isWaitVerify}
                        className={`w-full cursor-pointer rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm transition flex items-center justify-center gap-2 ${
                          isWaitVerify
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-primary hover:bg-primary-strong active:scale-[0.99]"
                        }`}
                      >
                        {isNotifying ? (
                          <>
                            <ClockIcon className="h-4 w-4 animate-spin" />
                            正在向财务终端发送核验通知...
                          </>
                        ) : isWaitVerify ? (
                          <>
                            <CheckCircleIcon className="h-4 w-4" />
                            已提交支付通知，请稍候入账
                          </>
                        ) : (
                          <>
                            <CheckIcon className="h-4 w-4" />
                            我已扫码转账，通知财务秒级开通
                          </>
                        )}
                      </button>

                      {noticeError && (
                        <p className="text-xs text-red-600 font-medium text-center">
                          {noticeError}
                        </p>
                      )}

                      <PaymentStatusPoller
                        orderNo={order.orderNo}
                        initialStatus={currentStatus}
                        onStatusChange={(newStatus) => {
                          setClientStatus(newStatus);
                          if (newStatus === "WAIT_VERIFY") {
                            setNoticeSubmitted(true);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Tab 2: 企业对公转账 */
                <div className="space-y-6">
                  {/* 对公四要素银行卡片 */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5">
                    <div className="flex items-center justify-between border-b border-blue-200/70 pb-3">
                      <div className="flex items-center gap-2">
                        <BuildingIcon className="h-5 w-5 text-blue-700" />
                        <h3 className="text-sm font-bold text-blue-950">
                          官方对公收款银行账户信息（支持全国所有企业网银转账）
                        </h3>
                      </div>
                      <Link
                        href={`/contract/${order.orderNo}`}
                        target="_blank"
                        className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1"
                      >
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        <span>下载盖章采购合同PDF →</span>
                      </Link>
                    </div>

                    <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <dt className="text-slate-500">收款单位全称（户名）</dt>
                        <dd className="mt-1 flex items-center justify-between font-bold text-slate-900 bg-white p-2 rounded border border-blue-100">
                          <span className="select-all">{companyConfig.companyName}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(companyConfig.companyName, "compName")
                            }
                            className="text-primary hover:underline text-[11px]"
                          >
                            {copiedKey === "compName" ? "已复制" : "复制"}
                          </button>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">开户银行名称</dt>
                        <dd className="mt-1 flex items-center justify-between font-bold text-slate-900 bg-white p-2 rounded border border-blue-100">
                          <span className="select-all">{companyConfig.bankName}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(companyConfig.bankName, "bankName")
                            }
                            className="text-primary hover:underline text-[11px]"
                          >
                            {copiedKey === "bankName" ? "已复制" : "复制"}
                          </button>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">对公银行账号</dt>
                        <dd className="mt-1 flex items-center justify-between font-bold font-mono text-sm text-blue-900 bg-white p-2 rounded border border-blue-100">
                          <span className="select-all">{companyConfig.bankAccount}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(companyConfig.bankAccount, "account")
                            }
                            className="text-primary hover:underline text-[11px]"
                          >
                            {copiedKey === "account" ? "已复制" : "复制"}
                          </button>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">大额支付联行行号</dt>
                        <dd className="mt-1 flex items-center justify-between font-bold font-mono text-slate-900 bg-white p-2 rounded border border-blue-100">
                          <span className="select-all">{companyConfig.bankBranchCode}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(companyConfig.bankBranchCode, "branch")
                            }
                            className="text-primary hover:underline text-[11px]"
                          >
                            {copiedKey === "branch" ? "已复制" : "复制"}
                          </button>
                        </dd>
                      </div>

                      <div className="sm:col-span-2 rounded-lg bg-amber-50 p-3 border border-amber-200 text-amber-950">
                        <div className="font-bold flex items-center gap-1 text-xs">
                          <span>⚠️ 网银转账汇款时，请务必在附言 / 摘要栏填写识别码：</span>
                          <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300 text-red-600 text-sm select-all">
                            {matchingCode}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-amber-800">
                          银行流水通过附言识别码自动对齐，极大缩短入账审核周期。
                        </p>
                      </div>
                    </dl>
                  </div>

                  {/* 银行转账水单凭证登记 */}
                  <BankProofForm
                    orderNo={order.orderNo}
                    defaultPayerName={user.name || user.username}
                    existingNote={order.note}
                  />

                  <div className="pt-2">
                    <PaymentStatusPoller
                      orderNo={order.orderNo}
                      initialStatus={currentStatus}
                      onStatusChange={(newStatus) => {
                        setClientStatus(newStatus);
                        if (newStatus === "WAIT_VERIFY") {
                          setNoticeSubmitted(true);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
