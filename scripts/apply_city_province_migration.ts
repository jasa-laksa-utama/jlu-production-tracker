import prisma from "../src/lib/prisma";

async function main() {
  console.log("Adding city and province columns to customers, leads, and projects...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "city" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "province" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "city" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "province" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "city" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "province" TEXT;
  `);

  console.log("Database migration completed successfully!");
}

main()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
