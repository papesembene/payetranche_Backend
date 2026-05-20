ALTER TABLE "public"."SellerPayout"
ADD COLUMN "manualReference" TEXT,
ADD COLUMN "manualNote" TEXT,
ADD COLUMN "manuallyMarkedAt" TIMESTAMP(3),
ADD COLUMN "manuallyMarkedBy" TEXT;
