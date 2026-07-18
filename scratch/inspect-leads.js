require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const totalLeads = await prisma.lead.count();
  const leads = await prisma.lead.findMany();
  console.log(`Total Leads: ${totalLeads}`);
  for (const l of leads) {
    console.log(`- Lead: ${l.projectName} | Status: ${l.status}`);
  }
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
