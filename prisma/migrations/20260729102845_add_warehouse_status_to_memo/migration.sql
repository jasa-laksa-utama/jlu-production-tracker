-- AlterTable
ALTER TABLE "goods_release_memos" ADD COLUMN IF NOT EXISTS "warehouseStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "warehouseIssuedBy" TEXT,
ADD COLUMN IF NOT EXISTS "warehouseIssuedAt" TIMESTAMP(3);
