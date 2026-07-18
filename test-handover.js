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

// Mock dependencies and requireAuth to mimic standard server action context
globalThis.prismaGlobal = prisma;

async function testHandover() {
  const projectId = "cb4eb3ee-14a8-4d6c-9f82-cb7892554955";
  const newDivision = "PRODUCTION";
  const newStatus = "IN_PROGRESS";
  const notes = "PPIC: Handed over to Production";

  console.log("Starting test handover call to updateProjectDivisionStatus...");
  
  // We'll import the action dynamically or run its exact code here to trace errors
  const uBy = "System Test";
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new Error("Project not found");

  const finalStatus = newStatus;
  const divisionMap = {
    ENGINEERING: "eng",
    PPIC: "ppic",
    PURCHASING: "pur",
    PRODUCTION: "prod",
    QUALITY_CONTROL: "qc",
    LOGISTIC: "log",
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lastHistory = await tx.projectHistory.findFirst({
        where: { projectId, exitDate: null },
        orderBy: { entryDate: "desc" },
      });

      if (lastHistory) {
        if (
          lastHistory.division !== newDivision ||
          lastHistory.status !== finalStatus
        ) {
          await tx.projectHistory.update({
            where: { id: lastHistory.id },
            data: { exitDate: new Date() },
          });

          await tx.projectHistory.create({
            data: {
              projectId,
              division: newDivision,
              status: finalStatus,
              entryDate: new Date(),
              notes: notes || `Moved to ${newDivision} - ${finalStatus}`,
              updatedBy: uBy,
            },
          });
        }
      } else {
        await tx.projectHistory.create({
          data: {
            projectId,
            division: newDivision,
            status: finalStatus,
            entryDate: new Date(),
            notes: notes || "Manual history initialization",
            updatedBy: uBy,
          },
        });
      }

      const updateData = {
        status: finalStatus,
        currentDivision: newDivision,
        currentStatus: finalStatus,
      };

      const goingToEngineering = newDivision === "ENGINEERING";
      const comingFromOther = project.currentDivision !== newDivision;

      if (comingFromOther) {
        const oldPrefix = divisionMap[project.currentDivision];
        if (oldPrefix) {
          updateData[`${oldPrefix}Status`] = finalStatus;
          updateData[`${oldPrefix}CompletedAt`] = new Date();
        }
      }

      const isInternalUpdate = project.currentDivision === newDivision;

      if (!goingToEngineering || isInternalUpdate) {
        const prefix = divisionMap[newDivision];
        if (prefix) {
          updateData[`${prefix}Status`] = finalStatus;

          if (
            project[`${prefix}Status`] === "PENDING" &&
            finalStatus !== "PENDING"
          ) {
            updateData[`${prefix}EntryDate`] = new Date();
          }

          if (
            finalStatus === "DONE" ||
            finalStatus === "APPROVED" ||
            finalStatus === "APPROVED_BY_CUSTOMER" ||
            finalStatus === "APPROVED_BY_PPIC" ||
            finalStatus.startsWith("APPROVED")
          ) {
            if (finalStatus !== "APPROVED_BY_CUSTOMER") {
              updateData[`${prefix}CompletedAt`] = new Date();
            }
          }
        }
      }

      console.log("Updating project with data:", updateData);

      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: updateData,
      });

      return updatedProject;
    });

    console.log("Result updated successfully:", result);
  } catch (err) {
    console.error("TRANSACTION FAILED:", err);
  }
}

testHandover()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
