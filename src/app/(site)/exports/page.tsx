import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getUserExportQuotaAction,
  getUserExportHistoryAction,
} from "@/app/actions/export";
import ExportBuilder from "./export-builder";
import { ArrowDownTrayIcon, ShieldCheckIcon } from "@/components/icons";

export const metadata = {
  title: "商机批量导出中心 - 标讯通",
  description: "自定义条件与字段批量导出全网招投标商机清单、采购人联系电话与中标供应商信息",
};

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    province?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/exports");
  }

  const resolvedParams = await searchParams;

  const [quotaRes, historyRes, provinces] = await Promise.all([
    getUserExportQuotaAction(),
    getUserExportHistoryAction(),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const quotaInfo = quotaRes.data || {
    authenticated: true,
    planCode: "FREE",
    planName: "免费版",
    canExport: false,
    canExportContacts: false,
    dailyQuota: 0,
    usedToday: 0,
    remainingToday: 0,
    unlimited: false,
  };

  return (
    <div className="space-y-6">
      {/* 头部标题与定位 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <ArrowDownTrayIcon className="h-4.5 w-4.5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              商机批量导出中心
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            自定义字段与多维复合条件，一键生成 Microsoft Excel (.xlsx) 商机分发表格，支持离线派单、会签评审与竞对复盘。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
            <span>企业级数据合规与审计存证</span>
          </span>
        </div>
      </div>

      {/* 交互构建组件 */}
      <ExportBuilder
        quotaInfo={quotaInfo}
        provinces={provinces}
        initialHistory={historyRes.data ?? []}
        initialParams={resolvedParams}
      />
    </div>
  );
}
