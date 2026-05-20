ALTER TABLE "public"."Credit"
ADD COLUMN "clientPortalToken" TEXT;

CREATE UNIQUE INDEX "Credit_clientPortalToken_key"
ON "public"."Credit"("clientPortalToken");

CREATE INDEX "Credit_clientPortalToken_idx"
ON "public"."Credit"("clientPortalToken");
