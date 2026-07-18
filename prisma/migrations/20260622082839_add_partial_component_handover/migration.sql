-- AlterTable
ALTER TABLE "project_components" ADD COLUMN     "handoverId" UUID;

-- AddForeignKey
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "project_handovers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
