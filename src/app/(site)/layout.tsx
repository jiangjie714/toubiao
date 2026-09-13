import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { SearchIcon, TrophyIcon } from "@/components/icons";
import SiteNav from "@/components/site-nav";
import UserMenu from "@/components/user-menu";

export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // middleware 不查库，这里兜底：用户被删除/停用后即使 JWT 未过期也强制重新登录
  const user = await getSession();
  if (!user) redirect("/login");
  const entitlement = await getEntitlement(user.uid);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-white shadow-sm">
              标
            </span>
            <span className="text-lg font-bold tracking-tight text-primary-strong">标讯通</span>
          </Link>
          <SiteNav />
          <form
            action="/list"
            role="search"
            className="relative hidden w-44 shrink lg:block xl:w-56"
          >
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              placeholder="搜索公告 / 采购单位 / 中标企业"
              className="h-9 w-full rounded-xl border border-transparent bg-slate-100 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/10"
            />
          </form>
          <Link
            href="/pricing"
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors duration-200 hover:bg-amber-100 xl:inline-flex"
          >
            <TrophyIcon className="h-3.5 w-3.5 text-amber-500" />
            <span className="max-w-20 truncate">{entitlement.planName}</span>
            <span className="text-amber-300">·</span>
            <span className="text-amber-600">升级</span>
          </Link>
          <UserMenu
            name={user?.name ?? "用户"}
            planName={entitlement.planName}
            isAdmin={user?.role === "ADMIN"}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
        <div className="flex items-center justify-center gap-4">
          <span>标讯通 · 招投标信息服务平台（数据来源于公开渠道，仅供商业参考）</span>
          <span className="text-slate-300">|</span>
          <Link href="/terms" className="text-slate-600 transition-colors hover:text-primary hover:underline">
            用户服务协议
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/privacy" className="text-slate-600 transition-colors hover:text-primary hover:underline">
            隐私保护政策
          </Link>
        </div>
      </footer>
    </div>
  );
}
