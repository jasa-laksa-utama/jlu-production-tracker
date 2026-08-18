-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "boqApprovedAt" TIMESTAMP(3),
ADD COLUMN     "dealAt" TIMESTAMP(3),
ADD COLUMN     "poCompletedAt" TIMESTAMP(3),
ADD COLUMN     "productionCompletedAt" TIMESTAMP(3),
ADD COLUMN     "spbCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "structure_items" ALTER COLUMN "satuan" SET DEFAULT 'set';
