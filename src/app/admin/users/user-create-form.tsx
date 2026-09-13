"use client";

import { useActionState, useState } from "react";
import { createUserAction } from "../actions";
import { PlusIcon, BuildingIcon, SparklesIcon } from "@/components/icons";

interface PlanOption {
  code: string;
  name: string;
}

export default function UserCreateForm({ plans = [] }: { plans?: PlanOption[] }) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(
    createUserAction,
    {},
  );
  const [showEnterpriseFields, setShowEnterpriseFields] = useState(false);

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors duration-200 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-surface p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <PlusIcon className="h-4 w-4 text-accent" />
          创建新客户 / 账号
        </h2>
        <button
          type="button"
          onClick={() => setShowEnterpriseFields(!showEnterpriseFields)}
          className="cursor-pointer text-xs font-medium text-primary hover:text-primary-strong flex items-center gap-1"
        >
          <BuildingIcon className="h-3.5 w-3.5" />
          {showEnterpriseFields ? "收起企业与套餐配置" : "+ 录入企业信息与预设套餐"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">用户名</label>
          <input
            name="username"
            required
            pattern="[a-zA-Z0-9_]{3,20}"
            placeholder="3-20 位字母或数字"
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">姓名 / 联系人</label>
          <input name="name" required placeholder="如 张经理" className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">初始登录密码</label>
          <input
            name="password"
            type="text"
            required
            minLength={6}
            placeholder="至少 6 位"
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">角色权限</label>
          <select name="role" className={`${inputCls} w-full cursor-pointer pr-8`}>
            <option value="USER">普通用户 (USER)</option>
            <option value="ADMIN">系统管理员 (ADMIN)</option>
          </select>
        </div>
      </div>

      {showEnterpriseFields && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 gap-3 sm:grid-cols-3 bg-slate-50/50 p-3 rounded-lg animate-in fade-in duration-150">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 flex items-center gap-1">
              <BuildingIcon className="h-3 w-3 text-primary" />
              企业全称（选填）
            </label>
            <input
              name="companyName"
              placeholder="如 某某科技股份有限公司"
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              电子邮箱（选填）
            </label>
            <input
              name="email"
              type="email"
              placeholder="如 client@company.com"
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 flex items-center gap-1">
              <SparklesIcon className="h-3 w-3 text-amber-500" />
              开通会员套餐（默认1年）
            </label>
            <select name="planCode" defaultValue="FREE" className={`${inputCls} w-full cursor-pointer`}>
              <option value="FREE">免费体验版 (FREE)</option>
              {plans
                .filter((p) => p.code !== "FREE")
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {state.error ? (
          <p className="text-xs font-medium text-red-600">{state.error}</p>
        ) : (
          <div />
        )}
        <button
          disabled={pending}
          className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "创建中…" : "立即创建客户账号"}
        </button>
      </div>
    </form>
  );
}
