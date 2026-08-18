const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to DB");
  
  await client.query(`
    ALTER TABLE "goods_return_records" 
    ADD COLUMN IF NOT EXISTS "warehouseStatus" TEXT NOT NULL DEFAULT 'PENDING_ACC',
    ADD COLUMN IF NOT EXISTS "warehouseApprovedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "warehouseApprovedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "warehouseNotes" TEXT;
  `);
  
  console.log("Successfully added warehouse columns to goods_return_records table!");
  await client.end();
}

run().catch(err => {
  console.error("Error altering table:", err);
  process.exit(1);
});
