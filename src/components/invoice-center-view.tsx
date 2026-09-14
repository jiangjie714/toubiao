"use client";

import React, { useState, useTransition } from "react";
import {
  type InvoiceCenterDataResult,
  type InvoiceItem,
  type InvoicableOrderItem,
  type InvoiceProfileItem,
  applyInvoiceAction,
  cancelInvoiceAction,
  saveInvoiceProfileAction,
} from "@/app/actions/invoice";
import InvoiceElectronicSheet from "@/components/invoice-electronic-sheet";
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldAlertIcon,
  PlusIcon,
  BuildingIcon,
} from "@/components/icons";

interface Props {
  initialData: InvoiceCenterDataResult;
  userName?: string;
}

export default function InvoiceCenterView({ initialData }: Props) {
  const data = initialData;
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"invoices" | "orders">("invoices");

  // 查看电子发票弹窗
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceItem | null>(null);

  // 申请发票弹窗
  const [selectedOrder, setSelectedOrder] = useState<InvoicableOrderItem | null>(null);
  const [applyType, setApplyType] = useState<"NORMAL" | "SPECIAL">("NORMAL");
  const [applyTitle, setApplyTitle] = useState("");
  const [applyTaxNumber, setApplyTaxNumber] = useState("");
  const [applyBankName, setApplyBankName] = useState("");
  const [applyBankAccount, setApplyBankAccount] = useState("");
  const [applyAddress, setApplyAddress] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applySaveProfile, setApplySaveProfile] = useState(true);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");

  // 常用抬头管理抽屉
  const [showProfilesModal, setShowProfilesModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<InvoiceProfileItem | null>(null);
  const [profTitle, setProfTitle] = useState("");
  const [profTaxNumber, setProfTaxNumber] = useState("");
  const [profBankName, setProfBankName] = useState("");
  const [profBankAccount, setProfBankAccount] = useState("");
  const [profAddress, setProfAddress] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profEmail, setProfEmail] = useState("");
  const [profType, setProfType] = useState<"NORMAL" | "SPECIAL">("NORMAL");
  const [profError, setProfError] = useState("");

  const invoices = data.invoices || [];
  const orders = data.invoicableOrders || [];
  const profiles = data.profiles || [];
  const stats = data.stats || { totalInvoicedAmount: 0, pendingCount: 0, issuedCount: 0 };

  // 一键加载预设抬头
  const handleSelectProfile = (p: InvoiceProfileItem) => {
    setApplyType(p.type);
    setApplyTitle(p.title);
    setApplyTaxNumber(p.taxNumber);
    setApplyBankName(p.bankName || "");
    setApplyBankAccount(p.bankAccount || "");
    setApplyAddress(p.address || "");
    setApplyPhone(p.phone || "");
    if (p.email) setApplyEmail(p.email);
  };

  // 打开开票弹窗
  const handleOpenApplyModal = (order: InvoicableOrderItem) => {
    setSelectedOrder(order);
    setApplyError("");
    setApplySuccess("");

    // 优先填入默认企业抬头
    const defaultProfile = profiles.find((p) => p.isDefault) || profiles[0];
    if (defaultProfile) {
      handleSelectProfile(defaultProfile);
    } else {
      setApplyTitle("");
      setApplyTaxNumber("");
      setApplyBankName("");
      setApplyBankAccount("");
      setApplyAddress("");
      setApplyPhone("");
      setApplyEmail("");
    }
  };

  // 提交开票申请
  const handleSubmitApply = () => {
    if (!selectedOrder) return;
    setApplyError("");
    setApplySuccess("");

    startTransition(async () => {
      const res = await applyInvoiceAction({
        orderId: selectedOrder.id,
        type: applyType,
        title: applyTitle,
        taxNumber: applyTaxNumber,
        bankName: applyBankName,
        bankAccount: applyBankAccount,
        address: applyAddress,
        phone: applyPhone,
        email: applyEmail,
        saveAsProfile: applySaveProfile,
      });

      if (!res.success) {
        setApplyError(res.error || "提交失败");
        return;
      }

      setApplySuccess("开票申请已成功提交至财务核验！");
      setTimeout(() => {
        setSelectedOrder(null);
        window.location.reload();
      }, 1200);
    });
  };

  // 撤回申请
  const handleCancelInvoice = (invoiceId: number) => {
    if (!confirm("确定要撤回此笔开票申请吗？撤回后可重新修改信息并提交。")) return;
    startTransition(async () => {
      const res = await cancelInvoiceAction(invoiceId);
      if (!res.success) {
        alert(res.error || "撤回失败");
        return;
      }
      window.location.reload();
    });
  };

  // 保存发票抬头
  const handleSaveProfile = () => {
    if (!profTitle.trim() || !profTaxNumber.trim()) {
      setProfError("发票抬头与税号为必填项");
      return;
    }
    setProfError("");

    startTransition(async () => {
      const res = await saveInvoiceProfileAction({
        id: editingProfile?.id,
        type: profType,
        title: profTitle,
        taxNumber: profTaxNumber,
        bankName: profBankName,
        bankAccount: profBankAccount,
        address: profAddress,
        phone: profPhone,
        email: profEmail,
        isDefault: true,
      });

      if (!res.success) {
        setProfError(res.error || "保存失败");
        return;
      }

      setEditingProfile(null);
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      {/* 头部面板 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50/70 via-white to-amber-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <DocumentTextIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  企业财务与发票中心
                </h1>
                <p className="text-xs text-slate-500">
                  合规增值税专用发票 / 普通发票开具、税号记忆与全国标准版式电子会计凭证在线打印
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingProfile(null);
                setProfTitle("");
                setProfTaxNumber("");
                setProfBankName("");
                setProfBankAccount("");
                setProfAddress("");
                setProfPhone("");
                setProfEmail("");
                setShowProfilesModal(true);
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <BuildingIcon className="h-4 w-4 text-slate-500" />
              <span>企业常用抬头 ({profiles.length})</span>
            </button>
          </div>
        </div>

        {/* 统计指标 */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-5 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
            <span className="text-xs font-medium text-slate-500">已成功开具总金额</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-primary tnum">
                ¥{stats.totalInvoicedAmount.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400">（含 6% 增值税）</span>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
            <span className="text-xs font-medium text-slate-500">已核发电子发票</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 tnum">
                {stats.issuedCount}
              </span>
              <span className="text-xs text-slate-500">张有效凭证</span>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
            <span className="text-xs font-medium text-slate-500">财务处理中</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-2xl font-bold tracking-tight tnum ${
                  stats.pendingCount > 0 ? "text-amber-600" : "text-slate-400"
                }`}
              >
                {stats.pendingCount}
              </span>
              <span className="text-xs text-slate-500">笔待开具申请</span>
            </div>
          </div>
        </div>
      </div>

      {/* 标签栏切换 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "invoices"
              ? "bg-primary text-white font-semibold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          发票记录与电子凭证 ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "orders"
              ? "bg-primary text-white font-semibold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          可开票订购订单 ({orders.filter((o) => o.invoiceStatus === "NONE").length})
        </button>
      </div>

      {/* 发票记录视图 */}
      {activeTab === "invoices" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <DocumentTextIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">暂无发票申请记录</p>
              <p className="mt-1 text-xs text-slate-400">
                已支付成功的会员订单可切换至「可开票订购订单」发起开票申请。
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">发票类型 / 抬头</th>
                    <th className="px-6 py-3.5">纳税人识别号 (税号)</th>
                    <th className="px-6 py-3.5">价税合计 (金额)</th>
                    <th className="px-6 py-3.5">状态</th>
                    <th className="px-6 py-3.5">申请 / 开具时间</th>
                    <th className="px-6 py-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => {
                    const isIssued = inv.status === "ISSUED";
                    const isPendingState = inv.status === "PENDING";
                    const isRejected = inv.status === "REJECTED";

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              {inv.type === "SPECIAL" ? (
                                <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 border border-purple-200/60">
                                  增值税专用发票
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-primary border border-blue-200/60">
                                  增值税普通发票
                                </span>
                              )}
                              <span className="text-xs text-slate-400 font-mono">
                                单号:{inv.orderNo}
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900">{inv.title}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs text-slate-700">
                          {inv.taxNumber}
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 tnum">
                            ¥{inv.amount.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-slate-400 tnum">
                            含税率 6% (税额: ¥{inv.taxAmount.toFixed(2)})
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {isIssued && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                              已开具
                            </span>
                          )}
                          {isPendingState && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <ClockIcon className="h-3.5 w-3.5 text-amber-500" />
                              待财务开具
                            </span>
                          )}
                          {isRejected && (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                                <ShieldAlertIcon className="h-3.5 w-3.5 text-rose-500" />
                                申请被驳回
                              </span>
                              {inv.rejectReason && (
                                <span className="text-[11px] text-rose-500 max-w-xs truncate">
                                  原因: {inv.rejectReason}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-500 tnum">
                          {inv.issuedAt
                            ? new Date(inv.issuedAt).toLocaleDateString("zh-CN")
                            : new Date(inv.createdAt).toLocaleDateString("zh-CN")}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isIssued && (
                              <button
                                onClick={() => setViewingInvoice(inv)}
                                className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <DocumentTextIcon className="h-3.5 w-3.5" />
                                <span>电子凭证 / 打印</span>
                              </button>
                            )}

                            {isPendingState && (
                              <button
                                disabled={isPending}
                                onClick={() => handleCancelInvoice(inv.id)}
                                className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                撤回申请
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 可开票订单列表 */}
      {activeTab === "orders" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-700">暂无已支付订单</p>
              <p className="mt-1 text-xs text-slate-400">
                订购任意会员套餐后，可在本页面申请开具对应全额发票。
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">订单号</th>
                    <th className="px-6 py-3.5">套餐服务</th>
                    <th className="px-6 py-3.5">计费周期</th>
                    <th className="px-6 py-3.5">订单实付金额</th>
                    <th className="px-6 py-3.5">开票状态</th>
                    <th className="px-6 py-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((ord) => {
                    const isNone = ord.invoiceStatus === "NONE";
                    const isRequested = ord.invoiceStatus === "REQUESTED";
                    const isIssued = ord.invoiceStatus === "ISSUED";

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-800">
                          {ord.orderNo}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {ord.planName}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {ord.billingCycle}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 tnum">
                          ¥{ord.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          {isNone && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              未开票
                            </span>
                          )}
                          {isRequested && (
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              已提交待开具
                            </span>
                          )}
                          {isIssued && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                              已开具
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isNone ? (
                            <button
                              onClick={() => handleOpenApplyModal(ord)}
                              className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors shadow-xs"
                            >
                              <PlusIcon className="h-3.5 w-3.5" />
                              <span>申请开票</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveTab("invoices")}
                              className="cursor-pointer text-xs text-primary hover:underline"
                            >
                              查看记录
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 开票申请弹窗 */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <DocumentTextIcon className="h-4 w-4" />
                </div>
                <h4 className="font-semibold text-slate-900">增值税发票开具申请</h4>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* 订单信息横条 */}
            <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 flex items-center justify-between">
              <div>
                <span>订单号: </span>
                <span className="font-mono font-medium text-slate-900">{selectedOrder.orderNo}</span>
                <span className="mx-2">•</span>
                <span>{selectedOrder.planName}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">价税合计: </span>
                <span className="text-sm font-bold text-primary tnum">
                  ¥{selectedOrder.amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 常用抬头一键选择 */}
            {profiles.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-medium text-slate-700">快速载入已有企业抬头:</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProfile(p)}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <BuildingIcon className="h-3 w-3" />
                      <span>{p.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3.5">
              {/* 发票类型单选 */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">发票种类</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApplyType("NORMAL")}
                    className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                      applyType === "NORMAL"
                        ? "border-primary bg-blue-50/60 ring-2 ring-primary/20"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-900">增值税普通发票 (电子)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">个人或企业日常报销</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApplyType("SPECIAL")}
                    className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                      applyType === "SPECIAL"
                        ? "border-primary bg-blue-50/60 ring-2 ring-primary/20"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-900">增值税专用发票 (电子专票)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">企业一般纳税人 6% 进项税抵扣</div>
                  </button>
                </div>
              </div>

              {/* 发票抬头 */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  发票抬头名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如: 某某信息技术服务有限公司"
                  value={applyTitle}
                  onChange={(e) => setApplyTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* 统一社会信用代码 */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  纳税人识别号 / 统一社会信用代码 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="15-20 位纳税人识别代码"
                  value={applyTaxNumber}
                  onChange={(e) => setApplyTaxNumber(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* 专票必填项 */}
              {applyType === "SPECIAL" && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3.5 space-y-3">
                  <div className="text-xs font-semibold text-purple-900">
                    增值税专用发票必要信息 (企业税务登记者有效)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600">基本开户银行 *</label>
                      <input
                        type="text"
                        placeholder="例如: 工商银行上海张江支行"
                        value={applyBankName}
                        onChange={(e) => setApplyBankName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600">银行账号 *</label>
                      <input
                        type="text"
                        placeholder="企业对公银行账号"
                        value={applyBankAccount}
                        onChange={(e) => setApplyBankAccount(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600">注册地址 *</label>
                      <input
                        type="text"
                        placeholder="营业执照注册详细地址"
                        value={applyAddress}
                        onChange={(e) => setApplyAddress(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600">企业联系电话 *</label>
                      <input
                        type="text"
                        placeholder="注册固定电话或手机号"
                        value={applyPhone}
                        onChange={(e) => setApplyPhone(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 接收电子发票邮箱 */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  电子发票接收邮箱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="invoice@yourcompany.com"
                  value={applyEmail}
                  onChange={(e) => setApplyEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* 保存为常用抬头勾选 */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="saveProfileCheck"
                  checked={applySaveProfile}
                  onChange={(e) => setApplySaveProfile(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label htmlFor="saveProfileCheck" className="text-xs text-slate-600 cursor-pointer">
                  将此抬头信息保存到我的常用企业发票抬头库
                </label>
              </div>

              {applyError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600">
                  {applyError}
                </div>
              )}

              {applySuccess && (
                <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                  {applySuccess}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmitApply}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isPending ? "正在提交..." : "确认提交开票"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看电子发票凭证 Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <InvoiceElectronicSheet
              invoice={viewingInvoice}
              onClose={() => setViewingInvoice(null)}
            />
          </div>
        </div>
      )}

      {/* 常用抬头管理 Modal */}
      {showProfilesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-semibold text-slate-900">企业常用发票抬头管理</h4>
              <button
                onClick={() => setShowProfilesModal(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {profiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-slate-700">已保存的抬头:</span>
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 p-3 text-xs flex items-center justify-between bg-slate-50/50"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <span>{p.title}</span>
                          {p.isDefault && (
                            <span className="rounded bg-blue-100 text-primary text-[10px] px-1 py-0.2">
                              默认
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 font-mono mt-0.5">{p.taxNumber}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 新增或修改表单 */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <span className="text-xs font-semibold text-slate-900">添加常用抬头</span>
                <div>
                  <label className="block text-[11px] text-slate-600">发票类型</label>
                  <select
                    value={profType}
                    onChange={(e) => setProfType(e.target.value as "NORMAL" | "SPECIAL")}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  >
                    <option value="NORMAL">增值税普通发票</option>
                    <option value="SPECIAL">增值税专用发票</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">企业名称 *</label>
                  <input
                    type="text"
                    placeholder="企业全称"
                    value={profTitle}
                    onChange={(e) => setProfTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">税号 *</label>
                  <input
                    type="text"
                    placeholder="统一社会信用代码"
                    value={profTaxNumber}
                    onChange={(e) => setProfTaxNumber(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600">开户银行</label>
                    <input
                      type="text"
                      placeholder="开户行名称"
                      value={profBankName}
                      onChange={(e) => setProfBankName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">银行账号</label>
                    <input
                      type="text"
                      placeholder="银行账号"
                      value={profBankAccount}
                      onChange={(e) => setProfBankAccount(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                {profError && <p className="text-xs text-rose-500">{profError}</p>}

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSaveProfile}
                  className="cursor-pointer w-full rounded-lg bg-primary py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  保存抬头
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
