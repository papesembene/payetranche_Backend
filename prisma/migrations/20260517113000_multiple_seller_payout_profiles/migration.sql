-- AlterTable
ALTER TABLE "public"."SellerPayoutProfile" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Existing single-account tenants become the default account.
UPDATE "public"."SellerPayoutProfile" SET "isDefault" = true;

-- Replace single profile per tenant with one profile per operator.
DROP INDEX IF EXISTS "public"."SellerPayoutProfile_tenantId_key";

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayoutProfile_tenantId_operator_key" ON "public"."SellerPayoutProfile"("tenantId", "operator");

-- CreateIndex
CREATE INDEX "SellerPayoutProfile_tenantId_idx" ON "public"."SellerPayoutProfile"("tenantId");

-- CreateIndex
CREATE INDEX "SellerPayoutProfile_tenantId_isDefault_idx" ON "public"."SellerPayoutProfile"("tenantId", "isDefault");
