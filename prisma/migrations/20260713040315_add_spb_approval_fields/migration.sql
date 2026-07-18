-- AlterTable
ALTER TABLE "_UserRoles" ADD CONSTRAINT "_UserRoles_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserRoles_AB_unique";

-- AlterTable
ALTER TABLE "spb" ADD COLUMN     "approvedByPm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvedByPmAt" TIMESTAMP(3),
ADD COLUMN     "approvedByPpic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvedByPpicAt" TIMESTAMP(3),
ADD COLUMN     "makerName" TEXT,
ADD COLUMN     "mengetahuiName" TEXT DEFAULT 'Slamet',
ADD COLUMN     "menyetujuiName" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL';
