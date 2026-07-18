/*
  Warnings:

  - Made the column `projectId` on table `production_stages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "production_stages" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateTable
CREATE TABLE "project_handovers" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "stages" TEXT NOT NULL,
    "notes" TEXT,
    "handoverBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_handovers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_handovers" ADD CONSTRAINT "project_handovers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
