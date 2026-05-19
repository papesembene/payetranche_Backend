-- CreateEnum
CREATE TYPE "public"."PayoutOperator" AS ENUM ('WAVE', 'ORANGE_MONEY', 'FREE_MONEY');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."WalletTransactionType" AS ENUM ('COLLECTION', 'COMMISSION', 'PAYOUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "public"."SellerPayoutProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operator" "public"."PayoutOperator" NOT NULL,
    "phone" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SellerWallet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "availableAmount" INTEGER NOT NULL DEFAULT 0,
    "pendingAmount" INTEGER NOT NULL DEFAULT 0,
    "paidOutAmount" INTEGER NOT NULL DEFAULT 0,
    "totalCollected" INTEGER NOT NULL DEFAULT 0,
    "totalFees" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WalletTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "paymentId" TEXT,
    "externalPaymentId" TEXT,
    "payoutId" TEXT,
    "type" "public"."WalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SellerPayout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "paymentId" TEXT,
    "externalPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL,
    "operator" "public"."PayoutOperator" NOT NULL,
    "phone" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayoutProfile_tenantId_key" ON "public"."SellerPayoutProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerWallet_tenantId_key" ON "public"."SellerWallet"("tenantId");

-- CreateIndex
CREATE INDEX "WalletTransaction_tenantId_idx" ON "public"."WalletTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "WalletTransaction_tenantId_type_idx" ON "public"."WalletTransaction"("tenantId", "type");

-- CreateIndex
CREATE INDEX "WalletTransaction_tenantId_clientId_idx" ON "public"."WalletTransaction"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "WalletTransaction_tenantId_paymentId_idx" ON "public"."WalletTransaction"("tenantId", "paymentId");

-- CreateIndex
CREATE INDEX "WalletTransaction_tenantId_externalPaymentId_idx" ON "public"."WalletTransaction"("tenantId", "externalPaymentId");

-- CreateIndex
CREATE INDEX "WalletTransaction_tenantId_payoutId_idx" ON "public"."WalletTransaction"("tenantId", "payoutId");

-- CreateIndex
CREATE INDEX "SellerPayout_tenantId_idx" ON "public"."SellerPayout"("tenantId");

-- CreateIndex
CREATE INDEX "SellerPayout_tenantId_status_idx" ON "public"."SellerPayout"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SellerPayout_tenantId_clientId_idx" ON "public"."SellerPayout"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "SellerPayout_tenantId_paymentId_idx" ON "public"."SellerPayout"("tenantId", "paymentId");

-- CreateIndex
CREATE INDEX "SellerPayout_tenantId_externalPaymentId_idx" ON "public"."SellerPayout"("tenantId", "externalPaymentId");

-- AddForeignKey
ALTER TABLE "public"."SellerPayoutProfile" ADD CONSTRAINT "SellerPayoutProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SellerWallet" ADD CONSTRAINT "SellerWallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_externalPaymentId_fkey" FOREIGN KEY ("externalPaymentId") REFERENCES "public"."ExternalPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."SellerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SellerPayout" ADD CONSTRAINT "SellerPayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SellerPayout" ADD CONSTRAINT "SellerPayout_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SellerPayout" ADD CONSTRAINT "SellerPayout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SellerPayout" ADD CONSTRAINT "SellerPayout_externalPaymentId_fkey" FOREIGN KEY ("externalPaymentId") REFERENCES "public"."ExternalPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
