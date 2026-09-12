import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { logoutAction } from "@/app/actions/auth";
import { LogoutIcon, ShieldCheckIcon, TrophyIcon } from "@/components/icons";
import SiteNav from "@/components/site-nav";

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
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-8 px-4 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-white shadow-sm">
              标
            </span>
            <span className="text-lg font-bold tracking-tight text-primary-strong">标讯通</span>
          </Link>
          <SiteNav />
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/pricing"
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors duration-200 hover:bg-amber-100"
            >
              <TrophyIcon className="h-3.5 w-3.5 text-amber-600" />
              <span>{entitlement.planName}</span>
              <span className="text-amber-400">·</span>
              <span className="text-amber-600 underline underline-offset-2">升级套餐</span>
            </Link>

            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors duration-200 hover:border-blue-300 hover:bg-blue-50 hover:text-primary"
              >
                <ShieldCheckIcon className="h-4 w-4" />
                管理后台
              </Link>
            )}
            <span className="hidden text-slate-500 sm:inline">{user?.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                title="退出登录"
                className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
              >
                <LogoutIcon className="h-4 w-4" />
                退出
              </button>
            </form>
          </div>
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
