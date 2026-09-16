import { NextRequest, NextResponse } from "next/server";
import { exchangeWecomCodeForUser } from "@/lib/wechat-work-oauth";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const exchangeResult = await exchangeWecomCodeForUser(code);
  if (!exchangeResult.success || !exchangeResult.user) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeResult.error || "企微授权失败")}`, request.url)
    );
  }

  const wecomUser = exchangeResult.user;
  const username = `wecom_${wecomUser.userId || "user"}`;

  // 查库或自动建立企业微信用户关联
  let user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username,
        name: wecomUser.name || "企微销售代表",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLM", // 随机占位哈希
        role: "USER",
        status: "ACTIVE",
      },
    });
  }

  // 写入会话 Cookie
  await createSession({
    uid: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  });

  return NextResponse.redirect(new URL(state.startsWith("/") ? state : "/", request.url));
}
