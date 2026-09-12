import fs from "node:fs";
import path from "node:path";
import * as YAML from "yaml";
import { prisma } from "@/lib/prisma";
import { SkillConfigSchema } from "./schema";
import type { SkillConfig } from "./types";

const SKILLS_DIR = path.join(process.cwd(), "crawler", "skills");
const cache = new Map<string, { version: number | null; config: SkillConfig }>();

export function listSkills(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((skill) => !skill.startsWith("_"))
    .filter((skill) => fs.existsSync(path.join(SKILLS_DIR, skill, "config.yaml")));
}

export function readSkillConfigFile(skillCode: string): {
  configYaml: string;
  config: SkillConfig;
} {
  const file = path.join(SKILLS_DIR, skillCode, "config.yaml");
  if (!fs.existsSync(file)) throw new Error(`skill 不存在：${file}`);

  const configYaml = fs.readFileSync(file, "utf-8");
  return { configYaml, config: parseSkillConfig(configYaml, file) };
}

export function parseSkillConfig(configYaml: string, source = "config.yaml"): SkillConfig {
  let raw: unknown;
  try {
    raw = YAML.parse(configYaml);
  } catch (error) {
    throw new Error(`${source} YAML 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }

  const result = SkillConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`${source} 配置校验失败：${issues}`);
  }
  return result.data as SkillConfig;
}

export async function syncSkillConfigs(): Promise<{ synced: number; versions: number }> {
  const skillCodes = listSkills();
  let versions = 0;

  for (const skillCode of skillCodes) {
    const { configYaml, config } = readSkillConfigFile(skillCode);
    const source = await prisma.crawlSource.upsert({
      where: { skillCode },
      create: {
        name: config.source.name,
        skillCode,
        scheduleCron: config.settings.scheduleCron ?? "0 */2 * * *",
        requestDelayMs: config.settings.requestDelayMs ?? 1200,
        timeoutMs: config.settings.timeoutMs ?? 20_000,
        retries: config.settings.retries ?? 2,
        maxPages: config.settings.maxPages ?? 1,
        proxyPolicy: config.settings.proxyPolicy ?? "off",
        nextRunAt: new Date(),
      },
      update: { name: config.source.name },
    });

    const latest = await prisma.skillRevision.findFirst({
      where: { skillCode },
      orderBy: { version: "desc" },
    });
    if (latest?.configYaml !== configYaml) {
      const version = (latest?.version ?? 0) + 1;
      await prisma.skillRevision.create({
        data: {
          sourceId: source.id,
          skillCode,
          version,
          configYaml,
          config: config as unknown as object,
          note: "文件配置同步",
        },
      });
      await prisma.crawlSource.update({
        where: { id: source.id },
        data: { configVersion: version },
      });
      versions++;
    } else if (source.configVersion !== latest.version) {
      await prisma.crawlSource.update({
        where: { id: source.id },
        data: { configVersion: latest.version },
      });
    }
  }

  return { synced: skillCodes.length, versions };
}

export type LoadConfigOptions = {
  file?: boolean;
  skipCache?: boolean;
  autoSync?: boolean;
};

export async function loadCompiledConfig(
  skillCode: string,
  options: LoadConfigOptions = {},
): Promise<SkillConfig> {
  if (options.file) {
    const { config } = readSkillConfigFile(skillCode);
    cache.set(skillCode, { version: null, config });
    return config;
  }

  if (options.autoSync !== false) {
    const sourceExists = await prisma.crawlSource.findUnique({ where: { skillCode } });
    if (!sourceExists) await syncSkillConfigs();
  }

  const source = await prisma.crawlSource.findUnique({ where: { skillCode } });
  if (!source) throw new Error(`数据源不存在：${skillCode}`);

  const revision = await prisma.skillRevision.findFirst({
    where: { skillCode, version: source.configVersion ?? undefined },
    orderBy: { version: "desc" },
  });
  if (!revision) throw new Error(`数据源 ${skillCode} 没有可用配置版本`);

  const cached = cache.get(skillCode);
  if (!options.skipCache && cached?.version === revision.version) return cached.config;

  const config = parseSkillConfig(revision.configYaml, `SkillRevision ${skillCode}@${revision.version}`);
  const merged: SkillConfig = {
    ...config,
    settings: {
      ...config.settings,
      requestDelayMs: source.requestDelayMs,
      timeoutMs: source.timeoutMs,
      retries: source.retries,
      maxPages: source.maxPages,
      proxyPolicy: source.proxyPolicy === "off" ? "off" : source.proxyPolicy,
      scheduleCron: source.scheduleCron,
    },
  };

  cache.set(skillCode, { version: revision.version, config: merged });
  return merged;
}
