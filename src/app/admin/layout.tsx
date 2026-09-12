import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { LogoutIcon, HomeIcon } from "@/components/icons";
import AdminNav from "./admin-nav";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSession();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-surface">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            标
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">标讯通后台</div>
            <div className="text-[11px] text-slate-500">Management Console</div>
          </div>
        </div>
        <AdminNav />
        <div className="border-t border-slate-100 p-4 text-xs">
          <p className="font-medium text-slate-600">{user.name}</p>
          <div className="mt-2.5 flex gap-3">
            <Link
              href="/"
              className="flex cursor-pointer items-center gap-1 text-slate-500 transition-colors duration-200 hover:text-primary"
            >
              <HomeIcon className="h-3.5 w-3.5" />
              返回前台
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex cursor-pointer items-center gap-1 text-slate-500 transition-colors duration-200 hover:text-red-600"
              >
                <LogoutIcon className="h-3.5 w-3.5" />
                退出
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-7">{children}</main>
    </div>
  );
}
