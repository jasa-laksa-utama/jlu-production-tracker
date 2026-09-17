-- CreateTable
CREATE TABLE IF NOT EXISTS "progress_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "unitId" UUID,
    "phaseId" UUID,
    "category" TEXT NOT NULL DEFAULT 'FABRICATION',
    "caption" TEXT,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'progress_photos_projectId_fkey'
    ) THEN
        ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'progress_photos_unitId_fkey'
    ) THEN
        ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "conveyor_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'progress_photos_phaseId_fkey'
    ) THEN
        ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "masterplan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
