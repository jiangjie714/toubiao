"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  type MyTeamData,
  addTeamMemberAction,
  removeTeamMemberAction,
  updateTeamNameAction,
} from "@/app/actions/team";
import {
  UsersIcon,
  PlusIcon,
  TrashIcon,
  SparklesIcon,
  CheckCircleIcon,
  BuildingIcon,
  ShieldCheckIcon,
  BoltIcon,
} from "@/components/icons";

interface Props {
  initialTeam?: MyTeamData;
  userName?: string;
}

export default function TeamManagementView({ initialTeam }: Props) {
  const [team, setTeam] = useState<MyTeamData | undefined>(initialTeam);
  const [isPending, startTransition] = useTransition();

  // 邀请弹窗
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // 重命名团队弹窗
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState(team?.name || "");
  const [renameError, setRenameError] = useState("");

  // 处理邀请成员
  const handleInvite = () => {
    if (!inviteIdentifier.trim()) {
      setInviteError("请输入用户名或注册邮箱");
      return;
    }
    setInviteError("");
    setInviteSuccess("");

    startTransition(async () => {
      const res = await addTeamMemberAction(inviteIdentifier.trim(), inviteTitle.trim());
      if (!res.success) {
        setInviteError(res.error || "添加成员失败");
        return;
      }
      setInviteSuccess("成员添加成功！席位已激活。");
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteIdentifier("");
        setInviteTitle("");
        setInviteSuccess("");
        // 刷新页面数据
        window.location.reload();
      }, 1000);
    });
  };

  // 处理移除成员 / 退出团队
  const handleRemove = (memberId: number, memberName: string, isSelf: boolean) => {
    const confirmMsg = isSelf
      ? "确定要退出当前团队席位吗？退出后您将恢复为普通账号权益。"
      : `确定要将成员 "${memberName}" 移出企业席位吗？释放后的席位可分配给其他成员。`;

    if (!confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await removeTeamMemberAction(memberId);
      if (!res.success) {
        alert(res.error || "操作失败");
        return;
      }
      window.location.reload();
    });
  };

  // 处理重命名团队
  const handleRename = () => {
    if (!teamNameInput.trim()) {
      setRenameError("请输入团队名称");
      return;
    }
    setRenameError("");

    startTransition(async () => {
      const res = await updateTeamNameAction(teamNameInput.trim());
      if (!res.success) {
        setRenameError(res.error || "修改失败");
        return;
      }
      setShowRenameModal(false);
      setTeam((prev) => (prev ? { ...prev, name: teamNameInput.trim() } : prev));
    });
  };

  // 如果没有团队信息（未购买企业版且无团队所属）
  if (!team) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary">
              <UsersIcon className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              企业团队多席位与权益共享中心
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              面向投标团队的高效协同方案：主账号统一采购，支持为部门团队成员一键分配专属席位，全员共享白金数据检索、联系方式穿透、标书AI应答编制与线索跟踪看板。
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <SparklesIcon className="h-4 w-4" />
                  <span>全员特权继承</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  子账号加入团队后，零成本继承白金与企业级会员权益，开标大纲不限次生成。
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <ShieldCheckIcon className="h-4 w-4" />
                  <span>席位弹性流转</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  团队负责人可随时添加、移出席位成员，成员离职或转岗无需重新付费。
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <BoltIcon className="h-4 w-4" />
                  <span>项目协同看板</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  无缝连接项目全生命周期追踪看板与合规自查表，团队商机跟进一目了然。
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
              >
                <SparklesIcon className="h-4 w-4" />
                升级企业标准版 / 专业版
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const seatPercent =
    team.maxSeats > 0 ? Math.min(100, Math.round((team.usedSeats / team.maxSeats) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* 头部团队卡片 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <BuildingIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">{team.name}</h1>
                  {team.isOwner && (
                    <button
                      onClick={() => {
                        setTeamNameInput(team.name);
                        setShowRenameModal(true);
                      }}
                      className="cursor-pointer text-xs text-primary hover:underline"
                    >
                      修改名称
                    </button>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>负责人: {team.ownerName}</span>
                  <span>•</span>
                  <span>当前身份: {team.isOwner ? "团队负责人 (OWNER)" : `团队成员 (${team.userRole})`}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 rounded bg-blue-100/80 px-2 py-0.5 font-medium text-primary">
                    <ShieldCheckIcon className="h-3 w-3" />
                    {team.planName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {team.isOwner && (
              <button
                disabled={team.availableSeats <= 0 || isPending}
                onClick={() => setShowInviteModal(true)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                  team.availableSeats > 0
                    ? "cursor-pointer bg-primary text-white hover:bg-primary/90"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
                }`}
              >
                <PlusIcon className="h-4 w-4" />
                <span>分配新席位</span>
              </button>
            )}
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>席位扩容</span>
            </Link>
          </div>
        </div>

        {/* 席位用量进度指标 */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
            <span className="text-xs font-medium text-slate-500">总席位配额</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
                {team.maxSeats}
              </span>
              <span className="text-xs text-slate-500">个席位</span>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
            <span className="text-xs font-medium text-slate-500">已占用席位</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-primary tnum">
                {team.usedSeats}
              </span>
              <span className="text-xs text-slate-500">人在线</span>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
            <span className="text-xs font-medium text-slate-500">剩余可用席位</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-2xl font-bold tracking-tight tnum ${
                  team.availableSeats > 0 ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {team.availableSeats}
              </span>
              <span className="text-xs text-slate-500">个名额</span>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>席位使用率</span>
              <span className="tnum font-semibold text-slate-700">{seatPercent}%</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-300 ${
                  seatPercent >= 90 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${seatPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 席位成员列表 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-slate-900">席位成员名单</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 tnum">
              {team.members.length} / {team.maxSeats}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            成员均享有主账号相同规格的企业级会员权益与数据接口
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">成员账号</th>
                <th className="px-6 py-3.5">角色 / 岗位</th>
                <th className="px-6 py-3.5">特权状态</th>
                <th className="px-6 py-3.5">加入时间</th>
                <th className="px-6 py-3.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.members.map((member) => {
                const isOwnerMember = member.role === "OWNER";
                return (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-primary">
                          {member.username.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{member.username}</span>
                            {member.isCurrentUser && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                                当前登录
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400">
                            {member.email || "未绑定邮箱"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          {isOwnerMember ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200/50">
                              <ShieldCheckIcon className="h-3.5 w-3.5 text-amber-500" />
                              团队创建人
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary border border-blue-200/50">
                              团队成员
                            </span>
                          )}
                        </div>
                        {member.title && (
                          <span className="text-xs text-slate-500">{member.title}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                        <span>已激活（权益全享）</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        无限检索 • 穿透联系人 • AI大纲
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500 tnum">
                      {new Date(member.joinedAt).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {isOwnerMember ? (
                        <span className="text-xs text-slate-400">不可移除</span>
                      ) : team.isOwner ? (
                        <button
                          disabled={isPending}
                          onClick={() => handleRemove(member.id, member.username, false)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          移出席位
                        </button>
                      ) : member.isCurrentUser ? (
                        <button
                          disabled={isPending}
                          onClick={() => handleRemove(member.id, member.username, true)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          退出团队
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">只读</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 邀请成员弹窗 */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <PlusIcon className="h-4 w-4" />
                </div>
                <h4 className="font-semibold text-slate-900">分配团队席位</h4>
              </div>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteError("");
                }}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  成员用户名 / 注册邮箱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如: free_user 或 teammate@company.com"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  被添加成员须为平台已注册用户，添加后将立即获得企业级会员权限。
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  职务头衔 (选填)
                </label>
                <input
                  type="text"
                  placeholder="例如: 商务经理 / 招投标专员 / 售前技术主管"
                  value={inviteTitle}
                  onChange={(e) => setInviteTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {inviteError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-600">
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                  {inviteSuccess}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleInvite}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isPending ? "正在添加..." : "确认添加席位"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改团队名称弹窗 */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h4 className="font-semibold text-slate-900 pb-3 border-b border-slate-100">
              修改企业团队名称
            </h4>
            <div className="mt-4">
              <input
                type="text"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                maxLength={50}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {renameError && (
                <p className="mt-1.5 text-xs text-rose-500">{renameError}</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRename}
                className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
