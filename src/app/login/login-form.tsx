"use client";

import { useState, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "../actions/auth";
import { ShieldCheckIcon, BuildingIcon, UsersIcon, SparklesIcon } from "@/components/icons";

interface PresetAccount {
  username: string;
  password: string;
  name: string;
  roleCode: string;
  roleTitle: string;
  desc: string;
  badge: string;
  badgeColor: string;
  defaultNext: string;
}

const PRESET_GROUPS: {
  id: "admin" | "enterprise" | "personal";
  label: string;
  icon: typeof ShieldCheckIcon;
  accounts: PresetAccount[];
}[] = [
  {
    id: "admin",
    label: "平台后台 (4)",
    icon: ShieldCheckIcon,
    accounts: [
      {
        username: "admin",
        password: "admin123",
        name: "系统管理员",
        roleCode: "SUPER_ADMIN",
        roleTitle: "超级管理员",
        desc: "全量16个后台菜单，拥有全局通配符（*）管辖特权",
        badge: "全权超管",
        badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
        defaultNext: "/admin",
      },
      {
        username: "ops_admin",
        password: "123456",
        name: "张运营",
        roleCode: "OPS_ADMIN",
        roleTitle: "运营主管",
        desc: "8个菜单：标讯/项目/反馈/用户/推送/数据源/日志治理",
        badge: "运营主管",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
        defaultNext: "/admin",
      },
      {
        username: "finance_admin",
        password: "123456",
        name: "李财务",
        roleCode: "FINANCE_ADMIN",
        roleTitle: "财务主管",
        desc: "6个菜单：专职订单流向/发票审核/支付事件/导出审计",
        badge: "财务专管",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        defaultNext: "/admin",
      },
      {
        username: "crawler_admin",
        password: "123456",
        name: "赵运维",
        roleCode: "CRAWLER_ADMIN",
        roleTitle: "爬虫运维",
        desc: "3个菜单：仪表盘/爬虫数据源/抓取调度与执行日志",
        badge: "爬虫运维",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        defaultNext: "/admin",
      },
    ],
  },
  {
    id: "enterprise",
    label: "企业团队 (3)",
    icon: BuildingIcon,
    accounts: [
      {
        username: "boss_liu",
        password: "123456",
        name: "刘总",
        roleCode: "TENANT_OWNER",
        roleTitle: "企业法定代表",
        desc: "企业标准版主账号，管辖智汇云创5席位团队与资质台账",
        badge: "企业主号",
        badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
        defaultNext: "/",
      },
      {
        username: "director_chen",
        password: "123456",
        name: "陈总监",
        roleCode: "TENANT_MANAGER",
        roleTitle: "投标总监",
        desc: "企业白金席位，掌管CRM商机漏斗/标书工场/清标审核",
        badge: "业务总监",
        badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
        defaultNext: "/",
      },
      {
        username: "sales_xiao",
        password: "123456",
        name: "小肖",
        roleCode: "TENANT_MEMBER",
        roleTitle: "投标专员",
        desc: "企业白金席位，日常标讯跟进/标书装配/资质与案例库",
        badge: "团队专员",
        badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
        defaultNext: "/",
      },
    ],
  },
  {
    id: "personal",
    label: "个人散客 (1)",
    icon: UsersIcon,
    accounts: [
      {
        username: "scatter_user",
        password: "123456",
        name: "王散客",
        roleCode: "USER",
        roleTitle: "个人黄金会员",
        desc: "自费单兵付费视角，拥有正文全文查阅与20条/天配额",
        badge: "黄金散客",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        defaultNext: "/",
      },
    ],
  },
];

export default function LoginForm() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") ?? "/";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [next, setNext] = useState(nextParam);
  const [activeTab, setActiveTab] = useState<"admin" | "enterprise" | "personal">("admin");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const handleSelectAccount = (acc: PresetAccount) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setSelectedUser(acc.username);
    // 如果没有指定的跳转地址，或者默认指向根目录，则自适应角色跳转路径
    if (!nextParam || nextParam === "/") {
      setNext(acc.defaultNext);
    }
  };

  const inputCls =
    "mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100";

  const currentGroup = PRESET_GROUPS.find((g) => g.id === activeTab) ?? PRESET_GROUPS[0];

  return (
    <div className="space-y-4">
      <form
        action={formAction}
        className="space-y-4 rounded-2xl bg-white p-6 shadow-xl border border-slate-100"
      >
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-700">
            用户名
          </label>
          <input
            id="username"
            name="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setSelectedUser(null);
            }}
            autoComplete="username"
            placeholder="输入用户名或从下方快速填入"
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
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setSelectedUser(null);
            }}
            autoComplete="current-password"
            placeholder="输入密码"
            className={inputCls}
          />
        </div>

        {selectedUser && (
          <div className="flex items-center justify-between rounded-lg bg-blue-50/80 px-3 py-2 text-xs text-blue-800 border border-blue-100">
            <span className="flex items-center gap-1.5">
              <SparklesIcon className="h-4 w-4 text-blue-600 shrink-0" />
              <span>已载入 <strong>{selectedUser}</strong> 预置凭证</span>
            </span>
            <span className="text-[11px] text-blue-600 font-mono">
              登录后目标: {next}
            </span>
          </div>
        )}

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
        >
          {pending ? "正在验证身份…" : "登 录"}
        </button>

        {/* 预置角色一键体验面板 */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
              预置角色一键填入测试
            </span>
            <span className="text-[11px] text-slate-500">点击角色即填入</span>
          </div>

          {/* 角色分类切换 */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 mb-2.5">
            {PRESET_GROUPS.map((g) => {
              const Icon = g.icon;
              const active = activeTab === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveTab(g.id)}
                  className={`flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>

          {/* 角色卡片列表 */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {currentGroup.accounts.map((acc) => {
              const isSelected = selectedUser === acc.username;
              return (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className={`w-full text-left rounded-lg p-2 transition cursor-pointer border ${
                    isSelected
                      ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-300"
                      : "bg-slate-50/70 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 font-mono">
                        {acc.username}
                      </span>
                      <span className="text-xs text-slate-600">
                        {acc.name}
                      </span>
                    </div>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${acc.badgeColor}`}
                    >
                      {acc.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                    {acc.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 企业微信 / 移动端快捷授权登录 */}
        <div className="pt-2">
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-slate-200" />
            <span className="bg-white px-2 text-[11px] text-slate-500 uppercase">或者</span>
          </div>

          <a
            href={`/api/auth/wecom/callback?code=mock_wecom_user&state=${encodeURIComponent(next)}`}
            className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white font-bold">
              企
            </span>
            <span>企业微信 / 钉钉免密体验</span>
          </a>
        </div>
      </form>
    </div>
  );
}
