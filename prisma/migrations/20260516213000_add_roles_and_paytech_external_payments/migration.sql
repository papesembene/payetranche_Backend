-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "public"."ExternalPaymentProvider" AS ENUM ('PAYTECH');

-- CreateEnum
CREATE TYPE "public"."ExternalPaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN "role" "public"."UserRole" NOT NULL DEFAULT 'OWNER';

-- Keep existing local/demo users without deleting data before enforcing SaaS-wide unique login emails.
WITH duplicates AS (
    SELECT
        "id",
        "email",
        ROW_NUMBER() OVER (PARTITION BY "email" ORDER BY "createdAt", "id") AS rn
    FROM "public"."User"
)
UPDATE "public"."User" u
SET "email" = CONCAT(split_part(u."email", '@', 1), '+', LEFT(u."tenantId", 8), '@', split_part(u."email", '@', 2))
FROM duplicates d
WHERE u."id" = d."id" AND d.rn > 1;

-- Replace tenant-scoped email uniqueness with global SaaS login uniqueness.
DROP INDEX IF EXISTS "public"."User_tenantId_email_key";
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateTable
CREATE TABLE "public"."ExternalPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "creditId" TEXT,
    "paymentId" TEXT,
    "requestedById" TEXT,
    "provider" "public"."ExternalPaymentProvider" NOT NULL DEFAULT 'PAYTECH',
    "status" "public"."ExternalPaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "refCommand" TEXT NOT NULL,
    "providerToken" TEXT,
    "redirectUrl" TEXT,
    "targetPayment" TEXT,
    "clientPhone" TEXT,
    "providerMethod" TEXT,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "rawWebhook" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayment_paymentId_key" ON "public"."ExternalPayment"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayment_refCommand_key" ON "public"."ExternalPayment"("refCommand");

-- CreateIndex
CREATE INDEX "ExternalPayment_tenantId_idx" ON "public"."ExternalPayment"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalPayment_tenantId_clientId_idx" ON "public"."ExternalPayment"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "ExternalPayment_tenantId_creditId_idx" ON "public"."ExternalPayment"("tenantId", "creditId");

-- CreateIndex
CREATE INDEX "ExternalPayment_tenantId_status_idx" ON "public"."ExternalPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ExternalPayment_providerToken_idx" ON "public"."ExternalPayment"("providerToken");

-- AddForeignKey
ALTER TABLE "public"."ExternalPayment" ADD CONSTRAINT "ExternalPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalPayment" ADD CONSTRAINT "ExternalPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalPayment" ADD CONSTRAINT "ExternalPayment_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "public"."Credit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalPayment" ADD CONSTRAINT "ExternalPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalPayment" ADD CONSTRAINT "ExternalPayment_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
