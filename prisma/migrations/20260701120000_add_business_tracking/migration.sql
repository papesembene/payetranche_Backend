-- CreateEnum
CREATE TYPE "BusinessEntryType" AS ENUM ('SALE', 'SUPPLIER_PURCHASE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BusinessPaymentStatus" AS ENUM ('PAID', 'PARTIAL', 'UNPAID');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "type" "BusinessEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "remainingAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "BusinessPaymentStatus" NOT NULL DEFAULT 'PAID',
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_name_idx" ON "Supplier"("tenantId", "name");

-- CreateIndex
CREATE INDEX "BusinessEntry_tenantId_idx" ON "BusinessEntry"("tenantId");

-- CreateIndex
CREATE INDEX "BusinessEntry_tenantId_type_idx" ON "BusinessEntry"("tenantId", "type");

-- CreateIndex
CREATE INDEX "BusinessEntry_tenantId_supplierId_idx" ON "BusinessEntry"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "BusinessEntry_tenantId_occurredAt_idx" ON "BusinessEntry"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "BusinessEntry_tenantId_paymentStatus_idx" ON "BusinessEntry"("tenantId", "paymentStatus");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEntry" ADD CONSTRAINT "BusinessEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEntry" ADD CONSTRAINT "BusinessEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
