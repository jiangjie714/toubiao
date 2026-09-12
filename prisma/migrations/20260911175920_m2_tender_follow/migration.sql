-- CreateTable
CREATE TABLE "TenderFollow" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EVALUATING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assignee" TEXT,
    "targetAmount" DECIMAL(14,2),
    "notes" TEXT,
    "winRateScore" INTEGER,
    "remindDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenderFollow_userId_status_idx" ON "TenderFollow"("userId", "status");

-- CreateIndex
CREATE INDEX "TenderFollow_userId_createdAt_idx" ON "TenderFollow"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenderFollow_userId_tenderId_key" ON "TenderFollow"("userId", "tenderId");

-- AddForeignKey
ALTER TABLE "TenderFollow" ADD CONSTRAINT "TenderFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderFollow" ADD CONSTRAINT "TenderFollow_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
