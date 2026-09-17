-- AlterTable
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;

-- Backfill existing records with Super Admin
UPDATE "shipments" SET "createdByName" = 'Super Admin' WHERE "createdByName" IS NULL;
