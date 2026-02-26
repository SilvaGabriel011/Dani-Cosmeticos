-- AlterTable
ALTER TABLE "Brand" ALTER COLUMN "defaultProfitMargin" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "profitMargin" SET DATA TYPE DECIMAL(10,2);

-- CreateTable
CREATE TABLE "ProductCostEntry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCostEntry_productId_idx" ON "ProductCostEntry"("productId");

-- CreateIndex
CREATE INDEX "ProductCostEntry_createdAt_idx" ON "ProductCostEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductCostEntry" ADD CONSTRAINT "ProductCostEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
