-- CreateTable
CREATE TABLE "CancelledSaleLog" (
    "id" TEXT NOT NULL,
    "originalSaleId" TEXT NOT NULL,
    "clientName" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "itemsSummary" TEXT,
    "paymentMethods" TEXT,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleCreatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CancelledSaleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CancelledSaleLog_cancelledAt_idx" ON "CancelledSaleLog"("cancelledAt");
