const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Altering qc_revisions table columns to allow NULL for DR records...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE qc_revisions 
        ALTER COLUMN "ncrNumber" DROP NOT NULL,
        ALTER COLUMN "ncrCategory" DROP NOT NULL,
        ALTER COLUMN "ncrDescription" DROP NOT NULL;
    `);
    console.log("Successfully altered qc_revisions columns to DROP NOT NULL!");
  } catch (err) {
    console.error("Error altering columns:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
