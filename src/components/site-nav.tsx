"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/list", label: "信息检索", type: "" },
  { href: "/list?type=NOTICE", label: "招标公告", type: "NOTICE" },
  { href: "/list?type=RESULT", label: "中标公告", type: "RESULT" },
  { href: "/suppliers", label: "竞对情报", type: "" },
  { href: "/analytics", label: "行业情报", type: "" },
  { href: "/tracker", label: "跟进看板", type: "" },
  { href: "/watches", label: "关键词订阅", type: "" },
  { href: "/developer", label: "开放API", type: "" },
  { href: "/team", label: "团队席位", type: "" },
  { href: "/invoices", label: "财务发票", type: "" },
  { href: "/pricing", label: "会员套餐", type: "" },
] as const;

export default function SiteNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type");

  return (
    <nav className="flex flex-1 items-center gap-1 text-sm font-medium">
      {LINKS.map((item) => {
        let active = false;
        if (item.href === "/pricing") {
          active = pathname.startsWith("/pricing");
        } else if (item.href === "/invoices") {
          active = pathname.startsWith("/invoices");
        } else if (item.href === "/team") {
          active = pathname.startsWith("/team");
        } else if (item.href === "/developer") {
          active = pathname.startsWith("/developer");
        } else if (item.href === "/watches") {
          active = pathname.startsWith("/watches");
        } else if (item.href === "/tracker") {
          active = pathname.startsWith("/tracker");
        } else if (item.href === "/suppliers") {
          active = pathname.startsWith("/suppliers");
        } else if (item.href === "/analytics") {
          active = pathname.startsWith("/analytics") || pathname.startsWith("/brief");
        } else if (item.href === "/list") {
          active = pathname === "/list" && !currentType;
        } else {
          active = pathname === "/list" && currentType === item.type;
        }


        return (
          <Link
            key={item.href}
            href={item.href}
            className={`cursor-pointer rounded-lg px-3.5 py-2 transition-colors duration-200 ${
              active
                ? "bg-blue-50 text-primary font-semibold"
                : "text-slate-600 hover:bg-blue-50/60 hover:text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
