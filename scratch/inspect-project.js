require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      productionStages: {
        include: {
          subSteps: true,
        },
      },
      history: {
        orderBy: { entryDate: 'asc' }
      }
    },
  });

  for (const p of projects) {
    console.log(`\nProject: ${p.projectName} (${p.projectNumber})`);
    console.log(`  Current Division: ${p.currentDivision}`);
    console.log(`  Current Status: ${p.currentStatus}`);
    console.log(`  Global Status: ${p.status}`);
    console.log(`  prodStatus: ${p.prodStatus} (Completed At: ${p.prodCompletedAt ? p.prodCompletedAt.toISOString() : 'NULL'})`);
    console.log(`  qcStatus: ${p.qcStatus} (Entry Date: ${p.qcEntryDate ? p.qcEntryDate.toISOString() : 'NULL'}, Completed At: ${p.qcCompletedAt ? p.qcCompletedAt.toISOString() : 'NULL'})`);
    console.log(`  logStatus: ${p.logStatus} (Entry Date: ${p.logEntryDate ? p.logEntryDate.toISOString() : 'NULL'}, Completed At: ${p.logCompletedAt ? p.logCompletedAt.toISOString() : 'NULL'})`);
    
    console.log("  History:");
    for (const h of p.history) {
      console.log(`    - Division: ${h.division} | Status: ${h.status} | Entry: ${h.entryDate.toISOString()} | Exit: ${h.exitDate ? h.exitDate.toISOString() : 'ACTIVE'}`);
    }

    for (const stage of p.productionStages) {
      const allChecked = stage.subSteps.every(s => s.checked);
      console.log(`    Stage: ${stage.name} | Status: ${stage.status} | Progress: ${stage.progress}% | QC: ${stage.qcStatus} | All Checked: ${allChecked}`);
      for (const sub of stage.subSteps) {
        console.log(`      SubStep: ${sub.name} | Checked: ${sub.checked} | QC: ${sub.qcStatus}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
