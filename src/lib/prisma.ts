import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// 针对 SQLite 模式下自动初始化执行 WAL 预写日志与并发缓存 PRAGMA 配置
const dbUrl = process.env.DATABASE_URL || "";
if (dbUrl.startsWith("file:") || dbUrl.includes(".db") || dbUrl.includes("sqlite")) {
  prisma
    .$queryRawUnsafe("PRAGMA journal_mode = WAL;")
    .then(() =>
      Promise.all([
        prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;"),
        prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;"),
        prisma.$queryRawUnsafe("PRAGMA cache_size = -64000;"),
        prisma.$queryRawUnsafe("PRAGMA temp_store = MEMORY;"),
      ])
    )
    .catch((err) => {
      console.warn("Prisma SQLite PRAGMA initialization warning:", err?.message || err);
    });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
