const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  await client.query(`
    ALTER TABLE "goods_release_memos" 
    ADD COLUMN IF NOT EXISTS "warehouseStatus" TEXT DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS "warehouseIssuedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "warehouseIssuedAt" TIMESTAMP(3);
  `);

  console.log("Successfully added warehouseStatus, warehouseIssuedBy, warehouseIssuedAt columns!");
  await client.end();
}

run().catch(err => {
  console.error("Error adding columns:", err);
  process.exit(1);
});
