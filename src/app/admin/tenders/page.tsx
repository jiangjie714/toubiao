import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteTenderAction } from "../actions";
import { tenderTypeLabel, tenderTypeColor, formatDate } from "@/lib/constants";
import { PlusIcon, SearchIcon } from "@/components/icons";

export const metadata = { title: "信息管理" };

export default async function AdminTendersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageRaw = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const where = q ? { title: { contains: q } } : {};

  const [total, items] = await Promise.all([
    prisma.tender.count({ where }),
    prisma.tender.findMany({
      where,
      orderBy: { publishDate: "desc" },
      skip: (page - 1) * 20,
      take: 20,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">信息管理</h1>
          <p className="mt-1 text-sm text-slate-500">手动补录、编辑、删除公告</p>
        </div>
        <Link
          href="/admin/tenders/new"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-strong"
        >
          <PlusIcon className="h-4 w-4" />
          新增公告
        </Link>
      </div>

      <form action="/admin/tenders" method="get" className="flex gap-2">
        <div className="relative w-72">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="按标题搜索"
            className="w-full rounded-lg border border-slate-200 bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors duration-200 hover:border-slate-300 focus:border-accent focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button className="cursor-pointer rounded-lg border border-slate-200 bg-surface px-4 py-2 text-sm text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900">
          搜索
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
        <table className="data-table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">标题</th>
              <th className="px-5 py-3 font-medium">类型</th>
              <th className="px-5 py-3 font-medium">发布日期</th>
              <th className="px-5 py-3 font-medium">来源</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((t) => (
              <tr key={t.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                <td className="max-w-[420px] px-5 py-3.5">
                  <Link
                    href={`/tender/${t.id}`}
                    className="block cursor-pointer truncate text-slate-800 transition-colors duration-150 hover:text-primary"
                    title={t.title}
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tenderTypeColor(t.type)}`}
                  >
                    {tenderTypeLabel(t.type)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500 tnum">
                  {formatDate(t.publishDate)}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{t.sourceName}</td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-3 text-xs">
                    <Link
                      href={`/admin/tenders/${t.id}/edit`}
                      className="cursor-pointer font-medium text-accent transition-colors duration-150 hover:text-primary hover:underline"
                    >
                      编辑
                    </Link>
                    <form action={deleteTenderAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="cursor-pointer font-medium text-slate-400 transition-colors duration-150 hover:text-red-600 hover:underline">
                        删除
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                  暂无公告
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/tenders?q=${encodeURIComponent(q)}&page=${page - 1}`}
              className="cursor-pointer rounded-lg border border-slate-200 bg-surface px-4 py-2 text-slate-700 transition-colors duration-200 hover:border-accent/60 hover:text-primary"
            >
              上一页
            </Link>
          )}
          <span className="px-3 py-2 text-slate-500 tnum">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/tenders?q=${encodeURIComponent(q)}&page=${page + 1}`}
              className="cursor-pointer rounded-lg border border-slate-200 bg-surface px-4 py-2 text-slate-700 transition-colors duration-200 hover:border-accent/60 hover:text-primary"
            >
              下一页
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
