-- CreateTable
CREATE TABLE "phase_weekly_progresses" (
    "id" UUID NOT NULL,
    "phaseId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "actualPercent" DECIMAL(5,2) NOT NULL,
    "deltaPercent" DECIMAL(5,2),
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phase_weekly_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phase_weekly_progresses_phaseId_weekNumber_key" ON "phase_weekly_progresses"("phaseId", "weekNumber");

-- AddForeignKey
ALTER TABLE "phase_weekly_progresses" ADD CONSTRAINT "phase_weekly_progresses_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "masterplan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
