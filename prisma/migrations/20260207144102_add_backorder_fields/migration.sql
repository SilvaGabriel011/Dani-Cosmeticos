-- AlterEnum
ALTER TYPE "ReceivableStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'BACKORDER';

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "backorderFulfilledAt" TIMESTAMP(3),
ADD COLUMN     "isBackorder" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SaleItem_isBackorder_idx" ON "SaleItem"("isBackorder");
