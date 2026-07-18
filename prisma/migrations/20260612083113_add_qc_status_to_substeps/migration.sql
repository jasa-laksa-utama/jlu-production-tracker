-- AlterTable
ALTER TABLE "production_sub_steps" ADD COLUMN     "qcNotes" TEXT,
ADD COLUMN     "qcStatus" TEXT NOT NULL DEFAULT 'PENDING';
