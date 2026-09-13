"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBarIcon,
  ClipboardIcon,
  UsersIcon,
  DatabaseIcon,
  HomeIcon,
  ShieldCheckIcon,
  BoltIcon,
  ChatBubbleIcon,
  DocumentTextIcon,
  TrophyIcon,
} from "@/components/icons";

export const ADMIN_NAV = [
  { href: "/admin", label: "仪表盘", Icon: ChartBarIcon },
  { href: "/admin/tenders", label: "信息管理", Icon: ClipboardIcon },
  { href: "/admin/feedbacks", label: "数据反馈", Icon: ChatBubbleIcon },
  { href: "/admin/users", label: "用户管理", Icon: UsersIcon },
  { href: "/admin/orders", label: "订单管理", Icon: ClipboardIcon },
  { href: "/admin/subscriptions", label: "订阅分析", Icon: TrophyIcon },
  { href: "/admin/invoices", label: "发票审核", Icon: DocumentTextIcon },
  { href: "/admin/payment-events", label: "支付事件", Icon: BoltIcon },
  { href: "/admin/audits/exports", label: "导出审计", Icon: ShieldCheckIcon },
  { href: "/admin/pushes", label: "推送监控", Icon: ChartBarIcon },
  { href: "/admin/sources", label: "数据源", Icon: DatabaseIcon },
  { href: "/admin/logs", label: "抓取日志", Icon: HomeIcon },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex-1 space-y-1 px-3 text-sm">
      {ADMIN_NAV.map(({ href, label, Icon }) => {
        const active =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-colors duration-200 ${
              active
                ? "bg-blue-50 text-primary"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className={`h-4.5 w-4.5 ${active ? "text-accent" : "text-slate-400"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
