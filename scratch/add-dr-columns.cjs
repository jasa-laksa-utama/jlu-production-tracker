const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("Adding DR columns to qc_revisions table...");

  await client.query(`
    ALTER TABLE qc_revisions
    ADD COLUMN IF NOT EXISTS "drNumber" TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS "drawingRef" TEXT,
    ADD COLUMN IF NOT EXISTS "fieldCondition" TEXT,
    ADD COLUMN IF NOT EXISTS "requestedChange" TEXT,
    ADD COLUMN IF NOT EXISTS "revisedDocUrl" TEXT;
  `);

  console.log("Successfully added DR columns to qc_revisions table!");
  await client.end();
}

run().catch(err => {
  console.error("Error adding DR columns:", err);
  process.exit(1);
});
