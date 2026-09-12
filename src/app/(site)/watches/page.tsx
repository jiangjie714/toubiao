import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { deleteWatchAction, toggleWatchAction } from "./actions";
import WatchForm from "./watch-form";

export const metadata = { title: "关键词订阅" };

export default async function WatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const user = await getSession();
  if (!user) {
    return <div className="rounded-xl border border-slate-200 bg-surface p-8 text-sm text-slate-600">请先登录。</div>;
  }

  const [watches, entitlement, provinces, cities] = await Promise.all([
    prisma.pushWatch.findMany({
      where: { userId: user.uid },
      orderBy: { createdAt: "desc" },
    }),
    getEntitlement(user.uid),
    prisma.region.findMany({ where: { level: 1 }, orderBy: { code: "asc" } }),
    prisma.region.findMany({ where: { level: 2 }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">关键词订阅</h1>
        <p className="mt-2 text-sm text-slate-600">
          当前套餐支持 {entitlement.features.pushGroups} 组关键词，已使用 {watches.length} 组。
          {created && <span className="ml-2 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">创建成功</span>}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <WatchForm
          provinces={provinces.map((region) => ({ code: region.code, name: region.name }))}
          cities={cities.map((region) => ({
            code: region.code,
            name: region.name,
            parentCode: region.parentCode ?? "",
          }))}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">名称</th>
                <th className="px-5 py-3 font-medium">关键词</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">上次推送</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {watches.map((watch) => (
                <tr key={watch.id} className="hover:bg-blue-50/40">
                  <td className="px-5 py-3.5 font-medium text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span>{watch.name}</span>
                      {watch.name.startsWith("竞对监控") && (
                        <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          竞对雷达
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-primary">{watch.keyword}</span>
                      {Array.isArray(watch.channels) && watch.channels.includes("wecom") && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">企微</span>
                      )}
                      {Array.isArray(watch.channels) && watch.channels.includes("dingtalk") && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">钉钉</span>
                      )}
                      {Array.isArray(watch.channels) && watch.channels.includes("feishu") && (
                        <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] text-cyan-700">飞书</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${watch.enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {watch.enabled ? "启用" : "暂停"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 tnum">
                    {watch.lastPushAt ? watch.lastPushAt.toLocaleString("zh-CN") : "未推送"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <form action={toggleWatchAction}>
                        <input type="hidden" name="id" value={watch.id} />
                        <button className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-primary">
                          {watch.enabled ? "暂停" : "启用"}
                        </button>
                      </form>
                      <form action={deleteWatchAction}>
                        <input type="hidden" name="id" value={watch.id} />
                        <button className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                          删除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {watches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                    还没有关键词订阅
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
