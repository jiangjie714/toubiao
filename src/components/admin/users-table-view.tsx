"use client";

import { useState } from "react";
import {
  BuildingIcon,
  TrophyIcon,
} from "@/components/icons";
import { toggleUserStatusAction } from "@/app/admin/actions";
import UserProfileModal, { UserDetailData, PlanOption } from "./user-profile-modal";

interface UsersTableViewProps {
  users: UserDetailData[];
  plans: PlanOption[];
  meUid?: number;
}

export default function UsersTableView({ users, plans, meUid }: UsersTableViewProps) {
  const [selectedUser, setSelectedUser] = useState<UserDetailData | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">客户 / 用户名</th>
                <th className="px-5 py-3 font-medium">所属企业 (CRM)</th>
                <th className="px-5 py-3 font-medium">付费套餐</th>
                <th className="px-5 py-3 font-medium">席位组织</th>
                <th className="px-5 py-3 font-medium">角色与状态</th>
                <th className="px-5 py-3 font-medium">最近登录</th>
                <th className="px-5 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-400">
                    暂无符合条件的客户或用户记录
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const plan = u.subscription?.plan;
                  const isPaid =
                    u.subscription?.status === "ACTIVE" && plan && plan.code !== "FREE";
                  const endsAt = u.subscription?.endsAt;

                  return (
                    <tr
                      key={u.id}
                      className="transition-colors duration-150 hover:bg-blue-50/30"
                    >
                      {/* 用户名与姓名 */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-600 text-xs">
                            {u.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {u.name}
                              <span className="font-mono text-xs text-slate-400 font-normal">
                                @{u.username}
                              </span>
                            </div>
                            {u.email && (
                              <div className="text-[11px] text-slate-400 font-mono">
                                {u.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 企业名称 */}
                      <td className="px-5 py-3.5">
                        {u.companyProfile ? (
                          <div className="flex items-center gap-1.5">
                            <BuildingIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium text-slate-800 text-xs line-clamp-1">
                              {u.companyProfile.companyName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">个人客户</span>
                        )}
                      </td>

                      {/* 套餐 */}
                      <td className="px-5 py-3.5">
                        {isPaid ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              <TrophyIcon className="h-3 w-3 text-amber-600" />
                              {plan.name}
                            </span>
                            {endsAt && (
                              <div className="text-[10px] text-slate-400 tnum">
                                至 {new Date(endsAt).toLocaleDateString("zh-CN")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            免费版
                          </span>
                        )}
                      </td>

                      {/* 席位与组织 */}
                      <td className="px-5 py-3.5">
                        {u.ownedTeam ? (
                          <div className="text-xs">
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
                              Owner ({u.ownedTeam.members.length}/{u.ownedTeam.maxSeats}席)
                            </span>
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px] mt-0.5">
                              {u.ownedTeam.name}
                            </div>
                          </div>
                        ) : u.teamMembership ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                            成员 ({u.teamMembership.role})
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>

                      {/* 角色与状态 */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                              u.role === "ADMIN"
                                ? "bg-purple-50 text-purple-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {u.role === "ADMIN" ? "管理员" : "普通用户"}
                          </span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                u.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"
                              }`}
                            />
                            <span
                              className={
                                u.status === "ACTIVE" ? "text-emerald-600" : "text-red-500"
                              }
                            >
                              {u.status === "ACTIVE" ? "启用" : "停用"}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* 最近登录 */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 tnum">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "从未登录"}
                      </td>

                      {/* 操作 */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="cursor-pointer rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors duration-150"
                          >
                            画像与赋权
                          </button>

                          {u.id !== meUid && (
                            <form action={toggleUserStatusAction}>
                              <input type="hidden" name="id" value={u.id} />
                              <button
                                className={`cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors duration-150 ${
                                  u.status === "ACTIVE"
                                    ? "border-red-200 text-red-600 hover:bg-red-50"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {u.status === "ACTIVE" ? "停用" : "启用"}
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 客户全景画像模态窗 */}
      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          plans={plans}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
}
