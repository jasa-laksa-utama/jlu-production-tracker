-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qcAttachments" TEXT[] DEFAULT ARRAY[]::TEXT[];
