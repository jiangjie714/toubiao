import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resetPasswordAction, toggleUserStatusAction } from "../actions";
import UserCreateForm from "./user-create-form";

export const metadata = { title: "用户管理" };

export default async function UsersPage() {
  const [users, me] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: "asc" } }),
    getSession(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">用户管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          创建账号、重置密码、启用停用（不开放自助注册）
        </p>
      </div>

      <UserCreateForm />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">用户名</th>
              <th className="px-5 py-3 font-medium">姓名</th>
              <th className="px-5 py-3 font-medium">角色</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">最近登录</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                <td className="px-5 py-3.5 font-mono text-[13px] text-slate-800">{u.username}</td>
                <td className="px-5 py-3.5 text-slate-700">{u.name}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      u.role === "ADMIN"
                        ? "bg-blue-50 text-primary"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.role === "ADMIN" ? "管理员" : "普通用户"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        u.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"
                      }`}
                    />
                    <span className={u.status === "ACTIVE" ? "text-emerald-600" : "text-red-500"}>
                      {u.status === "ACTIVE" ? "启用" : "停用"}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500 tnum">
                  {u.lastLoginAt ? u.lastLoginAt.toLocaleString("zh-CN") : "从未登录"}
                </td>
                <td className="px-5 py-3.5">
                  <form action={resetPasswordAction} className="mb-1.5 flex items-center gap-1.5">
                    <input type="hidden" name="id" value={u.id} />
                    <input
                      name="password"
                      type="text"
                      placeholder="新密码"
                      minLength={6}
                      className="w-24 rounded-md border border-slate-200 px-2 py-1 text-xs outline-none transition-colors duration-200 focus:border-accent"
                    />
                    <button className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition-colors duration-200 hover:border-accent/60 hover:bg-blue-50 hover:text-primary">
                      重置密码
                    </button>
                  </form>
                  {u.id !== me?.uid && (
                    <form action={toggleUserStatusAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors duration-200 ${
                          u.status === "ACTIVE"
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "停用" : "启用"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
