-- AlterTable
ALTER TABLE "spb_items" ADD COLUMN "selectedSupplierId" UUID,
ADD COLUMN "selectedSupplierName" TEXT,
ADD COLUMN "selectedCatalogPrice" DECIMAL(18,2);
