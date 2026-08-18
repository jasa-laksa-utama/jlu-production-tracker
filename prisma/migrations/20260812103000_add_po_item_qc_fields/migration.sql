ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qcStatus" TEXT DEFAULT 'NONE';
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qtyPassed" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qtyFailed" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qcDefectReason" TEXT;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qcApprovedAt" TIMESTAMP(3);
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qcApprovedBy" TEXT;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "qcNotes" TEXT;
