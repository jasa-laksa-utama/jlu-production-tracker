require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Repairing QC status for projects...");

  const projects = await prisma.project.findMany({
    include: {
      productionStages: true,
    },
  });

  for (const p of projects) {
    const allStages = p.productionStages;
    if (allStages.length === 0) continue;

    const allApproved = allStages.every((s) => s.qcStatus === "APPROVED");
    const anyRejected = allStages.some((s) => s.qcStatus === "REJECTED");

    let targetQCStatus = "PENDING";
    let qcCompletedAt = p.qcCompletedAt;

    if (allApproved) {
      targetQCStatus = "APPROVED";
      qcCompletedAt = p.qcCompletedAt || new Date();
    } else if (anyRejected) {
      targetQCStatus = "REVISION";
    } else if (allStages.some((s) => s.qcStatus === "APPROVED")) {
      targetQCStatus = "IN_PROGRESS";
    }

    if (p.qcStatus !== targetQCStatus || (allApproved && !p.qcCompletedAt)) {
      console.log(`Updating project ${p.projectName} (${p.projectNumber}):`);
      console.log(`  qcStatus: ${p.qcStatus} -> ${targetQCStatus}`);
      console.log(`  qcCompletedAt: ${p.qcCompletedAt ? p.qcCompletedAt.toISOString() : 'NULL'} -> ${qcCompletedAt ? qcCompletedAt.toISOString() : 'NULL'}`);
      
      await prisma.project.update({
        where: { id: p.id },
        data: {
          qcStatus: targetQCStatus,
          qcCompletedAt,
        },
      });
    }
  }

  console.log("Database repair complete!");
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
