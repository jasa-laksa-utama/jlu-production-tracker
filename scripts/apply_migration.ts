import prisma from "@/lib/prisma";

async function main() {
  console.log("Applying sub-items and marking columns migration...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "conveyor_units" ADD COLUMN IF NOT EXISTS "bundleTag" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "conveyor_units" ADD COLUMN IF NOT EXISTS "markingCode" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "bundleTag" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "markingCode" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "structure_items" ADD COLUMN IF NOT EXISTS "markingStatus" TEXT NOT NULL DEFAULT 'UNMARKED';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "bundleTag" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "markingCode" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "mechanical_items" ADD COLUMN IF NOT EXISTS "markingStatus" TEXT NOT NULL DEFAULT 'UNMARKED';
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "structure_sub_items" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "structureItemId" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "markingCode" TEXT,
      "qty" INTEGER NOT NULL DEFAULT 1,
      "satuan" TEXT NOT NULL DEFAULT 'pcs',
      "dimension" TEXT,
      "isCompleted" BOOLEAN NOT NULL DEFAULT false,
      "completedAt" TIMESTAMP(3),
      "completedBy" TEXT,
      "notes" TEXT,
      "orderIndex" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "structure_sub_items_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "structure_sub_items_structureItemId_fkey" FOREIGN KEY ("structureItemId") REFERENCES "structure_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "mechanical_sub_items" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "mechanicalItemId" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "markingCode" TEXT,
      "qty" INTEGER NOT NULL DEFAULT 1,
      "satuan" TEXT NOT NULL DEFAULT 'pcs',
      "spec" TEXT,
      "isCompleted" BOOLEAN NOT NULL DEFAULT false,
      "completedAt" TIMESTAMP(3),
      "completedBy" TEXT,
      "notes" TEXT,
      "orderIndex" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "mechanical_sub_items_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "mechanical_sub_items_mechanicalItemId_fkey" FOREIGN KEY ("mechanicalItemId") REFERENCES "mechanical_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  console.log("Migration executed successfully!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
