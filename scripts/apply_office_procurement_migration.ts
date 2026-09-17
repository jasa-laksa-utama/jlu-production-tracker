import "dotenv/config";
import prisma from "@/lib/prisma";

async function main() {
  console.log("Applying Office Procurement migration...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "office_boqs" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "boqNumber" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "department" TEXT NOT NULL DEFAULT 'GENERAL',
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "makerName" TEXT,
      "notes" TEXT,
      "totalEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "office_boqs_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "office_boqs_boqNumber_key" ON "office_boqs"("boqNumber");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "office_boq_items" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "officeBoqId" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT DEFAULT 'ATK',
      "qty" DOUBLE PRECISION NOT NULL,
      "unit" TEXT NOT NULL DEFAULT 'pcs',
      "estimatedPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
      "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "office_boq_items_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "office_boq_items_officeBoqId_fkey" FOREIGN KEY ("officeBoqId") REFERENCES "office_boqs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "office_spb" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "spbNumber" TEXT NOT NULL,
      "officeBoqId" UUID,
      "purpose" TEXT NOT NULL,
      "department" TEXT NOT NULL DEFAULT 'GENERAL',
      "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "requiredDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      "makerName" TEXT,
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMP(3),
      "rejectedReason" TEXT,
      "rejectedAt" TIMESTAMP(3),
      "totalEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "office_spb_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "office_spb_officeBoqId_fkey" FOREIGN KEY ("officeBoqId") REFERENCES "office_boqs"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "office_spb_spbNumber_key" ON "office_spb"("spbNumber");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "office_spb_items" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "officeSpbId" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "spec" TEXT,
      "category" TEXT DEFAULT 'ATK',
      "qty" DOUBLE PRECISION NOT NULL,
      "unit" TEXT NOT NULL DEFAULT 'pcs',
      "estimatedPrice" DECIMAL(18,2) DEFAULT 0,
      "subtotal" DECIMAL(18,2) DEFAULT 0,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "office_spb_items_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "office_spb_items_officeSpbId_fkey" FOREIGN KEY ("officeSpbId") REFERENCES "office_spb"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  console.log("Office Procurement migration executed successfully!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
