/*
  Warnings:

  - You are about to alter the column `value` on the `leads` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `value` on the `projects` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `hargaSatuan` on the `purchase_order_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `subTotal` on the `purchase_order_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `totalAmount` on the `purchase_orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `paidAmount` on the `purchase_orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `discountAmount` on the `purchase_orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `ppnAmount` on the `purchase_orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `pphAmount` on the `purchase_orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `nettoAmount` on the `purchase_orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.

*/
-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "value" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "value" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "purchase_order_items" ALTER COLUMN "hargaSatuan" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "subTotal" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "purchase_orders" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "ppnAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "pphAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "nettoAmount" SET DATA TYPE DECIMAL(18,2);
