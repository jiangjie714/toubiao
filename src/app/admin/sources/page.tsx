import { prisma } from "@/lib/prisma";
import SourcesManagerView, { type SourceRow } from "@/components/admin/sources-manager-view";

export const metadata = { title: "数据源管理与拨测中心 - 管理后台" };

export default async function SourcesPage() {
  const [sources, skills, checkpoints] = await Promise.all([
    prisma.crawlSource.findMany({ orderBy: { id: "asc" } }),
    import("@/../crawler/runner").then((m) => m.listSkills()),
    prisma.tender.groupBy({
      by: ["sourceName"],
      _max: {
        publishDate: true,
      },
    }),
  ]);

  const checkpointMap = new Map<string, string>();
  for (const cp of checkpoints) {
    if (cp._max.publishDate) {
      checkpointMap.set(cp.sourceName, cp._max.publishDate.toISOString());
    }
  }

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
    checkpointDate: checkpointMap.get(s.name) ?? null,
  }));

  return <SourcesManagerView initialSources={sourceRows} />;
}

