"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PhoneIcon, LockClosedIcon, CheckCircleIcon } from "@/components/icons";

export interface ContactItem {
  id: number;
  orgName: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface Props {
  contacts: ContactItem[];
  canViewContacts: boolean;
  planName: string;
}

export default function TenderContactsCard({
  contacts,
  canViewContacts,
  planName,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 脱敏掩码处理
  const maskText = (text: string | null | undefined, type: "phone" | "email") => {
    if (!text) return "暂未公开";
    if (type === "phone") {
      if (text.length <= 7) return text.slice(0, 3) + "****";
      return text.slice(0, 3) + "****" + text.slice(-4);
    }
    const [name, domain] = text.split("@");
    if (!domain) return "****@***.com";
    return name.slice(0, 2) + "****@" + domain;
  };

  if (contacts.length === 0) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs transition-all">
      {/* 头部标题与特权标识 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-primary shadow-xs">
            <PhoneIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">招采机构联络人图谱</h3>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                已核验
              </span>
            </div>
            <p className="text-xs text-slate-500">
              精准提炼采购单位、招标代理机构与项目负责人直连通讯档案
            </p>
          </div>
        </div>

        {canViewContacts ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>已为您解锁真实联系方式 ({planName})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            <LockClosedIcon className="h-3.5 w-3.5 text-amber-600" />
            <span>铂金/企业特权锁定</span>
          </div>
        )}
      </div>

      {/* 联系人列表展示区域 */}
      <div className={`p-6 ${!canViewContacts ? "select-none" : ""}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map((c) => {
            const isPurchaser = c.role === "purchaser";
            return (
              <div
                key={c.id}
                className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-4 transition-all hover:border-slate-200 hover:bg-slate-50/80"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        isPurchaser
                          ? "bg-blue-50 text-primary border border-blue-100"
                          : "bg-purple-50 text-purple-700 border border-purple-100"
                      }`}
                    >
                      {isPurchaser ? "🏛️ 采购业主 / 招标人" : "🏢 招标代理机构"}
                    </span>
                  </div>

                  <h4 className="mt-2 text-sm font-bold text-slate-800 line-clamp-1">
                    {c.orgName}
                  </h4>

                  <dl className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-400">直连电话：</dt>
                      <dd className="font-mono font-semibold text-slate-900">
                        {canViewContacts ? (
                          c.phone || "未留联系电话"
                        ) : (
                          <span className="blur-[2px]">{maskText(c.phone, "phone")}</span>
                        )}
                      </dd>
                    </div>

                    {c.email && (
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-400">电子邮箱：</dt>
                        <dd className="font-mono text-slate-800">
                          {canViewContacts ? (
                            c.email
                          ) : (
                            <span className="blur-[2px]">{maskText(c.email, "email")}</span>
                          )}
                        </dd>
                      </div>
                    )}

                    {c.address && (
                      <div className="flex items-start justify-between gap-2">
                        <dt className="shrink-0 text-slate-400">办公地址：</dt>
                        <dd className="text-right text-slate-700 line-clamp-1">
                          {canViewContacts ? (
                            c.address
                          ) : (
                            <span className="blur-[1.5px]">{c.address.slice(0, 6)}******</span>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* 底部一键复制/拨号动作栏 */}
                <div className="mt-4 border-t border-slate-200/60 pt-3">
                  {canViewContacts ? (
                    <div className="flex items-center justify-end gap-2">
                      {c.phone && (
                        <>
                          <a
                            href={`tel:${c.phone}`}
                            className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                          >
                            <PhoneIcon className="h-3.5 w-3.5 text-primary" />
                            <span>直接拨号</span>
                          </a>
                          <button
                            onClick={() => handleCopy(c.phone!, `phone-${c.id}`)}
                            className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-primary/90 transition-colors"
                          >
                            <span>{copiedId === `phone-${c.id}` ? "已复制" : "复制号码"}</span>
                          </button>
                        </>
                      )}
                      {c.email && (
                        <button
                          onClick={() => handleCopy(c.email!, `email-${c.id}`)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                        >
                          <span>{copiedId === `email-${c.id}` ? "已复制" : "复制邮箱"}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>隐私脱敏保护</span>
                      <span className="text-primary font-medium">升级会员立享明文</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 免费版悬浮付费墙覆盖引导 */}
        {!canViewContacts && (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 p-4 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <LockClosedIcon className="h-4 w-4 text-amber-700" />
                <span>采购人/代理机构联系方式受会员保护</span>
              </div>
              <p className="text-xs text-amber-800/90">
                当前账号为免费版，机构电话与电子邮箱已做防抓取脱敏遮罩。升级为<b>铂金会员</b>或<b>企业版席位</b>，即可直接查看全部直连电话并支持一键拨号。
              </p>
              <Link
                href="/pricing"
                className="cursor-pointer mt-1 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all"
              >
                <span>立即升级开通会员特权 (¥799/年起)</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
