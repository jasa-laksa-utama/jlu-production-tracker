-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "purchasingStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "warehouseStatus" TEXT NOT NULL DEFAULT 'PENDING';
