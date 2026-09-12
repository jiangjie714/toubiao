-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "prepayCode" TEXT,
ADD COLUMN     "prepayExpiresAt" TIMESTAMP(3);
