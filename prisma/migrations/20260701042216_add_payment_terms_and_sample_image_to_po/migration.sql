/*
  Warnings:

  - The primary key for the `_UserRoles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_UserRoles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "_UserRoles" DROP CONSTRAINT "_UserRoles_AB_pkey";

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "installmentTerm" TEXT,
ADD COLUMN     "paymentMethod" TEXT DEFAULT 'CASH',
ADD COLUMN     "sampleImageUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "_UserRoles_AB_unique" ON "_UserRoles"("A", "B");
