"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";

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

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { error: "用户名需为 3-20 位字母、数字或下划线" };
  }
  if (!name) return { error: "请填写姓名" };
  if (password.length < 6) return { error: "密码至少 6 位" };

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return { error: "用户名已存在" };

  await prisma.user.create({
    data: { username, name, passwordHash: await hashPassword(password), role },
  });
  revalidatePath("/admin/users");
  return {};
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
