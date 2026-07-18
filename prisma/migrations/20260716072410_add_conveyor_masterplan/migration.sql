-- CreateTable
CREATE TABLE "masterplans" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "totalWeeks" INTEGER NOT NULL DEFAULT 30,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "masterplans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "division_leaders" (
    "id" UUID NOT NULL,
    "masterplanId" UUID NOT NULL,
    "divisionName" TEXT NOT NULL,
    "leaderName" TEXT NOT NULL,
    "leaderUserId" UUID,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "division_leaders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "masterplan_phases" (
    "id" UUID NOT NULL,
    "masterplanId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "weightPercent" DECIMAL(5,2) NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "planProgress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actualProgress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "masterplan_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_sub_steps" (
    "id" UUID NOT NULL,
    "phaseId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "weightPercent" DECIMAL(5,2) NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "checkedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phase_sub_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conveyor_units" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "satuan" TEXT NOT NULL DEFAULT 'unit',
    "volume" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conveyor_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_progresses" (
    "id" UUID NOT NULL,
    "phaseId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "weightPercent" DECIMAL(5,2) NOT NULL,
    "actualPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_items" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "cuttingDone" BOOLEAN NOT NULL DEFAULT false,
    "settingDone" BOOLEAN NOT NULL DEFAULT false,
    "weldingDone" BOOLEAN NOT NULL DEFAULT false,
    "finishingDone" BOOLEAN NOT NULL DEFAULT false,
    "paintingDone" BOOLEAN NOT NULL DEFAULT false,
    "packagingDone" BOOLEAN NOT NULL DEFAULT false,
    "progressPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structure_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanical_items" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "satuan" TEXT NOT NULL DEFAULT 'pcs',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "procurementDone" BOOLEAN NOT NULL DEFAULT false,
    "poDone" BOOLEAN NOT NULL DEFAULT false,
    "fabricationDone" BOOLEAN NOT NULL DEFAULT false,
    "packagingDone" BOOLEAN NOT NULL DEFAULT false,
    "progressPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanical_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plans" (
    "id" UUID NOT NULL,
    "masterplanId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "planCumulativePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "planWeeklyPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actualCumulativePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actualWeeklyPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "masterplans_projectId_key" ON "masterplans"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "division_leaders_masterplanId_divisionName_key" ON "division_leaders"("masterplanId", "divisionName");

-- CreateIndex
CREATE UNIQUE INDEX "masterplan_phases_masterplanId_code_key" ON "masterplan_phases"("masterplanId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "conveyor_units_projectId_name_key" ON "conveyor_units"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "unit_progresses_phaseId_unitId_key" ON "unit_progresses"("phaseId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_plans_masterplanId_weekNumber_key" ON "weekly_plans"("masterplanId", "weekNumber");

-- AddForeignKey
ALTER TABLE "masterplans" ADD CONSTRAINT "masterplans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "division_leaders" ADD CONSTRAINT "division_leaders_masterplanId_fkey" FOREIGN KEY ("masterplanId") REFERENCES "masterplans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "masterplan_phases" ADD CONSTRAINT "masterplan_phases_masterplanId_fkey" FOREIGN KEY ("masterplanId") REFERENCES "masterplans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_sub_steps" ADD CONSTRAINT "phase_sub_steps_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "masterplan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conveyor_units" ADD CONSTRAINT "conveyor_units_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_progresses" ADD CONSTRAINT "unit_progresses_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "masterplan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_progresses" ADD CONSTRAINT "unit_progresses_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "conveyor_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_items" ADD CONSTRAINT "structure_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "conveyor_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanical_items" ADD CONSTRAINT "mechanical_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "conveyor_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_masterplanId_fkey" FOREIGN KEY ("masterplanId") REFERENCES "masterplans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
