-- AlterTable
ALTER TABLE "projects" ADD COLUMN "boqNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_boqNumber_key" ON "projects"("boqNumber");
