-- AlterTable
ALTER TABLE "goods_release_memos" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
