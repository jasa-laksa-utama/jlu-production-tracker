const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Testing ConveyorUnit include qcCheckpoints...");
  const units = await prisma.conveyorUnit.findMany({
    take: 1,
    include: {
      qcCheckpoints: true,
      qcRevisions: true,
    }
  });
  console.log("Query success! Found units:", units.length);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
