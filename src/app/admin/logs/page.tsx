import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "抓取日志" };

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const pageSize = 30;

  const [total, logs] = await Promise.all([
    prisma.crawlLog.count(),
    prisma.crawlLog.findMany({
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">抓取日志</h1>
        <p className="mt-1 text-sm text-slate-500">每次抓取的结果与失败原因</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
        <table className="data-table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">开始时间</th>
              <th className="px-5 py-3 font-medium">数据源</th>
              <th className="px-5 py-3 font-medium">结果</th>
              <th className="px-5 py-3 font-medium">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id} className="transition-colors duration-150 hover:bg-blue-50/40">
                <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 tnum">
                  {log.startedAt.toLocaleString("zh-CN")}
                </td>
                <td className="px-5 py-3.5 text-slate-700">{log.sourceName}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium tnum ${
                      log.status === "OK"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {log.status === "OK" ? `成功 +${log.newCount}` : "失败"}
                  </span>
                </td>
                <td
                  className="max-w-[480px] truncate px-5 py-3.5 text-xs text-slate-500"
                  title={log.message ?? ""}
                >
                  {log.message ?? "-"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-500">
                  还没有抓取记录，去「数据源」页触发一次抓取
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
              href={`/admin/logs?page=${page - 1}`}
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
              href={`/admin/logs?page=${page + 1}`}
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
