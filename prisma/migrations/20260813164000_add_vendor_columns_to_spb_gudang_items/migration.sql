-- AlterTable
ALTER TABLE "spb_gudang_items"
ADD COLUMN IF NOT EXISTS "selectedSupplierId" UUID,
ADD COLUMN IF NOT EXISTS "selectedSupplierName" TEXT,
ADD COLUMN IF NOT EXISTS "selectedCatalogPrice" DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS "candidateSuppliers" JSONB,
ADD COLUMN IF NOT EXISTS "vendorSelectionStatus" TEXT DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "vendorSelectionNote" TEXT,
ADD COLUMN IF NOT EXISTS "approvalPm" TEXT DEFAULT 'NONE';
