import Link from "next/link";
import { notFound } from "next/navigation";
import { getSourceRevisionDossier } from "@/lib/crawler/revisions";
import YamlRevisionEditor from "@/components/admin/yaml-revision-editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sourceId = parseInt(id, 10);
  if (isNaN(sourceId)) return { title: "数据源未找到 - 管理后台" };

  const dossier = await getSourceRevisionDossier(sourceId);
  if (!dossier) return { title: "数据源未找到 - 管理后台" };

  return {
    title: `【技能版本管理】${dossier.sourceName} (${dossier.skillCode}) - 管理后台`,
    description: `查看 ${dossier.sourceName} 历史抓取规则版本、在线编辑 YAML、版本对比与一键回滚`,
  };
}

export default async function SourceRevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sourceId = parseInt(id, 10);
  if (isNaN(sourceId)) notFound();

  const dossier = await getSourceRevisionDossier(sourceId);
  if (!dossier) notFound();

  return (
    <div className="space-y-6">
      {/* 顶部面包屑与导航 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/admin/sources" className="hover:text-primary transition">
              数据源管理
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">{dossier.sourceName}</span>
            <span>/</span>
            <span className="text-primary font-semibold">技能版本控制</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <span>{dossier.sourceName}</span>
            <span className="font-mono text-xs font-normal text-slate-400">
              ({dossier.skillCode})
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-700 border border-emerald-200">
              当前线上版本：v{dossier.currentVersion}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/sources"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <span>← 返回数据源列表</span>
          </Link>
        </div>
      </div>

      {/* 核心规格信息条 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-surface p-3.5">
          <div className="text-[11px] text-slate-400 font-medium">当前线上生效版本</div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900">
            v{dossier.currentVersion}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-3.5">
          <div className="text-[11px] text-slate-400 font-medium">累计版本更迭数</div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900">
            {dossier.revisions.length} 个版本
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-3.5">
          <div className="text-[11px] text-slate-400 font-medium">定时抓取周期 (Cron)</div>
          <div className="mt-1 text-xs font-bold font-mono text-primary">
            {dossier.scheduleCron}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-3.5">
          <div className="text-[11px] text-slate-400 font-medium">健康分评级</div>
          <div className="mt-1 text-base font-bold font-mono text-emerald-600">
            {dossier.healthScore ?? 100} 分
          </div>
        </div>
      </div>

      {/* 在线编辑器与版本历史 */}
      <YamlRevisionEditor dossier={dossier} />
    </div>
  );
}
