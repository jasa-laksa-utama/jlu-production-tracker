/*
  Warnings:

  - You are about to drop the column `packingListUrl` on the `shipment_packages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "packingListUrl" TEXT;

-- AlterTable
ALTER TABLE "shipment_packages" DROP COLUMN "packingListUrl";
