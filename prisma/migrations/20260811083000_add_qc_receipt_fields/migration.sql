ALTER TABLE "purchase_order_receipts" ADD COLUMN IF NOT EXISTS "qcStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "purchase_order_receipts" ADD COLUMN IF NOT EXISTS "qcExternalId" TEXT;
ALTER TABLE "purchase_order_receipts" ADD COLUMN IF NOT EXISTS "qcApprovedAt" TIMESTAMP(3);
ALTER TABLE "purchase_order_receipts" ADD COLUMN IF NOT EXISTS "qcApprovedBy" TEXT;
ALTER TABLE "purchase_order_receipts" ADD COLUMN IF NOT EXISTS "qcNotes" TEXT;
ALTER TABLE "purchase_order_receipts" ADD COLUMN IF NOT EXISTS "qcReportUrl" TEXT;

ALTER TABLE "purchase_order_receipt_items" ADD COLUMN IF NOT EXISTS "qcStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "purchase_order_receipt_items" ADD COLUMN IF NOT EXISTS "qtyPassed" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "purchase_order_receipt_items" ADD COLUMN IF NOT EXISTS "qtyFailed" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "purchase_order_receipt_items" ADD COLUMN IF NOT EXISTS "qcDefectReason" TEXT;
