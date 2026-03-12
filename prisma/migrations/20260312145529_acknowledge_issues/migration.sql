-- CreateTable
CREATE TABLE "AcknowledgedIssue" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "issueCode" TEXT NOT NULL,
    "notes" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcknowledgedIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcknowledgedIssue_saleId_idx" ON "AcknowledgedIssue"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "AcknowledgedIssue_saleId_issueCode_key" ON "AcknowledgedIssue"("saleId", "issueCode");

-- AddForeignKey
ALTER TABLE "AcknowledgedIssue" ADD CONSTRAINT "AcknowledgedIssue_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
