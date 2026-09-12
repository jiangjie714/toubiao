import { prisma } from "@/lib/prisma";
import SourcesManagerView, { type SourceRow } from "@/components/admin/sources-manager-view";

export const metadata = { title: "数据源管理与拨测中心 - 管理后台" };

export default async function SourcesPage() {
  const [sources, skills] = await Promise.all([
    prisma.crawlSource.findMany({ orderBy: { id: "asc" } }),
    import("@/../crawler/runner").then((m) => m.listSkills()),
  ]);

  const sourceRows: SourceRow[] = sources.map((s) => ({
    id: s.id,
    name: s.name,
    skillCode: s.skillCode,
    status: s.status,
    healthScore: s.healthScore,
    lastMessage: s.lastMessage,
    scheduleCron: s.scheduleCron,
    configVersion: s.configVersion,
    maxPages: s.maxPages,
    requestDelayMs: s.requestDelayMs,
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
    lastNewCount: s.lastNewCount,
    enabled: s.enabled,
    hasSkillFile: skills.includes(s.skillCode),
  }));

  return <SourcesManagerView initialSources={sourceRows} />;
}

