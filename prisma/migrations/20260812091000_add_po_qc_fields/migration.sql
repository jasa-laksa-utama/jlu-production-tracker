ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "qcStatus" TEXT DEFAULT 'NONE';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "qcRequestedAt" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "qcApprovedAt" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "qcApprovedBy" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "qcNotes" TEXT;
