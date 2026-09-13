"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function updateFeedbackStatusAction(formData: FormData) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("无权操作");
  }

  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  if (!id || isNaN(id)) {
    throw new Error("参数错误");
  }
  if (!["RESOLVED", "REJECTED", "PENDING"].includes(status)) {
    throw new Error("状态无效");
  }

  await prisma.tenderFeedback.update({
    where: { id },
    data: {
      status,
      adminNote: adminNote || null,
    },
  });

  revalidatePath("/admin/feedbacks");
}

export async function applyTenderCorrectionAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user || user.role !== "ADMIN") return { success: false, error: "需要管理员权限" };

    const feedbackId = Number(formData.get("feedbackId"));
    const tenderId = Number(formData.get("tenderId"));
    const adminNote = String(formData.get("adminNote") ?? "").trim();

    const { applyTenderCorrection } = await import("@/lib/feedback-service");
    const res = await applyTenderCorrection({
      feedbackId,
      tenderId,
      budgetAmount: formData.get("budgetAmount") ? String(formData.get("budgetAmount")) : null,
      expireDate: formData.get("expireDate") ? String(formData.get("expireDate")) : null,
      openTime: formData.get("openTime") ? String(formData.get("openTime")) : null,
      projectNo: formData.get("projectNo") ? String(formData.get("projectNo")) : null,
      winningSupplier: formData.get("winningSupplier") ? String(formData.get("winningSupplier")) : null,
      purchaser: formData.get("purchaser") ? String(formData.get("purchaser")) : null,
      adminNote,
      operatorName: user.name || user.username,
    });

    if (res.success) {
      revalidatePath("/admin/feedbacks");
      revalidatePath(`/tender/${tenderId}`);
    }
    return res;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "纠错保存失败",
    };
  }
}


