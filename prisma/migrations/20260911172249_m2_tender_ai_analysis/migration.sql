-- CreateTable
CREATE TABLE "TenderAiAnalysis" (
    "id" SERIAL NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "riskRadar" JSONB NOT NULL,
    "scoringMethod" JSONB NOT NULL,
    "timelineAndKey" JSONB NOT NULL,
    "modelUsed" TEXT NOT NULL DEFAULT 'builtin-heuristic-v1',
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderAiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenderAiAnalysis_tenderId_key" ON "TenderAiAnalysis"("tenderId");

-- CreateIndex
CREATE INDEX "TenderAiAnalysis_status_createdAt_idx" ON "TenderAiAnalysis"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TenderAiAnalysis" ADD CONSTRAINT "TenderAiAnalysis_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
