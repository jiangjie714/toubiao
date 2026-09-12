"use client";

import { useActionState } from "react";
import { createUserAction } from "../actions";
import { PlusIcon } from "@/components/icons";

export default function UserCreateForm() {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    createUserAction,
    {},
  );

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors duration-200 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <PlusIcon className="h-4 w-4 text-accent" />
        新建用户
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">用户名</label>
          <input
            name="username"
            required
            pattern="[a-zA-Z0-9_]{3,20}"
            className={`${inputCls} w-44`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">姓名</label>
          <input name="name" required className={`${inputCls} w-32`} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">初始密码</label>
          <input
            name="password"
            type="text"
            required
            minLength={6}
            className={`${inputCls} w-40`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">角色</label>
          <select name="role" className={`${inputCls} cursor-pointer pr-8`}>
            <option value="USER">普通用户</option>
            <option value="ADMIN">管理员</option>
          </select>
        </div>
        <button
          disabled={pending}
          className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "创建中…" : "创建"}
        </button>
      </div>
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
