"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DynamicIcon from "@/components/dynamic-icon";
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
  BriefcaseIcon,
  FolderIcon,
  BuildingIcon,
  CreditCardIcon,
} from "@/components/icons";

export const ADMIN_NAV = [
  { href: "/admin", label: "仪表盘", Icon: ChartBarIcon },
  { href: "/admin/tenders", label: "信息管理", Icon: ClipboardIcon },
  { href: "/admin/projects", label: "项目主数据", Icon: BriefcaseIcon },
  { href: "/admin/feedbacks", label: "数据反馈", Icon: ChatBubbleIcon },
  { href: "/admin/users", label: "用户管理", Icon: UsersIcon },
  { href: "/admin/organizations", label: "企业组织", Icon: BuildingIcon },
  { href: "/admin/roles", label: "角色权限", Icon: ShieldCheckIcon },
  { href: "/admin/menus", label: "动态菜单", Icon: FolderIcon },
  { href: "/admin/orders", label: "订单管理", Icon: ClipboardIcon },
  { href: "/admin/subscriptions", label: "订阅分析", Icon: TrophyIcon },
  { href: "/admin/invoices", label: "发票审核", Icon: DocumentTextIcon },
  { href: "/admin/payment-events", label: "支付事件", Icon: BoltIcon },
  { href: "/admin/settings/jeepay", label: "Jeepay支付", Icon: CreditCardIcon },
  { href: "/admin/audits/exports", label: "导出审计", Icon: ShieldCheckIcon },
  { href: "/admin/pushes", label: "推送监控", Icon: ChartBarIcon },
  { href: "/admin/sources", label: "数据源", Icon: DatabaseIcon },
  { href: "/admin/logs", label: "抓取日志", Icon: HomeIcon },
];

export interface DynamicNavMenu {
  id: number;
  title: string;
  path: string;
  icon?: string | null;
  badge?: string | null;
}

export default function AdminNav({
  dynamicMenus,
}: {
  dynamicMenus?: DynamicNavMenu[];
}) {
  const pathname = usePathname();

  // 若提供了数据库动态菜单，优先使用动态菜单；否则降级保底使用 ADMIN_NAV
  if (dynamicMenus && dynamicMenus.length > 0) {
    return (
      <nav className="mt-4 flex-1 space-y-1 px-3 text-sm overflow-y-auto">
        {dynamicMenus.map((item) => {
          const active =
            item.path === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.path);
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 font-medium transition-colors duration-200 ${
                active
                  ? "bg-blue-50 text-primary font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={active ? "text-accent" : "text-slate-400"}>
                  <DynamicIcon name={item.icon} className="h-4.5 w-4.5" />
                </div>
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <span className="rounded-sm bg-amber-100 px-1 py-0.2 text-[10px] font-bold text-amber-800">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="mt-4 flex-1 space-y-1 px-3 text-sm overflow-y-auto">
      {ADMIN_NAV.map(({ href, label, Icon }) => {
        const active =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-colors duration-200 ${
              active
                ? "bg-blue-50 text-primary font-semibold"
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
