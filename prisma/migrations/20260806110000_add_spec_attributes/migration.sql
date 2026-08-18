-- CreateTable
CREATE TABLE "spec_attributes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spec_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spec_attributes_name_key" ON "spec_attributes"("name");

-- Insert Default Master Spec Parameters
INSERT INTO "spec_attributes" ("id", "name", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'Panjang', NOW(), NOW()),
  (gen_random_uuid(), 'Lebar', NOW(), NOW()),
  (gen_random_uuid(), 'Tinggi', NOW(), NOW()),
  (gen_random_uuid(), 'Tebal', NOW(), NOW()),
  (gen_random_uuid(), 'Ukuran', NOW(), NOW()),
  (gen_random_uuid(), 'Diameter', NOW(), NOW()),
  (gen_random_uuid(), 'Power', NOW(), NOW()),
  (gen_random_uuid(), 'Voltage', NOW(), NOW()),
  (gen_random_uuid(), 'Ampere', NOW(), NOW()),
  (gen_random_uuid(), 'RPM', NOW(), NOW()),
  (gen_random_uuid(), 'Pressure', NOW(), NOW()),
  (gen_random_uuid(), 'Capacity', NOW(), NOW()),
  (gen_random_uuid(), 'Weight', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
