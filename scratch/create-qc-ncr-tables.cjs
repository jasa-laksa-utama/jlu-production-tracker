const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("Creating qc_item_checkpoints and qc_revisions tables...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS qc_item_checkpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      "unitId" UUID NOT NULL REFERENCES conveyor_units(id) ON DELETE CASCADE,
      "itemType" TEXT NOT NULL,
      "itemId" UUID NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      "inspectedBy" TEXT,
      "inspectedAt" TIMESTAMP(3),
      notes TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT qc_item_checkpoints_unique UNIQUE ("unitId", "itemType", "itemId", stage)
    );

    CREATE TABLE IF NOT EXISTS qc_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      "unitId" UUID REFERENCES conveyor_units(id) ON DELETE SET NULL,
      "checkpointId" UUID REFERENCES qc_item_checkpoints(id) ON DELETE SET NULL,
      "revisionType" TEXT NOT NULL DEFAULT 'NCR',
      level TEXT NOT NULL DEFAULT 'ITEM',
      "ncrNumber" TEXT NOT NULL UNIQUE,
      "ncrCategory" TEXT NOT NULL,
      "ncrDescription" TEXT NOT NULL,
      "correctiveAction" TEXT,
      "resetStage" TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      "raisedBy" TEXT NOT NULL,
      "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedBy" TEXT,
      "resolvedAt" TIMESTAMP(3),
      "resolvedNotes" TEXT,
      "closedBy" TEXT,
      "closedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Successfully created qc_item_checkpoints and qc_revisions tables!");
  await client.end();
}

run().catch(err => {
  console.error("Error creating tables:", err);
  process.exit(1);
});
