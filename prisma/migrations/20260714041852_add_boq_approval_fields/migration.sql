-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "boqApprovedByPm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "boqApprovedByPmAt" TIMESTAMP(3),
ADD COLUMN     "boqApprovedByPpic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "boqApprovedByPpicAt" TIMESTAMP(3),
ADD COLUMN     "boqMakerName" TEXT,
ADD COLUMN     "boqRejectedAt" TIMESTAMP(3),
ADD COLUMN     "boqRejectedReason" TEXT,
ADD COLUMN     "boqStatus" TEXT NOT NULL DEFAULT 'DRAFT';
