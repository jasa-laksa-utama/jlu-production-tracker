import prisma from "../src/lib/prisma";

async function main() {
  console.log("Checking and adding itemId and itemCode columns to office_boq_items...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "office_boq_items" 
    ADD COLUMN IF NOT EXISTS "itemId" UUID REFERENCES "items"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "itemCode" TEXT;
  `);

  console.log("Migration completed successfully for office_boq_items!");
}

main()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
