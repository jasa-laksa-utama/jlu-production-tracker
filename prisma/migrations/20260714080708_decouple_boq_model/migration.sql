/*
  Warnings:

  - You are about to drop the column `projectId` on the `boq_items` table. All the data in the column will be lost.
  - You are about to drop the column `boqApprovedByPm` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqApprovedByPmAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqApprovedByPpic` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqApprovedByPpicAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqMakerName` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqNumber` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqRejectedAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqRejectedReason` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `boqStatus` on the `projects` table. All the data in the column will be lost.
  - Added the required column `boqId` to the `boq_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "boq_items" DROP CONSTRAINT "boq_items_projectId_fkey";

-- DropIndex
DROP INDEX "boq_items_projectId_itemId_key";

-- DropIndex
DROP INDEX "projects_boqNumber_key";

-- AlterTable
ALTER TABLE "boq_items" DROP COLUMN "projectId",
ADD COLUMN     "boqId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "boqApprovedByPm",
DROP COLUMN "boqApprovedByPmAt",
DROP COLUMN "boqApprovedByPpic",
DROP COLUMN "boqApprovedByPpicAt",
DROP COLUMN "boqMakerName",
DROP COLUMN "boqNumber",
DROP COLUMN "boqRejectedAt",
DROP COLUMN "boqRejectedReason",
DROP COLUMN "boqStatus";

-- CreateTable
CREATE TABLE "boqs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqNumber" TEXT NOT NULL,
    "boqStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "boqApprovedByPpic" BOOLEAN NOT NULL DEFAULT false,
    "boqApprovedByPpicAt" TIMESTAMP(3),
    "boqApprovedByPm" BOOLEAN NOT NULL DEFAULT false,
    "boqApprovedByPmAt" TIMESTAMP(3),
    "boqMakerName" TEXT,
    "boqRejectedReason" TEXT,
    "boqRejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boqs_boqNumber_key" ON "boqs"("boqNumber");

-- AddForeignKey
ALTER TABLE "boqs" ADD CONSTRAINT "boqs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "boqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
