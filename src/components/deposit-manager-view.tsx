"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ScaleIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  PlusIcon,
  PrinterIcon,
  ClipboardIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  BuildingIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  saveDepositAction,
  updateDepositStatusAction,
  deleteDepositAction,
} from "@/app/actions/deposit";
import {
  DEPOSIT_STATUS_META,
  PAYMENT_METHOD_META,
  generateRefundDemandLetter,
  type DepositStatus,
  type PaymentMethod,
  type DepositItemView,
  type DepositDashboardSummary,
} from "@/lib/deposit-manager";

interface Props {
  initialSummary: DepositDashboardSummary;
  initialItems: DepositItemView[];
  companyName: string;
}

export default function DepositManagerView({
  initialSummary,
  initialItems,
  companyName,
}: Props) {
  const [summary] = useState<DepositDashboardSummary>(initialSummary);
  const [items, setItems] = useState<DepositItemView[]>(initialItems);

  // 筛选与搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | DepositStatus | "OVERDUE">("ALL");

  // 模态窗控制
  const [editItem, setEditItem] = useState<DepositItemView | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [demandLetterItem, setDemandLetterItem] = useState<DepositItemView | null>(null);
  const [copiedLetter, setCopiedLetter] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState<{
    id?: number;
    projectName: string;
    projectNo: string;
    purchaser: string;
    payeeName: string;
    amount: string;
    paymentMethod: PaymentMethod;
    paidAt: string;
    deadline: string;
    refundDeadline: string;
    status: DepositStatus;
    bankAccount: string;
    notes: string;
  }>({
    projectName: "",
    projectNo: "",
    purchaser: "",
    payeeName: "",
    amount: "",
    paymentMethod: "BANK_TRANSFER",
    paidAt: new Date().toISOString().split("T")[0],
    deadline: "",
    refundDeadline: "",
    status: "IN_TRANSIT",
    bankAccount: "",
    notes: "",
  });

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // 打开新建弹窗
  const handleOpenCreate = () => {
    setFormData({
      projectName: "",
      projectNo: "",
      purchaser: "",
      payeeName: "",
      amount: "",
      paymentMethod: "BANK_TRANSFER",
      paidAt: new Date().toISOString().split("T")[0],
      deadline: "",
      refundDeadline: "",
      status: "IN_TRANSIT",
      bankAccount: "",
      notes: "",
    });
    setEditItem(null);
    setFormError("");
    setIsEditOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEdit = (item: DepositItemView) => {
    setEditItem(item);
    setFormData({
      id: item.id,
      projectName: item.projectName,
      projectNo: item.projectNo || "",
      purchaser: item.purchaser || "",
      payeeName: item.payeeName || "",
      amount: item.amount.toString(),
      paymentMethod: item.paymentMethod,
      paidAt: item.paidAt || "",
      deadline: item.deadline || "",
      refundDeadline: item.refundDeadline || "",
      status: item.status,
      bankAccount: item.bankAccount || "",
      notes: item.notes || "",
    });
    setFormError("");
    setIsEditOpen(true);
  };

  // 保存记录
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const numAmt = parseFloat(formData.amount);
    if (!formData.projectName.trim()) {
      setFormError("项目名称不能为空");
      return;
    }
    if (isNaN(numAmt) || numAmt <= 0) {
      setFormError("保证金额度必须为有效正数");
      return;
    }

    startTransition(async () => {
      const res = await saveDepositAction({
        id: editItem ? editItem.id : undefined,
        projectName: formData.projectName,
        projectNo: formData.projectNo || undefined,
        purchaser: formData.purchaser || undefined,
        payeeName: formData.payeeName || undefined,
        amount: numAmt,
        paymentMethod: formData.paymentMethod,
        paidAt: formData.paidAt || undefined,
        deadline: formData.deadline || undefined,
        refundDeadline: formData.refundDeadline || undefined,
        status: formData.status,
        bankAccount: formData.bankAccount || undefined,
        notes: formData.notes || undefined,
      });

      if (res.success) {
        setIsEditOpen(false);
        window.location.reload();
      } else {
        setFormError(res.error || "保存记录失败");
      }
    });
  };

  // 快速标记已退款
  const handleMarkRefunded = (item: DepositItemView) => {
    if (!confirm(`确认已收到【${item.projectName}】退还的 ¥${item.amount.toLocaleString()} 元保证金？`)) {
      return;
    }
    startTransition(async () => {
      const res = await updateDepositStatusAction({
        id: item.id,
        status: "REFUNDED",
        refundAmount: item.amount,
      });
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "状态更新失败");
      }
    });
  };

  // 删除记录
  const handleDelete = (item: DepositItemView) => {
    if (!confirm(`确定删除项目【${item.projectName}】的保证金台账记录吗？`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteDepositAction(item.id);
      if (res.success) {
        setItems(items.filter((i) => i.id !== item.id));
      } else {
        alert(res.error || "删除记录失败");
      }
    });
  };

  // 复制催退函
  const handleCopyLetter = (letterText: string) => {
    navigator.clipboard.writeText(letterText).then(() => {
      setCopiedLetter(true);
      setTimeout(() => setCopiedLetter(false), 2000);
    });
  };

  // 过滤数据
  const filteredItems = items.filter((item) => {
    if (selectedStatus === "OVERDUE") {
      if (!item.isOverdue && item.status !== "OVERDUE_RISK") return false;
    } else if (selectedStatus !== "ALL") {
      if (item.status !== selectedStatus) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchProject = item.projectName.toLowerCase().includes(q);
      const matchNo = item.projectNo?.toLowerCase().includes(q);
      const matchPayee = item.payeeName?.toLowerCase().includes(q);
      const matchPurchaser = item.purchaser?.toLowerCase().includes(q);
      return matchProject || matchNo || matchPayee || matchPurchaser;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* 头部 Hero */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              投标保证金与在途资金占用罗盘
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              企业流动资金合规管理
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            穿透监控每笔在途沉淀资金、开标法定 5 日退还时效跟踪、超期滞留预警及一键生成法条催办催款函
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            <span>记一笔保证金</span>
          </button>
        </div>
      </div>

      {/* 4 大资金监控看板卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 1: 在途沉淀锁定资金 */}
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              在途沉淀锁定资金
            </span>
            <span className="rounded-lg bg-blue-100 p-2 text-primary">
              <ScaleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-slate-900">
                ¥{summary.inTransitAmount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">元</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 flex items-center gap-1">
              <span>当前在途占用:</span>
              <span className="font-semibold text-blue-700">{summary.inTransitCount} 笔项目</span>
            </p>
          </div>
        </div>

        {/* 卡片 2: 超期未退高危资金 */}
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              超期滞留预警资金
            </span>
            <span className="rounded-lg bg-rose-100 p-2 text-rose-600">
              <AlertCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-rose-600">
                ¥{summary.overdueRiskAmount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">元</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 flex items-center gap-1">
              <span>已超法定退还期:</span>
              <span className="font-semibold text-rose-700">{summary.overdueCount} 笔严重超期</span>
            </p>
          </div>
        </div>

        {/* 卡片 3: 已成功回笼资金 */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              已安全退还回笼
            </span>
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-emerald-700">
                ¥{summary.refundedAmount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">元</span>
            </div>
            <p className="mt-1 text-xs text-slate-600 flex items-center gap-1">
              <span>累计回笼销账:</span>
              <span className="font-semibold text-emerald-700">{summary.refundedCount} 笔已到账</span>
            </p>
          </div>
        </div>

        {/* 卡片 4: 电子保函释放流动性空间 */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
              保函替代释放空间
            </span>
            <span className="rounded-lg bg-purple-100 p-2 text-purple-600">
              <SparklesIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-purple-700">
                ¥{summary.eBondSavingsOpportunity.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">元</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              全量替代可节省年化资金占用成本
            </p>
          </div>
        </div>
      </div>

      {/* 过滤控制栏与检索条 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        {/* 状态分类切换 */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setSelectedStatus("ALL")}
            className={`cursor-pointer px-3 py-1.5 rounded-lg transition font-medium ${
              selectedStatus === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            全部 ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus("IN_TRANSIT")}
            className={`cursor-pointer px-3 py-1.5 rounded-lg transition font-medium ${
              selectedStatus === "IN_TRANSIT"
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            在途中 ({summary.inTransitCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus("OVERDUE")}
            className={`cursor-pointer px-3 py-1.5 rounded-lg transition font-medium ${
              selectedStatus === "OVERDUE"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            🚨 逾期滞留 ({summary.overdueCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus("REFUND_APPLIED")}
            className={`cursor-pointer px-3 py-1.5 rounded-lg transition font-medium ${
              selectedStatus === "REFUND_APPLIED"
                ? "bg-purple-600 text-white"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
            }`}
          >
            已申请退款
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus("REFUNDED")}
            className={`cursor-pointer px-3 py-1.5 rounded-lg transition font-medium ${
              selectedStatus === "REFUNDED"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            已全额退款 ({summary.refundedCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus("PENDING_PAY")}
            className={`cursor-pointer px-3 py-1.5 rounded-lg transition font-medium ${
              selectedStatus === "PENDING_PAY"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            待出账 ({summary.pendingPayCount})
          </button>
        </div>

        {/* 关键字搜索输入框 */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索项目/编号/收款单位..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 台账明细数据表格 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ScaleIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">暂无符合条件的保证金记录</h3>
            <p className="mt-1 text-xs text-slate-500">
              点击上方“记一笔保证金”或前往标讯详情页一键入账
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">投标项目 / 采购人</th>
                  <th className="px-4 py-3 text-left">收款单位</th>
                  <th className="px-4 py-3 text-right">保证金额度</th>
                  <th className="px-4 py-3 text-center">缴纳方式</th>
                  <th className="px-4 py-3 text-center">出账 / 应退节点</th>
                  <th className="px-4 py-3 text-center">当前状态</th>
                  <th className="px-4 py-3 text-right">操作管理</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map((item) => {
                  const statusMeta = DEPOSIT_STATUS_META[item.status] || DEPOSIT_STATUS_META.IN_TRANSIT;
                  const methodMeta = PAYMENT_METHOD_META[item.paymentMethod] || PAYMENT_METHOD_META.BANK_TRANSFER;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.isOverdue ? "bg-rose-50/30" : ""
                      }`}
                    >
                      {/* 项目与采购人 */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {item.projectName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                          {item.projectNo && <span>编号: {item.projectNo}</span>}
                          {item.purchaser && (
                            <span className="flex items-center gap-0.5">
                              <BuildingIcon className="h-3 w-3" />
                              {item.purchaser}
                            </span>
                          )}
                          {item.tenderId && (
                            <Link
                              href={`/tender/${item.tenderId}`}
                              className="text-primary hover:underline"
                              target="_blank"
                            >
                              公告 →
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* 收款单位 */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {item.payeeName || "详见招标文件"}
                      </td>

                      {/* 保证金金额 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900">
                          ¥{item.amount.toLocaleString()}
                        </span>
                        {item.refundAmount && item.status === "REFUNDED" && (
                          <div className="text-[10px] text-emerald-600 font-mono">
                            已退 ¥{item.refundAmount.toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* 缴纳方式 */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            methodMeta.isBond
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {methodMeta.shortLabel}
                        </span>
                      </td>

                      {/* 时间节点 */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="text-slate-600">出账: {item.paidAt || "未注"}</div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            item.isOverdue ? "text-rose-600 font-bold" : "text-slate-400"
                          }`}
                        >
                          应退: {item.refundDeadline || "待定"}
                          {item.isOverdue && ` (超期${item.overdueDays}天)`}
                        </div>
                      </td>

                      {/* 当前状态 */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${statusMeta.badgeBg}`}
                        >
                          {item.isOverdue && <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />}
                          {item.isOverdue ? "超期滞留预警" : statusMeta.label}
                        </span>
                      </td>

                      {/* 操作按钮 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {/* 催款公函按钮 */}
                        <button
                          type="button"
                          onClick={() => setDemandLetterItem(item)}
                          className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          title="一键生成带法条依据的正式催办退款公函"
                        >
                          催款函
                        </button>

                        {/* 标记退款按钮 */}
                        {item.status !== "REFUNDED" && (
                          <button
                            type="button"
                            onClick={() => handleMarkRefunded(item)}
                            className="cursor-pointer text-xs font-medium text-emerald-600 hover:text-emerald-800"
                            title="标记为已收到退款到账"
                          >
                            标记已退
                          </button>
                        )}

                        {/* 编辑 */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700"
                        >
                          编辑
                        </button>

                        {/* 删除 */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="cursor-pointer text-xs font-medium text-rose-500 hover:text-rose-700"
                        >
                          <TrashIcon className="h-3.5 w-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 模态窗 1: 录入 / 编辑保证金记录 */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editItem ? "编辑保证金台账记录" : "新增投标保证金出账记录"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  项目名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  placeholder="如：某市第二人民医院智慧医疗信息化项目"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">项目/标段编号</label>
                  <input
                    type="text"
                    value={formData.projectNo}
                    onChange={(e) => setFormData({ ...formData, projectNo: e.target.value })}
                    placeholder="如：SZ-2026-ZB01"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">采购人/招标单位</label>
                  <input
                    type="text"
                    value={formData.purchaser}
                    onChange={(e) => setFormData({ ...formData, purchaser: e.target.value })}
                    placeholder="如：某市大数据局"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    保证金额度 (元) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="如：100000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">缴纳方式</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="BANK_TRANSFER">现金银行电汇 (基本户)</option>
                    <option value="E_BOND">电子投标保函 (推荐)</option>
                    <option value="PAPER_BOND">纸质保函</option>
                    <option value="CASH_CHECK">支票 / 银行汇票</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">收款单位 (退款对接方)</label>
                  <input
                    type="text"
                    value={formData.payeeName}
                    onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                    placeholder="如：公共资源交易中心或代理机构"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">当前台账状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DepositStatus })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="IN_TRANSIT">在途中 (已缴纳出账)</option>
                    <option value="PENDING_PAY">待缴纳出账</option>
                    <option value="REFUND_APPLIED">已申请退款</option>
                    <option value="REFUNDED">已全额退还</option>
                    <option value="OVERDUE_RISK">超期滞留预警</option>
                    <option value="FORFEITED">已没收/违约扣除</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">打款日期</label>
                  <input
                    type="date"
                    value={formData.paidAt}
                    onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">开标日期</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">法定退还截止日</label>
                  <input
                    type="date"
                    value={formData.refundDeadline}
                    onChange={(e) => setFormData({ ...formData, refundDeadline: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">我方汇出银行与账号信息</label>
                <input
                  type="text"
                  value={formData.bankAccount}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                  placeholder="如：工商银行北京分行营业部 0200000000000000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">备注说明</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="如：退款联系人张老师 13800000000，财务退款流水号等"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending ? "正在保存..." : "保存记录"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 模态窗 2: 《投标保证金退还催办催款函》预览与打印/复制抽屉 */}
      {demandLetterItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                  <PrinterIcon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    法定投标保证金退还催办催款函
                  </h3>
                  <p className="text-xs text-slate-500">
                    依照《招标投标法实施条例》第57条与财政部87号令第38条生成
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDemandLetterItem(null)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                {generateRefundDemandLetter(demandLetterItem, companyName)}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs">
              <span className="text-slate-400">
                可打印后加盖企业公章直接寄送采购人或公共资源交易中心财务部
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyLetter(generateRefundDemandLetter(demandLetterItem, companyName))}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedLetter ? (
                    <>
                      <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">已复制全文</span>
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="h-3.5 w-3.5" />
                      <span>复制公函文本</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 font-semibold text-white hover:bg-indigo-500 shadow-xs"
                >
                  <PrinterIcon className="h-3.5 w-3.5" />
                  <span>打印公函</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
