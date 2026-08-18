-- AlterTable
ALTER TABLE "items" ADD COLUMN "model" TEXT;

-- CreateTable
CREATE TABLE "item_usage_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_usage_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_usage_types_name_key" ON "item_usage_types"("name");

-- Seed Default Usage Types
INSERT INTO "item_usage_types" ("id", "name", "code", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'CONSUMABLE', 'CONSUMABLE', NOW(), NOW()),
  (gen_random_uuid(), 'TOOL / ASET', 'TOOL', NOW(), NOW()),
  (gen_random_uuid(), 'SPAREPART', 'SPAREPART', NOW(), NOW()),
  (gen_random_uuid(), 'CHEMICAL', 'CHEMICAL', NOW(), NOW()),
  (gen_random_uuid(), 'MATERIAL UTAMA', 'MATERIAL', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
