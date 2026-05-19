-- CreateEnum
CREATE TYPE "public"."InstallmentStatus" AS ENUM ('A_VENIR', 'PAYEE', 'EN_RETARD', 'ANNULEE');

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN "installmentId" TEXT;

-- CreateTable
CREATE TABLE "public"."Installment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "remainingAmount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."InstallmentStatus" NOT NULL DEFAULT 'A_VENIR',
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Installment_creditId_number_key" ON "public"."Installment"("creditId", "number");

-- CreateIndex
CREATE INDEX "Installment_tenantId_idx" ON "public"."Installment"("tenantId");

-- CreateIndex
CREATE INDEX "Installment_tenantId_clientId_idx" ON "public"."Installment"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "Installment_tenantId_creditId_idx" ON "public"."Installment"("tenantId", "creditId");

-- CreateIndex
CREATE INDEX "Installment_tenantId_status_idx" ON "public"."Installment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Installment_tenantId_dueDate_idx" ON "public"."Installment"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "Payment_tenantId_installmentId_idx" ON "public"."Payment"("tenantId", "installmentId");

-- AddForeignKey
ALTER TABLE "public"."Installment" ADD CONSTRAINT "Installment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Installment" ADD CONSTRAINT "Installment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Installment" ADD CONSTRAINT "Installment_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "public"."Credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "public"."Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
