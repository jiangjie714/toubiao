"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  calculateDepositDashboardSummary,
  DEPOSIT_STATUS_META,
  PAYMENT_METHOD_META,
  type DepositStatus,
  type PaymentMethod,
  type DepositItemView,
  type DepositDashboardSummary,
} from "@/lib/deposit-manager";
import { formatDate } from "@/lib/constants";

export interface DepositLedgerResponse {
  success: boolean;
  summary?: DepositDashboardSummary;
  items?: DepositItemView[];
  companyName?: string;
  error?: string;
}

/**
 * 获取用户的投标保证金台账与资金占用大盘
 */
export async function getDepositLedgerAction(): Promise<DepositLedgerResponse> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    // 检查团队归属
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.uid },
      select: { teamId: true },
    });
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: user.uid },
      select: { id: true },
    });
    const effectiveTeamId = teamMember?.teamId || ownedTeam?.id || null;

    // 获取企业档案名称
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: user.uid },
      select: { companyName: true },
    });
    const companyName = companyProfile?.companyName || user.name || "我司";

    const whereCondition = effectiveTeamId
      ? {
          OR: [{ userId: user.uid }, { teamId: effectiveTeamId }],
        }
      : { userId: user.uid };

    const records = await prisma.bidDeposit.findMany({
      where: whereCondition,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    const summary = calculateDepositDashboardSummary(records);
    const now = new Date();

    const items: DepositItemView[] = records.map((r) => {
      const amount = Number(r.amount);
      const refundAmount = r.refundAmount ? Number(r.refundAmount) : null;
      const status = r.status as DepositStatus;
      const method = r.paymentMethod as PaymentMethod;

      let isOverdue = false;
      let overdueDays = 0;
      if (
        (status === "IN_TRANSIT" || status === "REFUND_APPLIED" || status === "OVERDUE_RISK") &&
        r.refundDeadline &&
        new Date(r.refundDeadline) < now
      ) {
        isOverdue = true;
        const diffMs = now.getTime() - new Date(r.refundDeadline).getTime();
        overdueDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        id: r.id,
        tenderId: r.tenderId,
        projectName: r.projectName,
        projectNo: r.projectNo,
        purchaser: r.purchaser,
        payeeName: r.payeeName,
        amount,
        paymentMethod: method,
        methodLabel: PAYMENT_METHOD_META[method]?.label || "银行电汇",
        paidAt: r.paidAt ? formatDate(r.paidAt) : null,
        deadline: r.deadline ? formatDate(r.deadline) : null,
        refundDeadline: r.refundDeadline ? formatDate(r.refundDeadline) : null,
        refundedAt: r.refundedAt ? formatDate(r.refundedAt) : null,
        refundAmount,
        status,
        statusLabel: DEPOSIT_STATUS_META[status]?.label || "在途中",
        isOverdue,
        overdueDays,
        bankAccount: r.bankAccount,
        notes: r.notes,
        createdAt: formatDate(r.createdAt),
      };
    });

    return {
      success: true,
      summary,
      items,
      companyName,
    };
  } catch (err) {
    console.error("Error in getDepositLedgerAction:", err);
    return { success: false, error: "获取保证金台账失败，请刷新重试" };
  }
}

/**
 * 创建或编辑保证金记录
 */
export async function saveDepositAction(payload: {
  id?: number;
  tenderId?: number | null;
  projectName: string;
  projectNo?: string | null;
  purchaser?: string | null;
  payeeName?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAt?: string | null;
  deadline?: string | null;
  refundDeadline?: string | null;
  status?: DepositStatus;
  bankAccount?: string | null;
  notes?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    if (!payload.projectName || !payload.projectName.trim()) {
      return { success: false, error: "项目名称不能为空" };
    }
    if (!payload.amount || payload.amount <= 0) {
      return { success: false, error: "保证金额度必须大于 0 元" };
    }

    // 团队归属
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.uid },
      select: { teamId: true },
    });
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: user.uid },
      select: { id: true },
    });
    const effectiveTeamId = teamMember?.teamId || ownedTeam?.id || null;

    const paidDate = payload.paidAt ? new Date(payload.paidAt) : new Date();
    const deadlineDate = payload.deadline ? new Date(payload.deadline) : null;

    // 若未显式填写法定退款截止时间，默认按开标后 7 个日历天（约5个工作日）或打款后 60 天推算
    let refundDeadlineDate = payload.refundDeadline ? new Date(payload.refundDeadline) : null;
    if (!refundDeadlineDate) {
      if (deadlineDate) {
        refundDeadlineDate = new Date(deadlineDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        refundDeadlineDate = new Date(paidDate.getTime() + 45 * 24 * 60 * 60 * 1000);
      }
    }

    const data = {
      projectName: payload.projectName.trim(),
      projectNo: payload.projectNo?.trim() || null,
      purchaser: payload.purchaser?.trim() || null,
      payeeName: payload.payeeName?.trim() || null,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod || "BANK_TRANSFER",
      paidAt: paidDate,
      deadline: deadlineDate,
      refundDeadline: refundDeadlineDate,
      status: payload.status || "IN_TRANSIT",
      bankAccount: payload.bankAccount?.trim() || null,
      notes: payload.notes?.trim() || null,
      tenderId: payload.tenderId || null,
      teamId: effectiveTeamId,
    };

    if (payload.id) {
      await prisma.bidDeposit.update({
        where: { id: payload.id },
        data,
      });
    } else {
      await prisma.bidDeposit.create({
        data: {
          ...data,
          userId: user.uid,
        },
      });
    }

    revalidatePath("/deposits");
    return { success: true };
  } catch (err) {
    console.error("Error in saveDepositAction:", err);
    return { success: false, error: "保存保证金台账记录失败" };
  }
}

/**
 * 快速流转保证金状态（如：标记已退款、标记已申请、标记逾期）
 */
export async function updateDepositStatusAction(payload: {
  id: number;
  status: DepositStatus;
  refundAmount?: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const updateData: {
      status: string;
      refundedAt?: Date;
      refundAmount?: number;
      notes?: string;
    } = {
      status: payload.status,
    };

    if (payload.status === "REFUNDED") {
      updateData.refundedAt = new Date();
      if (payload.refundAmount) {
        updateData.refundAmount = payload.refundAmount;
      }
    }
    if (payload.notes) {
      updateData.notes = payload.notes;
    }

    await prisma.bidDeposit.update({
      where: { id: payload.id },
      data: updateData,
    });

    revalidatePath("/deposits");
    return { success: true };
  } catch (err) {
    console.error("Error in updateDepositStatusAction:", err);
    return { success: false, error: "更新保证金状态失败" };
  }
}

/**
 * 删除保证金台账记录
 */
export async function deleteDepositAction(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    await prisma.bidDeposit.delete({
      where: { id },
    });

    revalidatePath("/deposits");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteDepositAction:", err);
    return { success: false, error: "删除记录失败" };
  }
}

/**
 * 详情页一键入账快捷 Action
 */
export async function quickAddTenderDepositAction({
  tenderId,
  amount,
  paymentMethod,
}: {
  tenderId: number;
  amount: number;
  paymentMethod: PaymentMethod;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        title: true,
        projectNo: true,
        purchaser: true,
        agency: true,
        expireDate: true,
        openTime: true,
      },
    });

    if (!tender) {
      return { success: false, error: "未找到对应的招标公告" };
    }

    return await saveDepositAction({
      tenderId: tender.id,
      projectName: tender.title,
      projectNo: tender.projectNo,
      purchaser: tender.purchaser,
      payeeName: tender.agency || tender.purchaser,
      amount,
      paymentMethod,
      deadline: tender.expireDate ? tender.expireDate.toISOString() : null,
      status: "IN_TRANSIT",
      notes: "从标讯详情页一键记入保证金台账",
    });
  } catch (err) {
    console.error("Error in quickAddTenderDepositAction:", err);
    return { success: false, error: "一键记入台账失败" };
  }
}
