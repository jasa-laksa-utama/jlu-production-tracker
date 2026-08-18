const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  await client.query(`
    INSERT INTO "roles" ("id", "name")
    VALUES (gen_random_uuid(), 'PPIC (Head)')
    ON CONFLICT ("name") DO NOTHING;
  `);
  
  console.log("Successfully ensured 'PPIC (Head)' role exists in roles table!");
  await client.end();
}

run().catch(err => {
  console.error("Error seeding PPIC (Head) role:", err);
  process.exit(1);
});
