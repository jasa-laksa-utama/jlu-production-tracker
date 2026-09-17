-- AlterTable
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "expeditionName" TEXT,
ADD COLUMN IF NOT EXISTS "driverName" TEXT,
ADD COLUMN IF NOT EXISTS "driverPhone" TEXT,
ADD COLUMN IF NOT EXISTS "vehiclePlateNumber" TEXT;

-- AlterTable
ALTER TABLE "progress_photos" ADD COLUMN IF NOT EXISTS "componentId" UUID,
ADD COLUMN IF NOT EXISTS "componentType" TEXT,
ADD COLUMN IF NOT EXISTS "stage" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "progress_photos_componentId_stage_idx" ON "progress_photos"("componentId", "stage");
