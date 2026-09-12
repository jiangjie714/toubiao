"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getAppUrl, sendMail } from "@/lib/mailer";

export type RegisterState = { error?: string };

function makeToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function registerAction(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { error: "用户名需为 3-20 位字母、数字或下划线" };
  }
  if (!name) return { error: "请填写姓名" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "请填写有效邮箱" };
  if (password.length < 8) return { error: "密码至少 8 位" };
  if (!formData.get("agreed")) {
    return { error: "请阅读并同意《用户服务协议》与《隐私保护政策》" };
  }

  const [usernameTaken, emailTaken] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (usernameTaken) return { error: "用户名已存在" };
  if (emailTaken) return { error: "邮箱已注册" };

  const user = await prisma.user.create({
    data: {
      username,
      name,
      email,
      emailVerified: false,
      passwordHash: await hashPassword(password),
      role: "USER",
      status: "ACTIVE",
    },
  });
  const token = await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: makeToken(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const verifyUrl = `${getAppUrl()}/verify-email?token=${token.token}`;
  await sendMail({
    to: email,
    subject: "验证标讯通账号",
    text: `请点击以下链接完成邮箱验证（24 小时内有效）：\n${verifyUrl}`,
    html: `<p>请点击以下链接完成邮箱验证（24 小时内有效）：</p><p><a href="${verifyUrl}">验证邮箱</a></p>`,
  });

  redirect("/login?registered=1");
}
