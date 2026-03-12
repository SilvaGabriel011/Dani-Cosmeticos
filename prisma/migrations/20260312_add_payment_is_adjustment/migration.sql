-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "isAdjustment" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Payment_isAdjustment_idx" ON "Payment"("isAdjustment");
