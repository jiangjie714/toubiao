-- CreateTable
CREATE TABLE "TenderFeedback" (
    "id" SERIAL NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "userId" INTEGER,
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenderFeedback_tenderId_idx" ON "TenderFeedback"("tenderId");

-- CreateIndex
CREATE INDEX "TenderFeedback_status_createdAt_idx" ON "TenderFeedback"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TenderFeedback" ADD CONSTRAINT "TenderFeedback_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderFeedback" ADD CONSTRAINT "TenderFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
