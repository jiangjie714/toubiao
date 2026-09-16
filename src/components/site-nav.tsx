"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  ArrowDownTrayIcon,
  BellIcon,
  BoltIcon,
  BuildingIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ClipboardIcon,
  FolderIcon,
  MapPinIcon,
  MenuIcon,
  SearchIcon,
  SparklesIcon,
  TargetIcon,
  ScaleIcon,
  RadarIcon,
  TrophyIcon,
  CalendarIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  XMarkIcon,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  /** 命中任一前缀即视为该栏目激活 */
  match: string[];
};

const SEARCH_ITEMS = [
  { href: "/list", label: "全部公告", type: null },
  { href: "/list?type=NOTICE", label: "招标公告", type: "NOTICE" },
  { href: "/list?type=RESULT", label: "中标公告", type: "RESULT" },
  { href: "/list?type=CHANGE", label: "变更公告", type: "CHANGE" },
  { href: "/list?type=INQUIRY", label: "询价公告", type: "INQUIRY" },
  { href: "/intentions", label: "采购意向", type: "INTENTION" },
] as const;

const INTEL_ITEMS: NavItem[] = [
  { href: "/intentions", label: "意向雷达", desc: "提前 30~90 天锁定潜在商机", icon: SparklesIcon, match: ["/intentions"] },
  { href: "/competitors", label: "竞对雷达", desc: "核心竞对监控与后院起火预警", icon: RadarIcon, match: ["/competitors"] },
  { href: "/suppliers", label: "供应商库", desc: "全网供应商中标画像与PK", icon: TargetIcon, match: ["/suppliers"] },
  { href: "/purchasers", label: "买方画像", desc: "采购单位画像与采购偏好", icon: BuildingIcon, match: ["/purchasers"] },
  { href: "/projects", label: "项目大盘", desc: "重点项目全过程进展", icon: FolderIcon, match: ["/projects"] },
  { href: "/industries", label: "重点赛道", desc: "行业赛道招标热度", icon: BoltIcon, match: ["/industries"] },
  { href: "/regions", label: "区域大盘", desc: "全国区域招标分布", icon: MapPinIcon, match: ["/regions"] },
  { href: "/analytics", label: "行业情报", desc: "行业统计与每周简报", icon: ChartBarIcon, match: ["/analytics", "/brief"] },
  { href: "/history", label: "历史穿透库", desc: "对标千里马10年库与下浮罗盘", icon: ScaleIcon, match: ["/history"] },
];

const WORKBENCH_ITEMS: NavItem[] = [
  { href: "/pipeline", label: "销售 CRM 漏斗", desc: "商机全周期漏斗、加权预测与公海池", icon: ChartBarIcon, match: ["/pipeline"] },
  { href: "/proposals", label: "标书装配工场", desc: "资质业绩贯通与六卷模块化装配", icon: DocumentTextIcon, match: ["/proposals"] },
  { href: "/qualifications", label: "资质与商机雷达", desc: "企业资质管理与全网智能赢面匹配", icon: RadarIcon, match: ["/qualifications"] },
  { href: "/cases", label: "业绩案例库", desc: "合同业绩归档与类似项目智能匹配", icon: TrophyIcon, match: ["/cases"] },
  { href: "/deposits", label: "保证金台账", desc: "在途资金监控与超期催款维权", icon: ScaleIcon, match: ["/deposits"] },
  { href: "/tracker", label: "跟进看板", desc: "商机跟进与投标状态管理", icon: ClipboardIcon, match: ["/tracker"] },
  { href: "/calendar", label: "投标日历", desc: "截标倒计时与关键里程碑排期大盘", icon: CalendarIcon, match: ["/calendar"] },
  { href: "/audit", label: "标书质检", desc: "清标查重与一票废标风险深度扫描", icon: ShieldCheckIcon, match: ["/audit"] },
  { href: "/reviews", label: "复盘归因罗盘", desc: "开标数据对标与胜败六维归因诊断", icon: ScaleIcon, match: ["/reviews"] },
  { href: "/tenders/compare", label: "标讯对比", desc: "多标段横向立项决策罗盘", icon: ScaleIcon, match: ["/tenders/compare"] },
  { href: "/watches", label: "关键词订阅", desc: "按关键词追踪新公告", icon: BellIcon, match: ["/watches"] },
  { href: "/webhooks", label: "预警推送中枢", desc: "企微/钉钉/飞书机器人事件路由", icon: BoltIcon, match: ["/webhooks"] },
  { href: "/compliance", label: "安全合规中心", desc: "等保二级自检与防篡改审计报告", icon: ShieldCheckIcon, match: ["/compliance"] },
  { href: "/exports", label: "商机导出", desc: "筛选结果批量导出", icon: ArrowDownTrayIcon, match: ["/exports"] },
];

const GROUPS: {
  id: string;
  label: string;
  /** 公告类型直链菜单（信息检索） */
  links?: (typeof SEARCH_ITEMS)[number][];
  /** 图标 + 说明的栏目菜单 */
  items?: NavItem[];
  wide?: boolean;
}[] = [
  { id: "search", label: "信息检索", links: [...SEARCH_ITEMS] },
  { id: "intel", label: "情报洞察", items: INTEL_ITEMS, wide: true },
  { id: "bench", label: "工作台", items: WORKBENCH_ITEMS, wide: true },
];

const triggerCls = (active: boolean) =>
  `flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm transition-colors duration-200 ${
    active
      ? "bg-blue-50 font-semibold text-primary"
      : "font-medium text-slate-600 hover:bg-blue-50/60 hover:text-primary"
  }`;

export default function SiteNav() {
  const pathname = usePathname();
  const currentType = useSearchParams().get("type");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  const isListType = (type: string | null) =>
    pathname === "/list" && (currentType ?? null) === type;
  const itemActive = (item: NavItem) => item.match.some((m) => pathname.startsWith(m));

  // 路由变化后收起弹层（渲染期调整状态，避免 effect 级联渲染）
  const navKey = `${pathname}?${currentType ?? ""}`;
  const [prevNavKey, setPrevNavKey] = useState(navKey);
  if (prevNavKey !== navKey) {
    setPrevNavKey(navKey);
    setOpenMenu(null);
    setMobileOpen(false);
  }

  // Esc / 点击导航外部收起
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  // 悬停切换菜单：延迟收起，避免指针斜穿缝隙时闪烁
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 120);
  };
  useEffect(() => cancelClose, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav ref={rootRef} className="flex min-w-0 flex-1 items-center">
      {/* 桌面端：三个分组菜单 */}
      <div
        className="hidden flex-1 items-center justify-center gap-1 lg:flex"
        onMouseLeave={scheduleClose}
      >
        {GROUPS.map((group) => {
          const active =
            group.id === "search"
              ? pathname === "/list"
              : (group.items?.some(itemActive) ?? false);
          const open = openMenu === group.id;
          return (
            <div
              key={group.id}
              className="relative"
              onMouseEnter={() => {
                cancelClose();
                setOpenMenu(group.id);
              }}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                className={triggerCls(active)}
                onClick={() => setOpenMenu(open ? null : group.id)}
              >
                {group.label}
                <ChevronDownIcon
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open && (
                <div className="absolute left-0 top-full z-50 pt-2">
                  {group.links ? (
                    <div className="menu-pop w-44 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/10">
                      {group.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpenMenu(null)}
                          className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                            isListType(link.type)
                              ? "bg-blue-50 font-semibold text-primary"
                              : "font-medium text-slate-700 hover:bg-blue-50/70 hover:text-primary"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`menu-pop rounded-2xl border border-slate-100 bg-white p-2 shadow-xl shadow-slate-900/10 ${
                        group.wide ? "grid w-[34rem] grid-cols-2 gap-1" : "w-72"
                      }`}
                    >
                      {group.items?.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenMenu(null)}
                          className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors duration-150 hover:bg-blue-50/70"
                        >
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary transition-colors duration-150 group-hover:bg-white">
                            <item.icon className="h-4.5 w-4.5" />
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block text-sm ${
                                itemActive(item)
                                  ? "font-semibold text-primary"
                                  : "font-medium text-slate-800"
                              }`}
                            >
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                              {item.desc}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 移动端：汉堡菜单 */}
      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
        onClick={() => setMobileOpen((v) => !v)}
        className="ml-auto inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors duration-200 hover:bg-slate-100 lg:hidden"
      >
        {mobileOpen ? (
          <XMarkIcon className="h-5 w-5" />
        ) : (
          <MenuIcon className="h-5 w-5" />
        )}
      </button>

      {mobileOpen && (
        <div className="menu-pop absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-slate-200 bg-white px-4 pb-5 pt-3 shadow-xl shadow-slate-900/10 lg:hidden">
          <form action="/list" role="search" className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              placeholder="搜索公告、采购单位、中标企业"
              className="h-10 w-full rounded-xl border border-transparent bg-slate-100 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/10"
            />
          </form>
          <p className="mt-4 px-1 text-xs font-semibold tracking-wide text-slate-400">
            快速检索
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {SEARCH_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className={`rounded-lg px-2 py-2 text-center text-sm transition-colors duration-150 ${
                  isListType(item.type)
                    ? "bg-blue-50 font-semibold text-primary"
                    : "bg-slate-50 font-medium text-slate-700 hover:bg-blue-50/60 hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          {[
            { label: "情报洞察", items: INTEL_ITEMS },
            { label: "工作台", items: WORKBENCH_ITEMS },
          ].map((section) => (
            <div key={section.label}>
              <p className="mt-4 px-1 text-xs font-semibold tracking-wide text-slate-400">
                {section.label}
              </p>
              <div className="mt-2 grid gap-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors duration-150 ${
                      itemActive(item)
                        ? "bg-blue-50/70"
                        : "hover:bg-blue-50/60"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                      <item.icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm ${
                          itemActive(item)
                            ? "font-semibold text-primary"
                            : "font-medium text-slate-800"
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                        {item.desc}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
