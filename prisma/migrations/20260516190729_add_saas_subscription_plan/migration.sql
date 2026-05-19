-- CreateEnum
CREATE TYPE "public"."SubscriptionPlan" AS ENUM ('GRATUIT', 'PRO', 'ENTREPRISE');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "plan" "public"."SubscriptionPlan" NOT NULL DEFAULT 'GRATUIT';
