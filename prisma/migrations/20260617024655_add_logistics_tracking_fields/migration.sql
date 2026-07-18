-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "logCompletedAt" TIMESTAMP(3),
ADD COLUMN     "logEntryDate" TIMESTAMP(3),
ADD COLUMN     "logStatus" TEXT NOT NULL DEFAULT 'PENDING';
