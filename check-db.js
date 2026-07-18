const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

// Read .env file to get DATABASE_URL
const envPath = path.join(__dirname, ".env");
let connectionString = "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/^DATABASE_URL\s*=\s*["']?(.*?)["']?$/m);
  if (match) {
    connectionString = match[1];
  }
}

if (!connectionString) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      projectNumber: true,
      projectName: true,
      status: true,
      currentDivision: true,
      ppicStatus: true,
      engStatus: true,
    }
  });
  console.log("Projects in DB:", JSON.stringify(projects, null, 2));
}

main()
  .catch((e) => {
    console.error("Error checking projects:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
