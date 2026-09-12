-- AlterTable
ALTER TABLE "TenderFollow" ADD COLUMN     "teamId" INTEGER;

-- CreateTable
CREATE TABLE "TenderFollowComment" (
    "id" SERIAL NOT NULL,
    "followId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderFollowComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenderFollowComment_followId_createdAt_idx" ON "TenderFollowComment"("followId", "createdAt");

-- CreateIndex
CREATE INDEX "TenderFollowComment_userId_idx" ON "TenderFollowComment"("userId");

-- CreateIndex
CREATE INDEX "TenderFollow_teamId_status_idx" ON "TenderFollow"("teamId", "status");

-- CreateIndex
CREATE INDEX "TenderFollow_teamId_createdAt_idx" ON "TenderFollow"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "TenderFollow" ADD CONSTRAINT "TenderFollow_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderFollowComment" ADD CONSTRAINT "TenderFollowComment_followId_fkey" FOREIGN KEY ("followId") REFERENCES "TenderFollow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderFollowComment" ADD CONSTRAINT "TenderFollowComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
