-- CreateTable
CREATE TABLE "ExportAudit" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "filters" JSONB NOT NULL,
    "matchedCount" INTEGER NOT NULL,
    "exportedCount" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportAudit_userId_createdAt_idx" ON "ExportAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportAudit_createdAt_idx" ON "ExportAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "ExportAudit" ADD CONSTRAINT "ExportAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
