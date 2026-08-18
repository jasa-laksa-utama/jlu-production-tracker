-- AlterTable
ALTER TABLE "goods_release_memos" ADD COLUMN IF NOT EXISTS "approvedByPpic" TEXT,
ADD COLUMN IF NOT EXISTS "approvedAtPpic" TIMESTAMP(3);
