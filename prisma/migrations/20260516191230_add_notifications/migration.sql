-- CreateEnum
CREATE TYPE "public"."AlertType" AS ENUM ('CREDIT_OVERDUE', 'CLIENT_RISK');

-- CreateEnum
CREATE TYPE "public"."AlertStatus" AS ENUM ('PENDING', 'SENT', 'READ');

-- CreateEnum
CREATE TYPE "public"."AlertChannel" AS ENUM ('IN_APP', 'SMS', 'WHATSAPP');

-- CreateTable
CREATE TABLE "public"."Alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "creditId" TEXT,
    "type" "public"."AlertType" NOT NULL,
    "status" "public"."AlertStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "public"."AlertChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_tenantId_idx" ON "public"."Alert"("tenantId");

-- CreateIndex
CREATE INDEX "Alert_tenantId_status_idx" ON "public"."Alert"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Alert_tenantId_type_idx" ON "public"."Alert"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Alert_tenantId_clientId_idx" ON "public"."Alert"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "Alert_tenantId_creditId_idx" ON "public"."Alert"("tenantId", "creditId");

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "public"."Credit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
