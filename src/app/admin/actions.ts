"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";

import {
  adminCreateUserWithProfile,
  adminUpdateUserProfile,
  AdminUserProfileInput,
} from "@/lib/user-admin-service";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("需要管理员权限");
  return user;
}

/* ---------------- 用户管理 ---------------- */

export async function createUserAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "USER") === "ADMIN" ? "ADMIN" : "USER";
  const email = String(formData.get("email") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const planCode = String(formData.get("planCode") ?? "").trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { error: "用户名需为 3-20 位字母、数字或下划线" };
  }
  if (!name) return { error: "请填写姓名" };
  if (password.length < 6) return { error: "密码至少 6 位" };

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return { error: "用户名已存在" };

  if (email) {
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) return { error: "该邮箱已被绑定" };
  }

  try {
    await adminCreateUserWithProfile({
      username,
      name,
      password,
      role,
      email: email || undefined,
      companyName: companyName || undefined,
      planCode: planCode || undefined,
    });
    revalidatePath("/admin/users");
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "创建用户失败" };
  }
}

export async function adminUpdateUserProfileAction(
  payload: AdminUserProfileInput,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await adminUpdateUserProfile(payload);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "更新失败" };
  }
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (id && password.length >= 6) {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(password) },
    });
  }
  revalidatePath("/admin/users");
}

export async function toggleUserStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id || id === admin.uid) return; // 不能停用自己

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return;
  if (target.role === "ADMIN" && target.status === "ACTIVE") {
    // 保证至少保留一个启用的管理员
    const activeAdmins = await prisma.user.count({
      where: { role: "ADMIN", status: "ACTIVE" },
    });
    if (activeAdmins <= 1) return;
  }
  await prisma.user.update({
    where: { id },
    data: { status: target.status === "ACTIVE" ? "DISABLED" : "ACTIVE" },
  });
  revalidatePath("/admin/users");
}

/* ---------------- 公告管理 ---------------- */

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

function tenderFieldsFrom(formData: FormData) {
  const type = String(formData.get("type") ?? "NOTICE");
  const title = str(formData, "title");
  const content = String(formData.get("content") ?? "").trim();
  const publishDate = str(formData, "publishDate");
  const expireDate = str(formData, "expireDate");
  return { type, title, content, publishDate, expireDate };
}

export async function createTenderAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const { type, title, content, publishDate, expireDate } = tenderFieldsFrom(formData);
  if (!title) return { error: "请填写标题" };
  if (!content) return { error: "请填写正文内容" };
  if (!publishDate) return { error: "请选择发布日期" };

  await prisma.tender.create({
    data: {
      title,
      type: ["NOTICE", "RESULT", "CHANGE", "INQUIRY"].includes(type) ? type : "NOTICE",
      content,
      publishDate: new Date(publishDate),
      expireDate: expireDate ? new Date(expireDate) : null,
      provinceCode: str(formData, "province"),
      cityCode: str(formData, "city"),
      purchaser: str(formData, "purchaser"),
      agency: str(formData, "agency"),
      sourceUrl: str(formData, "sourceUrl"),
      sourceName: str(formData, "sourceName") ?? "手动录入",
    },
  });
  revalidatePath("/admin/tenders");
  return { error: undefined };
}

export async function updateTenderAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return { error: "参数错误" };
  const { type, title, content, publishDate, expireDate } = tenderFieldsFrom(formData);
  if (!title) return { error: "请填写标题" };
  if (!content) return { error: "请填写正文内容" };
  if (!publishDate) return { error: "请选择发布日期" };

  await prisma.tender.update({
    where: { id },
    data: {
      title,
      type: ["NOTICE", "RESULT", "CHANGE", "INQUIRY"].includes(type) ? type : "NOTICE",
      content,
      publishDate: new Date(publishDate),
      expireDate: expireDate ? new Date(expireDate) : null,
      provinceCode: str(formData, "province"),
      cityCode: str(formData, "city"),
      purchaser: str(formData, "purchaser"),
      agency: str(formData, "agency"),
      sourceUrl: str(formData, "sourceUrl"),
      sourceName: str(formData, "sourceName") ?? "手动录入",
    },
  });
  revalidatePath("/admin/tenders");
  return { error: undefined };
}

export async function deleteTenderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (id) await prisma.tender.delete({ where: { id } });
  revalidatePath("/admin/tenders");
}

/* ---------------- 数据源管理 ---------------- */

export async function toggleSourceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const source = await prisma.crawlSource.findUnique({ where: { id } });
  if (!source) return;
  await prisma.crawlSource.update({
    where: { id },
    data: { enabled: !source.enabled },
  });
  revalidatePath("/admin/sources");
}

/* ---------------- 订阅管理与客户成功 ---------------- */

export async function adminExtendSubscriptionAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const days = Number(formData.get("days"));
  const reason = String(formData.get("reason") ?? "").trim() || "管理员人工调整";

  if (!userId || isNaN(userId) || !days || isNaN(days) || days <= 0) {
    return { success: false, error: "参数不合法" };
  }

  const { extendSubscriptionDays } = await import("@/lib/subscription-analytics");
  const res = await extendSubscriptionDays(userId, days, reason);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  return res;
}

export async function adminChangePlanAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const planCode = String(formData.get("planCode") ?? "");
  const billingCycle = String(formData.get("billingCycle") ?? "monthly") as "monthly" | "yearly";

  if (!userId || !planCode) {
    return { success: false, error: "参数不合法" };
  }

  const { changeSubscriptionPlan } = await import("@/lib/subscription-analytics");
  const res = await changeSubscriptionPlan(userId, planCode, billingCycle);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  return res;
}

