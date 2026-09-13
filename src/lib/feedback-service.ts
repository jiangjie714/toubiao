import { prisma } from "@/lib/prisma";

export function parseAmountInput(input: string | null): number | null {
  if (!input || !input.trim()) return null;
  const clean = input.replace(/[,，\s元]/g, "");
  if (clean.includes("万")) {
    const num = parseFloat(clean.replace("万", ""));
    return isNaN(num) ? null : Math.round(num * 10000 * 100) / 100;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

export function parseDateInput(input: string | null): Date | null {
  if (!input || !input.trim()) return null;
  const d = new Date(input.trim());
  return isNaN(d.getTime()) ? null : d;
}

export interface ApplyTenderCorrectionInput {
  feedbackId: number;
  tenderId: number;
  budgetAmount?: string | null;
  expireDate?: string | null;
  openTime?: string | null;
  projectNo?: string | null;
  winningSupplier?: string | null;
  purchaser?: string | null;
  adminNote?: string | null;
  operatorName?: string;
}

/**
 * 标讯人工纠错核准与 1.0 满分置信度锁定
 */
export async function applyTenderCorrection(
  input: ApplyTenderCorrectionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { feedbackId, tenderId, adminNote, operatorName = "管理员" } = input;

    if (!feedbackId || !tenderId) {
      return { success: false, error: "参数错误：缺少 feedbackId 或 tenderId" };
    }

    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) return { success: false, error: "公告不存在" };

    const updateData: Record<string, unknown> = {};
    const existingConfidence = (tender.fieldsConfidence as Record<string, number>) || {};
    const newConfidence: Record<string, number> = { ...existingConfidence };

    // 预算金额
    if (input.budgetAmount !== undefined && input.budgetAmount !== null) {
      const parsed = parseAmountInput(input.budgetAmount);
      updateData.budgetAmount = parsed;
      newConfidence.budgetAmount = 1.0;
    }

    // 截止时间
    if (input.expireDate !== undefined && input.expireDate !== null) {
      const parsed = parseDateInput(input.expireDate);
      updateData.expireDate = parsed;
      newConfidence.expireDate = 1.0;
    }

    // 开标时间
    if (input.openTime !== undefined && input.openTime !== null) {
      const parsed = parseDateInput(input.openTime);
      updateData.openTime = parsed;
      newConfidence.openTime = 1.0;
    }

    // 项目编号
    if (input.projectNo !== undefined && input.projectNo !== null) {
      const str = input.projectNo.trim();
      updateData.projectNo = str || null;
      newConfidence.projectNo = 1.0;
    }

    // 中标供应商
    if (input.winningSupplier !== undefined && input.winningSupplier !== null) {
      const str = input.winningSupplier.trim();
      updateData.winningSupplier = str || null;
      newConfidence.winningSupplier = 1.0;
    }

    // 采购单位
    if (input.purchaser !== undefined && input.purchaser !== null) {
      const str = input.purchaser.trim();
      updateData.purchaser = str || null;
      newConfidence.purchaser = 1.0;
    }

    updateData.fieldsConfidence = newConfidence;

    // 更新标讯主体与置信度
    await prisma.tender.update({
      where: { id: tenderId },
      data: updateData,
    });

    // 更新反馈工单
    await prisma.tenderFeedback.update({
      where: { id: feedbackId },
      data: {
        status: "RESOLVED",
        adminNote:
          adminNote ||
          `已核实并由管理员【${operatorName}】修正核心字段，置信度已设为 1.0 永久锁定`,
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "人工纠错保存失败",
    };
  }
}
