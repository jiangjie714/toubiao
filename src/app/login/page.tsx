import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata = { title: "登录 - 标讯通" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-strong via-primary to-accent px-4">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-primary shadow-lg">
            标
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">标讯通</h1>
          <p className="mt-1.5 text-sm text-blue-100">招投标信息服务平台</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        {registered && (
          <p className="mt-5 rounded-lg bg-white/15 px-3 py-2 text-center text-xs text-white">
            注册成功，请前往邮箱完成验证。
          </p>
        )}
        <p className="mt-6 text-center text-xs text-blue-100">
          还没有账号？
          <Link href="/register" className="font-semibold text-white underline">立即注册</Link>
        </p>
      </div>
    </main>
  );
}
