-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "showPhotosInPrint" BOOLEAN NOT NULL DEFAULT true;
