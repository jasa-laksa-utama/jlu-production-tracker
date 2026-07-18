require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database cleanup and sync...");

  // 1. Find the legacy project
  const project = await prisma.project.findFirst({
    where: { projectNumber: "PROJECT-06-2026-001" },
    include: {
      productionStages: true,
    },
  });

  // 2. Synchronize status with currentStatus for all projects
  console.log("Synchronizing global status with currentStatus for all projects...");
  const allProjects = await prisma.project.findMany();
  for (const p of allProjects) {
    if (p.currentStatus && p.status !== p.currentStatus) {
      console.log(`Updating project ${p.projectName} status: ${p.status} -> ${p.currentStatus}`);
      await prisma.project.update({
        where: { id: p.id },
        data: {
          status: p.currentStatus,
        },
      });
    }
  }

  // 3. Recalculate prodStatus and trigger auto-transition if needed for PROJECT-06-2026-001
  if (project) {
    console.log("Recalculating production status for PROJECT-06-2026-001...");
    // Run the same transaction logic as syncProjectProdStatus
    await prisma.$transaction(async (tx) => {
      const allStages = await tx.productionStage.findMany({
        where: {
          projectId: project.id,
        },
      });

      console.log(`Found ${allStages.length} remaining stages.`);
      const allDone = allStages.every((s) => s.status === "DONE" || s.progress === 100);
      const targetProdStatus = allDone ? "DONE" : "IN_PROGRESS";
      console.log(`allDone: ${allDone}, targetProdStatus: ${targetProdStatus}`);

      const currentProj = await tx.project.findUnique({
        where: { id: project.id },
      });

      if (currentProj) {
        const updateData = {
          prodStatus: targetProdStatus,
        };

        if (allDone && currentProj.currentDivision === "PRODUCTION") {
          updateData.currentDivision = "QUALITY_CONTROL";
          updateData.currentStatus = "IN_PROGRESS";
          updateData.status = "IN_PROGRESS";

          // Close last history entry and open one for Quality Control
          const lastHistory = await tx.projectHistory.findFirst({
            where: { projectId: project.id, exitDate: null },
            orderBy: { entryDate: "desc" },
          });

          if (lastHistory) {
            await tx.projectHistory.update({
              where: { id: lastHistory.id },
              data: { exitDate: new Date() },
            });
          }

          await tx.projectHistory.create({
            data: {
              projectId: project.id,
              division: "QUALITY_CONTROL",
              status: "IN_PROGRESS",
              entryDate: new Date(),
              notes: "Semua tahapan produksi telah selesai (100% DONE). Otomatis dialihkan ke Quality Control.",
              updatedBy: "System",
            },
          });
        }

        await tx.project.update({
          where: { id: project.id },
          data: updateData,
        });

        console.log("Project updated successfully!");
      }
    });
  }

  // 4. Update missing completed dates and logistics fields for the completed project
  if (project) {
    const updateDates = {};
    if (!project.prodCompletedAt && project.prodStatus === "DONE") {
      updateDates.prodCompletedAt = new Date("2026-06-15T02:11:37Z");
    }
    if (!project.qcEntryDate && project.qcStatus === "APPROVED") {
      updateDates.qcEntryDate = new Date("2026-06-15T02:12:00Z");
    }
    // Update logistics fields for PROJECT-06-2026-001
    updateDates.logStatus = "READY";
    updateDates.logEntryDate = new Date("2026-06-15T04:31:44Z");

    await prisma.project.update({
      where: { id: project.id },
      data: updateDates,
    });
    console.log("Updated project completed dates and logistics fields for PROJECT-06-2026-001 successfully!");
  }

  console.log("Cleanup and sync completed successfully!");
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
