-- Add the remaining balance first and backfill existing credits.
ALTER TABLE "Credit" ADD COLUMN "remainingAmount" INTEGER;

UPDATE "Credit"
SET "remainingAmount" = GREATEST("amount" - "paidAmount", 0);

ALTER TABLE "Credit" ALTER COLUMN "remainingAmount" SET NOT NULL;

-- Convert CreditStatus from the first English enum to PayTranche business values.
ALTER TABLE "Credit" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "CreditStatus" RENAME TO "CreditStatus_old";
CREATE TYPE "CreditStatus" AS ENUM ('ACTIF', 'PAYE', 'EN_RETARD', 'ANNULE');

ALTER TABLE "Credit"
ALTER COLUMN "status" TYPE "CreditStatus"
USING (
  CASE "status"::text
    WHEN 'ACTIVE' THEN 'ACTIF'
    WHEN 'PAID' THEN 'PAYE'
    WHEN 'OVERDUE' THEN 'EN_RETARD'
    WHEN 'CANCELLED' THEN 'ANNULE'
    ELSE 'ACTIF'
  END
)::"CreditStatus";

ALTER TABLE "Credit" ALTER COLUMN "status" SET DEFAULT 'ACTIF';
DROP TYPE "CreditStatus_old";
