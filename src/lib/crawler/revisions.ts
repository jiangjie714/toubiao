import { prisma } from "@/lib/prisma";
import { parseSkillConfig, readSkillConfigFile, loadCompiledConfig } from "@/../crawler/config-loader";
import { fetchText } from "@/../crawler/fetcher";
import type { DryRunItem } from "@/../crawler/runner";

export interface SkillRevisionItem {
  id: number;
  sourceId: number;
  skillCode: string;
  version: number;
  configYaml: string;
  changedBy: string;
  note: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export interface SourceRevisionDossier {
  sourceId: number;
  sourceName: string;
  skillCode: string;
  currentVersion: number;
  currentYaml: string;
  scheduleCron: string;
  healthScore: number | null;
  status: string | null;
  revisions: SkillRevisionItem[];
}

export interface DryRunTestResult {
  success: boolean;
  itemCount: number;
  httpOk: number;
  avgLatencyMs: number;
  items: DryRunItem[];
  error?: string;
}

/**
 * 获取指定数据源的完整版本管理档案
 */
export async function getSourceRevisionDossier(
  sourceId: number
): Promise<SourceRevisionDossier | null> {
  const source = await prisma.crawlSource.findUnique({
    where: { id: sourceId },
    include: {
      revisions: {
        orderBy: { version: "desc" },
      },
    },
  });

  if (!source) return null;

  // 如果数据库中暂无任何版本，尝试从文件系统初始化一个版本 v1
  let revisions = source.revisions;
  if (revisions.length === 0) {
    try {
      const fileConfig = readSkillConfigFile(source.skillCode);
      const initialRev = await prisma.skillRevision.create({
        data: {
          sourceId: source.id,
          skillCode: source.skillCode,
          version: 1,
          configYaml: fileConfig.configYaml,
          config: fileConfig.config as unknown as object,
          changedBy: "system",
          note: "初始化文件同步",
        },
      });
      await prisma.crawlSource.update({
        where: { id: source.id },
        data: { configVersion: 1 },
      });
      revisions = [initialRev];
    } catch {
      // 文件不存在则保留空
    }
  }

  const currentVersion = source.configVersion || revisions[0]?.version || 1;
  const currentRev = revisions.find((r) => r.version === currentVersion) || revisions[0];

  return {
    sourceId: source.id,
    sourceName: source.name,
    skillCode: source.skillCode,
    currentVersion,
    currentYaml: currentRev?.configYaml || "",
    scheduleCron: source.scheduleCron,
    healthScore: source.healthScore,
    status: source.status,
    revisions: revisions.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      skillCode: r.skillCode,
      version: r.version,
      configYaml: r.configYaml,
      changedBy: r.changedBy,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      isCurrent: r.version === currentVersion,
    })),
  };
}

/**
 * 校验并发布新版本 SkillRevision
 */
export async function publishNewRevision(
  sourceId: number,
  configYaml: string,
  note: string,
  changedBy: string
): Promise<{ success: boolean; newVersion?: number; error?: string }> {
  try {
    const source = await prisma.crawlSource.findUnique({
      where: { id: sourceId },
      include: { revisions: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (!source) {
      return { success: false, error: "未找到指定数据源" };
    }

    // 1. 严格校验 YAML Schema 与配置规范
    const parsedConfig = parseSkillConfig(configYaml, `新版本发布 (${source.skillCode})`);

    // 2. 计算新版本号
    const latestVersion = source.revisions[0]?.version ?? 0;
    const nextVersion = latestVersion + 1;

    // 3. 写入事务：新增 revision 并将 source.configVersion 更新为新版本
    await prisma.$transaction([
      prisma.skillRevision.create({
        data: {
          sourceId: source.id,
          skillCode: source.skillCode,
          version: nextVersion,
          configYaml,
          config: parsedConfig as unknown as object,
          changedBy: changedBy || "admin",
          note: note.trim() || "在线发布新版本",
        },
      }),
      prisma.crawlSource.update({
        where: { id: source.id },
        data: {
          configVersion: nextVersion,
        },
      }),
    ]);

    return { success: true, newVersion: nextVersion };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "发布失败，请检查配置内容",
    };
  }
}

/**
 * 回滚至历史指定版本
 */
export async function rollbackToRevision(
  sourceId: number,
  targetVersion: number,
  changedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const source = await prisma.crawlSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) return { success: false, error: "数据源不存在" };

    const targetRev = await prisma.skillRevision.findFirst({
      where: { sourceId, version: targetVersion },
    });
    if (!targetRev) return { success: false, error: "目标版本不存在" };

    // 校验目标版本配置是否仍然有效
    parseSkillConfig(targetRev.configYaml, `回滚校验 (${source.skillCode}@v${targetVersion})`);

    await prisma.crawlSource.update({
      where: { id: source.id },
      data: {
        configVersion: targetVersion,
        lastMessage: `管理员 ${changedBy} 于 ${new Date().toLocaleString("zh-CN")} 回滚至版本 v${targetVersion}`,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "回滚失败",
    };
  }
}

/**
 * 执行在线沙盒 dry-run 探活测试
 */
export async function testDryRunYaml(
  skillCode: string,
  testYaml?: string
): Promise<DryRunTestResult> {
  const startTime = Date.now();
  try {
    const config = testYaml
      ? parseSkillConfig(testYaml, "DryRun沙盒测试")
      : await loadCompiledConfig(skillCode);

    const listConfig = config.lists[0];
    if (!listConfig) throw new Error("配置中未找到任何抓取列表 (lists)");

    const targetUrl = listConfig.firstPageUrl || listConfig.url || config.source.baseUrl;
    const itemSelector = listConfig.parse?.itemSelector || "li";

    const html = await fetchText(targetUrl, {
      timeoutMs: 15_000,
      userAgent: config.settings.userAgent,
      headers: config.settings.headers,
    });

    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    const fieldConfig = listConfig.parse?.fields;
    const items: DryRunItem[] = [];

    $(itemSelector)
      .slice(0, 5)
      .each((_, el) => {
        const titleSel = typeof fieldConfig?.title === "object" ? fieldConfig.title.selector : "a";
        const urlSel = typeof fieldConfig?.url === "object" ? fieldConfig.url.selector : "a";
        const dateSel = typeof fieldConfig?.date === "object" ? fieldConfig.date.selector : "span";

        const title = $(el).find(titleSel || "a").text().trim();
        let itemUrl = $(el).find(urlSel || "a").attr("href") || "";
        if (itemUrl && !itemUrl.startsWith("http")) {
          try {
            itemUrl = new URL(itemUrl, targetUrl).toString();
          } catch {
            // ignore
          }
        }
        const publishDate = $(el).find(dateSel || "span").text().trim() || null;

        if (title && itemUrl) {
          items.push({
            title,
            url: itemUrl,
            publishDate,
            fields: {},
            attachments: [],
            confidence: { title: 1.0, url: 1.0 },
          });
        }
      });

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      itemCount: items.length,
      httpOk: 1,
      avgLatencyMs: durationMs,
      items,
    };
  } catch (error) {
    return {
      success: false,
      itemCount: 0,
      httpOk: 0,
      avgLatencyMs: Date.now() - startTime,
      items: [],
      error: error instanceof Error ? error.message : "沙盒探活测试执行异常",
    };
  }
}
