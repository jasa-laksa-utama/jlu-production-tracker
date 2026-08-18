const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

async function main() {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Testing getProjectQCCheckpoints query via Adapter PG...");

  const projects = await prisma.project.findMany({ take: 1 });
  if (projects.length === 0) {
    console.log("No projects found");
    return;
  }

  const projectId = projects[0].id;
  console.log("Project ID:", projectId);

  const units = await prisma.conveyorUnit.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    include: {
      structureItems: { orderBy: { orderIndex: "asc" } },
      mechanicalItems: { orderBy: { orderIndex: "asc" } },
      qcCheckpoints: {
        include: {
          revisions: { orderBy: { createdAt: "desc" } }
        }
      },
      qcRevisions: { orderBy: { createdAt: "desc" } }
    }
  });

  console.log("SUCCESS! Units query returned:", units.length, "units.");

  const ncrs = await prisma.qCRevision.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      unit: { select: { id: true, name: true } },
      checkpoint: true
    }
  });

  console.log("SUCCESS! NCRs query returned:", ncrs.length, "revisions.");

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Query Error:", err);
  process.exit(1);
});
