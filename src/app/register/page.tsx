import Link from "next/link";
import RegisterForm from "./register-form";

export const metadata = { title: "注册 - 标讯通" };

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-strong via-primary to-accent px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary-strong">创建账号</h1>
          <p className="mt-1.5 text-sm text-slate-500">注册后可搜索公告并订阅关键词</p>
        </div>
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-slate-500">
          已有账号？
          <Link href="/login" className="ml-1 font-medium text-accent hover:underline">
            直接登录
          </Link>
        </p>
      </div>
    </main>
  );
}
