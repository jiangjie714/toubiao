-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushWatch" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "type" TEXT,
    "provinceCode" TEXT,
    "cityCode" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "channels" JSONB NOT NULL DEFAULT '["email"]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastPushAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushRecord" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "watchId" INTEGER,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_createdAt_idx" ON "EmailVerificationToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PushWatch_userId_enabled_idx" ON "PushWatch"("userId", "enabled");

-- CreateIndex
CREATE INDEX "PushRecord_sentAt_idx" ON "PushRecord"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushRecord_userId_tenderId_key" ON "PushRecord"("userId", "tenderId");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushWatch" ADD CONSTRAINT "PushWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushRecord" ADD CONSTRAINT "PushRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushRecord" ADD CONSTRAINT "PushRecord_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushRecord" ADD CONSTRAINT "PushRecord_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "PushWatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
