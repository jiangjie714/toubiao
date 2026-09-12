import "dotenv/config";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

type OldUser = {
  id: number;
  username: string;
  passwordHash: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OldRegion = {
  code: string;
  name: string;
  level: number;
  parentCode: string | null;
};

type OldTender = {
  id: number;
  title: string;
  type: string;
  provinceCode: string | null;
  cityCode: string | null;
  publishDate: string;
  expireDate: string | null;
  purchaser: string | null;
  agency: string | null;
  sourceName: string;
  sourceUrl: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type OldCrawlSource = {
  id: number;
  name: string;
  skillCode: string;
  enabled: number;
  status: string | null;
  lastMessage: string | null;
  lastNewCount: number;
  lastRunAt: string | null;
};

type OldCrawlLog = {
  id: number;
  sourceId: number;
  sourceName: string;
  status: string;
  newCount: number;
  message: string | null;
  startedAt: string;
  finishedAt: string;
};

const prisma = new PrismaClient();

async function main() {
  const sqlitePath = path.resolve(process.cwd(), "prisma", "dev.db");
  const nodeRequire = createRequire(import.meta.url);
  const { DatabaseSync } = nodeRequire("node:sqlite") as {
    DatabaseSync: new (path: string) => {
      prepare: (sql: string) => { all: () => unknown[] };
    };
  };
  const sqlite = new DatabaseSync(sqlitePath);

  const users = sqlite.prepare("SELECT * FROM User ORDER BY id").all() as OldUser[];
  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
      },
      create: {
        username: user.username,
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
      },
    });
  }

  const regions = sqlite.prepare("SELECT * FROM Region ORDER BY code").all() as OldRegion[];
  for (const region of regions) {
    await prisma.region.upsert({
      where: { code: region.code },
      update: { name: region.name, level: region.level, parentCode: region.parentCode },
      create: region,
    });
  }

  const sourceIdMap = new Map<number, number>();
  const sources = sqlite.prepare("SELECT * FROM CrawlSource ORDER BY id").all() as OldCrawlSource[];
  for (const source of sources) {
    const saved = await prisma.crawlSource.upsert({
      where: { skillCode: source.skillCode },
      update: { name: source.name, enabled: source.enabled === 1 },
      create: {
        name: source.name,
        skillCode: source.skillCode,
        enabled: source.enabled === 1,
        status: source.status,
        lastMessage: source.lastMessage,
        lastNewCount: source.lastNewCount,
        lastRunAt: source.lastRunAt ? new Date(source.lastRunAt) : null,
      },
    });
    sourceIdMap.set(source.id, saved.id);
  }

  const tenders = sqlite.prepare("SELECT * FROM Tender ORDER BY id").all() as OldTender[];
  let imported = 0;
  for (const tender of tenders) {
    const data = {
      title: tender.title,
      type: tender.type,
      provinceCode: tender.provinceCode,
      cityCode: tender.cityCode,
      publishDate: new Date(tender.publishDate),
      expireDate: tender.expireDate ? new Date(tender.expireDate) : null,
      purchaser: tender.purchaser,
      agency: tender.agency,
      sourceName: tender.sourceName,
      sourceUrl: tender.sourceUrl,
      content: tender.content,
      fieldsConfidence: { "*": 0.5 },
      createdAt: new Date(tender.createdAt),
      updatedAt: new Date(tender.updatedAt),
    };

    if (tender.sourceUrl) {
      await prisma.tender.upsert({
        where: { sourceUrl: tender.sourceUrl },
        update: data,
        create: data,
      });
      imported++;
    } else {
      const duplicate = await prisma.tender.findFirst({
        where: { title: tender.title, publishDate: new Date(tender.publishDate), sourceName: tender.sourceName },
        select: { id: true },
      });
      if (!duplicate) {
        await prisma.tender.create({ data });
        imported++;
      }
    }
  }

  const logs = sqlite.prepare("SELECT * FROM CrawlLog ORDER BY id").all() as OldCrawlLog[];
  let importedLogs = 0;
  for (const log of logs) {
    const sourceId = sourceIdMap.get(log.sourceId);
    if (!sourceId) continue;
    const startedAt = new Date(log.startedAt);
    const duplicate = await prisma.crawlLog.findFirst({
      where: { sourceId, startedAt, status: log.status },
      select: { id: true },
    });
    if (duplicate) continue;
    await prisma.crawlLog.create({
      data: {
        sourceId,
        sourceName: log.sourceName,
        status: log.status,
        trigger: "manual",
        newCount: log.newCount,
        message: log.message,
        startedAt,
        finishedAt: new Date(log.finishedAt),
        durationMs: new Date(log.finishedAt).getTime() - startedAt.getTime(),
      },
    });
    importedLogs++;
  }

  console.log(
    `SQLite → PostgreSQL：用户 ${users.length}，地区 ${regions.length}，数据源 ${sources.length}，公告 ${imported}/${tenders.length}，日志 ${importedLogs}/${logs.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
