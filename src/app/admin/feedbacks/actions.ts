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
