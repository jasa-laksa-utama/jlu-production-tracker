/*
  Warnings:

  - You are about to drop the column `currentDivision` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `currentStatus` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `engCompletedAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `engEntryDate` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `engReviewedAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `logCompletedAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `logEntryDate` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `ppicCompletedAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `ppicEntryDate` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `prodCompletedAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `prodEntryDate` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `qcEntryDate` on the `projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "projects" DROP COLUMN "currentDivision",
DROP COLUMN "currentStatus",
DROP COLUMN "engCompletedAt",
DROP COLUMN "engEntryDate",
DROP COLUMN "engReviewedAt",
DROP COLUMN "logCompletedAt",
DROP COLUMN "logEntryDate",
DROP COLUMN "ppicCompletedAt",
DROP COLUMN "ppicEntryDate",
DROP COLUMN "prodCompletedAt",
DROP COLUMN "prodEntryDate",
DROP COLUMN "qcEntryDate";
