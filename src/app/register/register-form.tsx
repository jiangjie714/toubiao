"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type RegisterState } from "./actions";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    {},
  );
  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="text-sm font-medium text-slate-700">姓名</label>
        <input id="name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="username" className="text-sm font-medium text-slate-700">用户名</label>
        <input id="username" name="username" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-700">邮箱</label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-slate-700">密码</label>
        <input id="password" name="password" type="password" minLength={8} required className={inputClass} />
      </div>

      <div className="flex items-start gap-2 pt-1 text-xs text-slate-600">
        <input
          id="agreed"
          name="agreed"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-accent"
        />
        <label htmlFor="agreed">
          我已阅读并同意
          <Link href="/terms" target="_blank" className="font-medium text-primary hover:underline">
            《用户服务协议》
          </Link>
          与
          <Link href="/privacy" target="_blank" className="font-medium text-primary hover:underline">
            《隐私保护政策》
          </Link>
        </label>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "注册中…" : "创建账号"}
      </button>
    </form>
  );
}
