-- AlterTable
ALTER TABLE "goods_return_records" ADD COLUMN IF NOT EXISTS "warehouseStatus" TEXT NOT NULL DEFAULT 'PENDING_ACC',
ADD COLUMN IF NOT EXISTS "warehouseApprovedBy" TEXT,
ADD COLUMN IF NOT EXISTS "warehouseApprovedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "warehouseNotes" TEXT;
