-- AlterTable
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "phase_weekly_targets" (
    "id" UUID NOT NULL,
    "phaseId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "targetPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phase_weekly_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "phase_weekly_targets_phaseId_weekNumber_key" ON "phase_weekly_targets"("phaseId", "weekNumber");

-- AddForeignKey
ALTER TABLE "phase_weekly_targets" ADD CONSTRAINT "phase_weekly_targets_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "masterplan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
