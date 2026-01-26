/*
  Warnings:

  - A unique constraint covering the columns `[brandId,linha,fragrancia,categoryId,packagingType]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "defaultProfitMargin" DECIMAL(5,2) NOT NULL DEFAULT 35;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "importedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "fragrancia" TEXT,
ADD COLUMN     "linha" TEXT,
ADD COLUMN     "packagingType" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Product_linha_idx" ON "Product"("linha");

-- CreateIndex
CREATE INDEX "Product_fragrancia_idx" ON "Product"("fragrancia");

-- CreateIndex
CREATE UNIQUE INDEX "Product_brandId_linha_fragrancia_categoryId_packagingType_key" ON "Product"("brandId", "linha", "fragrancia", "categoryId", "packagingType");

-- CreateIndex
CREATE INDEX "SaleItem_addedAt_idx" ON "SaleItem"("addedAt");
