"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import {
  ChevronDownIcon,
  DatabaseIcon,
  DocumentTextIcon,
  LogoutIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons";

const MENU_LINKS = [
  { href: "/pricing", label: "会员套餐", icon: TrophyIcon },
  { href: "/team", label: "团队席位", icon: UsersIcon },
  { href: "/invoices", label: "财务发票", icon: DocumentTextIcon },
  { href: "/developer", label: "开放API", icon: DatabaseIcon },
] as const;

type Props = {
  name: string;
  planName: string;
  isAdmin: boolean;
};

export default function UserMenu({ name, planName, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 路由变化后收起菜单（渲染期调整状态，避免 effect 级联渲染）
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const itemCls =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-blue-50/70 hover:text-primary";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-1.5 transition-colors duration-200 hover:border-blue-300 hover:bg-blue-50/60 md:pr-2.5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {name.slice(0, 1) || "用"}
        </span>
        <span className="hidden max-w-28 truncate text-sm font-medium text-slate-700 md:block">
          {name}
        </span>
        <ChevronDownIcon
          className={`hidden h-3.5 w-3.5 text-slate-400 transition-transform duration-200 md:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="menu-pop absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl shadow-slate-900/10">
          <div className="border-b border-slate-100 px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <TrophyIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{planName}</span>
            </p>
          </div>
          <div className="pt-1.5">
            {MENU_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={itemCls}
              >
                <item.icon className="h-4 w-4 text-slate-400" />
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className={itemCls}>
                <ShieldCheckIcon className="h-4 w-4 text-slate-400" />
                管理后台
              </Link>
            )}
          </div>
          <div className="mt-1.5 border-t border-slate-100 pt-1.5">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
              >
                <LogoutIcon className="h-4 w-4" />
                退出登录
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
