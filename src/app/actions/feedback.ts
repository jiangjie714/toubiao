"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export type FeedbackState = {
  success?: boolean;
  error?: string;
  message?: string;
};

const VALID_ISSUE_TYPES = new Set([
  "AMOUNT_ERROR",
  "LINK_BROKEN",
  "EXPIRED_ERROR",
  "CONTENT_ERROR",
  "OTHER",
]);

export async function submitFeedbackAction(
  _prevState: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const tenderId = Number(formData.get("tenderId"));
  const issueType = String(formData.get("issueType") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (!tenderId || isNaN(tenderId)) {
    return { error: "公告参数无效" };
  }
  if (!VALID_ISSUE_TYPES.has(issueType)) {
    return { error: "请选择问题类型" };
  }
  if (!description || description.length < 5) {
    return { error: "请详细描述您发现的问题（至少 5 个字符）" };
  }
  if (description.length > 500) {
    return { error: "问题描述不能超过 500 个字符" };
  }

  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: { id: true },
  });
  if (!tender) {
    return { error: "公告不存在或已被删除" };
  }

  const user = await getSession();

  try {
    await prisma.tenderFeedback.create({
      data: {
        tenderId,
        userId: user ? user.uid : null,
        issueType,
        description,
        contact: contact || null,
        status: "PENDING",
      },
    });

    return {
      success: true,
      message: "感谢您的纠错反馈！我们将在核实后尽快修正数据。",
    };
  } catch (e) {
    console.error("Failed to submit tender feedback:", e);
    return { error: "提交反馈失败，请稍后重试" };
  }
}
