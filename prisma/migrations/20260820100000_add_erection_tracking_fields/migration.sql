-- AlterTable
ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "erectionSettQty" INTEGER DEFAULT 0;
ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "erectionInstallQty" INTEGER DEFAULT 0;
ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "erectionFinishQty" INTEGER DEFAULT 0;
ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "erectionSettDone" BOOLEAN DEFAULT false;
ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "erectionInstallDone" BOOLEAN DEFAULT false;
ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "erectionFinishDone" BOOLEAN DEFAULT false;
ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "erectionProgress" DECIMAL(5,2) DEFAULT 0;

-- AlterTable
ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "erectionSettQty" INTEGER DEFAULT 0;
ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "erectionInstallQty" INTEGER DEFAULT 0;
ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "erectionFinishQty" INTEGER DEFAULT 0;
ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "erectionSettDone" BOOLEAN DEFAULT false;
ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "erectionInstallDone" BOOLEAN DEFAULT false;
ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "erectionFinishDone" BOOLEAN DEFAULT false;
ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "erectionProgress" DECIMAL(5,2) DEFAULT 0;
