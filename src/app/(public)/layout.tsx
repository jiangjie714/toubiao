import Link from "next/link";
import { SearchIcon, ArrowRightIcon } from "@/components/icons";
import { SEO_TYPE_SLUGS } from "@/lib/seo";
import { tenderTypeLabel } from "@/lib/constants";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/gonggao" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-white shadow-sm">
              标
            </span>
            <span className="text-lg font-bold tracking-tight text-primary-strong">标讯通</span>
          </Link>
          <span className="hidden text-xs text-slate-500 md:inline">全国招投标公告检索</span>
          <nav className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/gonggao"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary sm:inline-flex"
            >
              <SearchIcon className="h-4 w-4" />
              公告大厅
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-strong"
            >
              免费注册
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="mx-auto max-w-6xl space-y-3 px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {SEO_TYPE_SLUGS.map((s) => (
              <Link
                key={s.slug}
                href={`/gonggao/${s.slug}`}
                className="transition-colors hover:text-primary"
              >
                全国{tenderTypeLabel(s.type)}
              </Link>
            ))}
            <Link href="/pricing" className="transition-colors hover:text-primary">
              会员定价
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
            <span>标讯通 · 招投标信息服务平台（数据来源于公开渠道，仅供商业参考）</span>
            <Link href="/terms" className="transition-colors hover:text-primary hover:underline">
              用户服务协议
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-primary hover:underline">
              隐私保护政策
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
