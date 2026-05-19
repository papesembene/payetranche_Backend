ALTER TABLE "public"."SellerPayout"
ADD COLUMN "providerTransferId" TEXT,
ADD COLUMN "providerTransferToken" TEXT,
ADD COLUMN "providerTransferState" TEXT,
ADD COLUMN "attemptedAt" TIMESTAMP(3),
ADD COLUMN "rawTransferRequest" JSONB,
ADD COLUMN "rawTransferResponse" JSONB,
ADD COLUMN "rawTransferCallback" JSONB;

CREATE UNIQUE INDEX "SellerPayout_providerTransferId_key"
ON "public"."SellerPayout"("providerTransferId");

CREATE INDEX "SellerPayout_providerTransferId_idx"
ON "public"."SellerPayout"("providerTransferId");
