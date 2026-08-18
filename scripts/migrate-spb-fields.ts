import { Client } from "pg";

async function main() {
  const connectionString =
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres.jvvzfuqhyezjakfeflgy:Jluproduction999%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

  console.log("Connecting directly to PostgreSQL DB...");
  const client = new Client({ connectionString });
  await client.connect();

  console.log("Migrating SPB table: adding deadlineDate and imageUrl columns...");

  await client.query(`
    ALTER TABLE "spb" ADD COLUMN IF NOT EXISTS "deadlineDate" TIMESTAMP(3);
  `);
  console.log("✓ deadlineDate column added or verified");

  await client.query(`
    ALTER TABLE "spb" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
  `);
  console.log("✓ imageUrl column added or verified");

  await client.end();
  console.log("Migration completed successfully.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
