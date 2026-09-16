"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "../actions/auth";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  const inputCls =
    "mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl bg-white p-7 shadow-xl"
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-700">
          用户名
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputCls}
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "登录中…" : "登 录"}
      </button>

      {/* 企业微信 / 移动端快捷授权登录 */}
      <div className="pt-2">
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-slate-200" />
          <span className="bg-white px-2 text-[11px] text-slate-400 uppercase">或者</span>
        </div>

        <a
          href={`/api/auth/wecom/callback?code=mock_wecom_user&state=${encodeURIComponent(next)}`}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 py-2.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white font-bold">
            企
          </span>
          <span>企业微信 / 钉钉扫码免密登录</span>
        </a>
      </div>
    </form>
  );
}
