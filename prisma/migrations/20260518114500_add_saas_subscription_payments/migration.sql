CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'COMPLETED', 'CANCELLED', 'FAILED');

ALTER TABLE "User" ADD COLUMN "planExpiresAt" TIMESTAMP(3);

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "refCommand" TEXT NOT NULL,
    "providerToken" TEXT,
    "redirectUrl" TEXT,
    "targetPayment" TEXT,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "rawWebhook" JSONB,
    "paidAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPayment_refCommand_key" ON "SubscriptionPayment"("refCommand");
CREATE INDEX "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");
CREATE INDEX "SubscriptionPayment_tenantId_status_idx" ON "SubscriptionPayment"("tenantId", "status");
CREATE INDEX "SubscriptionPayment_tenantId_plan_idx" ON "SubscriptionPayment"("tenantId", "plan");
CREATE INDEX "SubscriptionPayment_userId_idx" ON "SubscriptionPayment"("userId");

ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
