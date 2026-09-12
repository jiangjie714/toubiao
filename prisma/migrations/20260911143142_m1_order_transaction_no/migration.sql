-- AlterTable
ALTER TABLE "Order" ADD COLUMN "transactionNo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_transactionNo_key" ON "Order"("transactionNo");
