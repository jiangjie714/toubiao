"use client";

import { useState, useTransition } from "react";
import {
  UsersIcon,
  BuildingIcon,
  BriefcaseIcon,
  TrophyIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  MailIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "@/components/icons";
import { adminUpdateUserProfileAction } from "@/app/admin/actions";

export interface PlanOption {
  id: number;
  code: string;
  name: string;
  priceYearly?: unknown;
}

export interface UserDetailData {
  id: number;
  username: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  role: string;
  status: string;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
  companyProfile: {
    id: number;
    companyName: string;
    registeredCapital: string | null;
    certifications?: unknown;
    qualifications?: unknown;
  } | null;
  subscription: {
    id: number;
    planId: number;
    status: string;
    billingCycle: string;
    startsAt: Date | string;
    endsAt: Date | string | null;
    plan: {
      id: number;
      code: string;
      name: string;
    };
  } | null;
  ownedTeam: {
    id: number;
    name: string;
    maxSeats: number;
    members: Array<{
      id: number;
      role: string;
      title: string | null;
      joinedAt: Date | string;
      user: {
        id: number;
        username: string;
        name: string;
        role: string;
      };
    }>;
  } | null;
  teamMembership: {
    id: number;
    role: string;
    title: string | null;
    team: {
      id: number;
      name: string;
      owner: {
        id: number;
        username: string;
        name: string;
      };
    };
  } | null;
  _count: {
    orders: number;
    tenderFollows: number;
  };
}

interface UserProfileModalProps {
  user: UserDetailData;
  plans: PlanOption[];
  onClose: () => void;
}

export default function UserProfileModal({ user, plans, onClose }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "edit">("overview");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 表单状态
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || "");
  const [role, setRole] = useState<"USER" | "ADMIN">(user.role as "USER" | "ADMIN");
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">(user.status as "ACTIVE" | "DISABLED");
  const [companyName, setCompanyName] = useState(user.companyProfile?.companyName || "");
  const [registeredCapital, setRegisteredCapital] = useState(user.companyProfile?.registeredCapital || "");
  const [planCode, setPlanCode] = useState(user.subscription?.plan?.code || "FREE");
  const [extendMonths, setExtendMonths] = useState(12);
  const [newPassword, setNewPassword] = useState("");

  const planName = user.subscription?.plan?.name || "免费体验版";
  const isVip = user.subscription && user.subscription.status === "ACTIVE" && user.subscription.plan.code !== "FREE";
  const endsAtStr = user.subscription?.endsAt
    ? new Date(user.subscription.endsAt).toLocaleDateString("zh-CN")
    : isVip ? "永久有效" : "无限制";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await adminUpdateUserProfileAction({
        userId: user.id,
        name,
        email: email || undefined,
        role,
        status,
        companyName: companyName || undefined,
        registeredCapital: registeredCapital || undefined,
        planCode,
        extendMonths,
        newPassword: newPassword || undefined,
      });

      if (res.success) {
        setMsg({ type: "success", text: "客户档案及权益已成功保存更新！" });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMsg({ type: "error", text: res.error || "保存失败，请检查输入" });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary shadow-xs">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{user.name}</h3>
                <span className="font-mono text-xs text-slate-400">@{user.username}</span>
                {user.role === "ADMIN" && (
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                    管理员
                  </span>
                )}
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    user.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {user.status === "ACTIVE" ? "正常" : "已停用"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                客户 ID: <span className="font-mono text-slate-700">#{user.id}</span> · 注册时间:{" "}
                <span className="tnum">{new Date(user.createdAt).toLocaleDateString("zh-CN")}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
              <button
                onClick={() => setActiveTab("overview")}
                className={`cursor-pointer rounded-md px-3 py-1 transition-colors duration-150 ${
                  activeTab === "overview"
                    ? "bg-primary text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                全景画像
              </button>
              <button
                onClick={() => setActiveTab("edit")}
                className={`cursor-pointer rounded-md px-3 py-1 transition-colors duration-150 ${
                  activeTab === "edit"
                    ? "bg-primary text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                信息维护与赋权
              </button>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {msg && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${
                msg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {msg.type === "success" ? (
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircleIcon className="h-5 w-5 text-red-600 shrink-0" />
              )}
              {msg.text}
            </div>
          )}

          {activeTab === "overview" ? (
            <div className="space-y-6">
              {/* 核心指标卡 */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">当前套餐规格</span>
                    <TrophyIcon
                      className={`h-4 w-4 ${isVip ? "text-amber-500" : "text-slate-400"}`}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900">{planName}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    有效期至: <span className="font-semibold text-slate-700 tnum">{endsAtStr}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">商机沉淀与跟进</span>
                    <BriefcaseIcon className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900 tnum">
                      {user._count.tenderFollows}
                    </span>
                    <span className="text-xs text-slate-500">个跟踪标讯</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    累计付费订单: <span className="font-semibold text-slate-700 tnum">{user._count.orders}</span> 笔
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">席位组织架构</span>
                    <UsersIcon className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900">
                      {user.ownedTeam ? "团队所有者" : user.teamMembership ? "团队成员" : "个人独立席位"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {user.ownedTeam
                      ? `团队「${user.ownedTeam.name}」已占 ${user.ownedTeam.members.length}/${user.ownedTeam.maxSeats} 席`
                      : user.teamMembership
                      ? `所属团队: ${user.teamMembership.team.name}`
                      : "未加入多成员团队"}
                  </div>
                </div>
              </div>

              {/* 企业档案全景 */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-slate-800">企业资质档案</h4>
                  </div>
                  {user.companyProfile ? (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
                      已实名认证企业
                    </span>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      未完善企业档案
                    </span>
                  )}
                </div>

                {user.companyProfile ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                    <div>
                      <span className="text-xs text-slate-400">企业全称</span>
                      <p className="mt-0.5 font-semibold text-slate-800">
                        {user.companyProfile.companyName}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">注册资本</span>
                      <p className="mt-0.5 font-medium text-slate-700">
                        {user.companyProfile.registeredCapital || "未登记"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    该客户尚未录入所属企业及资质信息，可通过「信息维护与赋权」进行绑定。
                  </p>
                )}
              </div>

              {/* 团队席位列表（若拥有团队） */}
              {user.ownedTeam && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-sm font-semibold text-slate-800">
                        团队组织席位 ({user.ownedTeam.members.length}/{user.ownedTeam.maxSeats} 席)
                      </h4>
                    </div>
                  </div>
                  {user.ownedTeam.members.length === 0 ? (
                    <p className="text-xs text-slate-400">尚未分配协作席位成员</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {user.ownedTeam.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between py-2 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800">{m.user.name}</span>
                            <span className="ml-1.5 font-mono text-slate-400">@{m.user.username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium">
                              {m.role}
                            </span>
                            <span className="text-slate-400 tnum">
                              {new Date(m.joinedAt).toLocaleDateString("zh-CN")} 加入
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 账号与联络方式 */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MailIcon className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-semibold text-slate-800">联络方式与安全</h4>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-slate-400">电子邮箱</span>
                    <p className="mt-0.5 font-mono text-slate-800">
                      {user.email || "未绑定邮箱"}
                      {user.email && (
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                            user.emailVerified
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {user.emailVerified ? "已验证" : "未验证"}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">最近登录时间</span>
                    <p className="mt-0.5 text-slate-700 tnum">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("zh-CN")
                        : "从未登录"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 编辑维护与赋权表单 */
            <form onSubmit={handleSave} className="space-y-6">
              {/* 基础身份信息 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  基础身份与联系人
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">姓名</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">联系邮箱</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="如 contact@example.com"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">用户角色</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                    >
                      <option value="USER">普通用户</option>
                      <option value="ADMIN">系统管理员</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">账号状态</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "ACTIVE" | "DISABLED")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                    >
                      <option value="ACTIVE">正常使用 (ACTIVE)</option>
                      <option value="DISABLED">停用禁用 (DISABLED)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 企业资质档案 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <BuildingIcon className="h-3.5 w-3.5 text-primary" />
                  企业客户档案
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">企业全称</label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="如 北京智能科技有限公司"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">注册资本</label>
                    <input
                      value={registeredCapital}
                      onChange={(e) => setRegisteredCapital(e.target.value)}
                      placeholder="如 1000万人民币"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>

              {/* 商业套餐与开通续期 */}
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 space-y-4">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheckIcon className="h-4 w-4 text-amber-600" />
                  客户权益赋权与商业套餐调整
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">目标套餐规格</label>
                    <select
                      value={planCode}
                      onChange={(e) => setPlanCode(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.code}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">开通/延长周期</label>
                    <select
                      value={extendMonths}
                      onChange={(e) => setExtendMonths(Number(e.target.value))}
                      disabled={planCode === "FREE"}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value={1}>延长 1 个月</option>
                      <option value={3}>延长 3 个月 (一季度)</option>
                      <option value={6}>延长 6 个月 (半年)</option>
                      <option value={12}>延长 12 个月 (1 年)</option>
                      <option value={24}>延长 24 个月 (2 年)</option>
                      <option value={36}>延长 36 个月 (3 年)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 重置密码 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <LockClosedIcon className="h-3.5 w-3.5 text-slate-500" />
                  管理员重置密码（留空则不修改）
                </h4>
                <div className="max-w-xs">
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    minLength={6}
                    placeholder="至少 6 位新密码"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* 底部提交 */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-strong transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isPending && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {isPending ? "正在保存…" : "保存变更"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
