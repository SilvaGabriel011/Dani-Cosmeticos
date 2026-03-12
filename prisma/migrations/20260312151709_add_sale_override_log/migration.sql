-- CreateTable
CREATE TABLE "SaleOverrideLog" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "previousState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleOverrideLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleOverrideLog_saleId_idx" ON "SaleOverrideLog"("saleId");

-- CreateIndex
CREATE INDEX "SaleOverrideLog_createdAt_idx" ON "SaleOverrideLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SaleOverrideLog" ADD CONSTRAINT "SaleOverrideLog_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
