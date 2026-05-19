-- AlterTable
ALTER TABLE "public"."ExternalPayment" ADD COLUMN "installmentId" TEXT;

-- CreateIndex
CREATE INDEX "ExternalPayment_tenantId_installmentId_idx" ON "public"."ExternalPayment"("tenantId", "installmentId");

-- AddForeignKey
ALTER TABLE "public"."ExternalPayment" ADD CONSTRAINT "ExternalPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "public"."Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
