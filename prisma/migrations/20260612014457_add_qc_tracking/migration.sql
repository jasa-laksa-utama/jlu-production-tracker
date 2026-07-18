-- AlterTable
ALTER TABLE "production_stages" ADD COLUMN     "qcNotes" TEXT,
ADD COLUMN     "qcStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "qcCompletedAt" TIMESTAMP(3),
ADD COLUMN     "qcEntryDate" TIMESTAMP(3),
ADD COLUMN     "qcStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "qc_logs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "user" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "qc_logs" ADD CONSTRAINT "qc_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_logs" ADD CONSTRAINT "qc_logs_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "production_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
