/*
  Warnings:

  - You are about to drop the column `boqNumber` on the `projects` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "projects_boqNumber_key";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "boqNumber";

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "p_np" TEXT NOT NULL DEFAULT 'JLUNP';
