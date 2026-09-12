import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "邮箱验证 - 标讯通" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let verified = false;
  let message = "验证链接无效或已过期。";

  if (token) {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (record && !record.consumedAt && record.expiresAt > new Date()) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: record.userId },
          data: { emailVerified: true },
        }),
        prisma.emailVerificationToken.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        }),
      ]);
      verified = true;
      message = "邮箱验证成功，请登录开始使用。";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className={`text-xl font-bold ${verified ? "text-emerald-600" : "text-red-600"}`}>
          {verified ? "验证成功" : "验证失败"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex cursor-pointer rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-strong"
        >
          前往登录
        </Link>
      </div>
    </main>
  );
}
