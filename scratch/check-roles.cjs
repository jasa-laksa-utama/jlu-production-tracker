const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`SELECT * FROM "roles"`);
  console.log("Existing Roles in DB:", res.rows);
  await client.end();
}

run().catch(err => {
  console.error("Error fetching roles:", err);
  process.exit(1);
});
