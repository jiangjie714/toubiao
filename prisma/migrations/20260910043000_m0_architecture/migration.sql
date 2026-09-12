-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentCode" TEXT,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "IndustryDict" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "IndustryDict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "projectNo" TEXT,
    "canonicalTitle" TEXT NOT NULL,
    "provinceCode" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provinceCode" TEXT,
    "cityCode" TEXT,
    "publishDate" TIMESTAMP(3) NOT NULL,
    "expireDate" TIMESTAMP(3),
    "purchaser" TEXT,
    "agency" TEXT,
    "sourceName" TEXT NOT NULL DEFAULT '手动录入',
    "sourceUrl" TEXT,
    "content" TEXT NOT NULL,
    "projectNo" TEXT,
    "budgetAmount" DECIMAL(14,2),
    "awardAmount" DECIMAL(14,2),
    "openTime" TIMESTAMP(3),
    "industryCode" TEXT,
    "winningSupplier" TEXT,
    "contentHtml" TEXT,
    "projectRefId" INTEGER,
    "fieldsConfidence" JSONB,
    "fieldSources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "size" INTEGER,
    "contentType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgContact" (
    "id" SERIAL NOT NULL,
    "orgName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "source" TEXT NOT NULL DEFAULT 'extracted',
    "tenderId" INTEGER,

    CONSTRAINT "OrgContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlSource" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "skillCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleCron" TEXT NOT NULL DEFAULT '0 */2 * * *',
    "nextRunAt" TIMESTAMP(3),
    "requestDelayMs" INTEGER NOT NULL DEFAULT 1200,
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "timeoutMs" INTEGER NOT NULL DEFAULT 20000,
    "retries" INTEGER NOT NULL DEFAULT 2,
    "maxPages" INTEGER NOT NULL DEFAULT 1,
    "proxyPolicy" TEXT NOT NULL DEFAULT 'off',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "healthScore" INTEGER,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "configVersion" INTEGER,
    "status" TEXT,
    "lastMessage" TEXT,
    "lastNewCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),

    CONSTRAINT "CrawlSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillRevision" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "skillCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "configYaml" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT 'system',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlLog" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "httpOk" INTEGER NOT NULL DEFAULT 0,
    "httpFail" INTEGER NOT NULL DEFAULT 0,
    "itemsParsed" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlTask" (
    "id" SERIAL NOT NULL,
    "skillCode" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "CrawlTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "condition" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRecord" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Region_parentCode_idx" ON "Region"("parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryDict_code_key" ON "IndustryDict"("code");

-- CreateIndex
CREATE INDEX "IndustryDict_parentId_idx" ON "IndustryDict"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectNo_key" ON "Project"("projectNo");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_sourceUrl_key" ON "Tender"("sourceUrl");

-- CreateIndex
CREATE INDEX "Tender_projectNo_idx" ON "Tender"("projectNo");

-- CreateIndex
CREATE INDEX "Tender_projectRefId_idx" ON "Tender"("projectRefId");

-- CreateIndex
CREATE INDEX "Tender_publishDate_type_idx" ON "Tender"("publishDate", "type");

-- CreateIndex
CREATE INDEX "Tender_type_idx" ON "Tender"("type");

-- CreateIndex
CREATE INDEX "Tender_provinceCode_cityCode_idx" ON "Tender"("provinceCode", "cityCode");

-- CreateIndex
CREATE INDEX "Attachment_tenderId_idx" ON "Attachment"("tenderId");

-- CreateIndex
CREATE INDEX "OrgContact_orgName_idx" ON "OrgContact"("orgName");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlSource_skillCode_key" ON "CrawlSource"("skillCode");

-- CreateIndex
CREATE UNIQUE INDEX "SkillRevision_skillCode_version_key" ON "SkillRevision"("skillCode", "version");

-- CreateIndex
CREATE INDEX "CrawlLog_sourceId_startedAt_idx" ON "CrawlLog"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "CrawlTask_status_nextRetryAt_idx" ON "CrawlTask"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "AlertRule_enabled_scope_idx" ON "AlertRule"("enabled", "scope");

-- CreateIndex
CREATE INDEX "AlertRecord_ruleId_firedAt_idx" ON "AlertRecord"("ruleId", "firedAt");

-- AddForeignKey
ALTER TABLE "IndustryDict" ADD CONSTRAINT "IndustryDict_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IndustryDict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_projectRefId_fkey" FOREIGN KEY ("projectRefId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgContact" ADD CONSTRAINT "OrgContact_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRevision" ADD CONSTRAINT "SkillRevision_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CrawlSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecord" ADD CONSTRAINT "AlertRecord_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

