-- CreateEnum
CREATE TYPE "public"."ClientStatus" AS ENUM ('BON', 'RISQUE', 'MAUVAIS');

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "status" "public"."ClientStatus" NOT NULL DEFAULT 'BON',
ADD COLUMN     "totalDebt" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Client_tenantId_status_idx" ON "public"."Client"("tenantId", "status");
