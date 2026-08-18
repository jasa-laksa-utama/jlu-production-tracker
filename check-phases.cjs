const { PrismaClient } = require("./node_modules/@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const masterplans = await prisma.masterplan.findMany({
    include: {
      phases: true,
      weeklyPlans: true,
    },
  });

  console.log("=== MASTERPLANS & PHASES ===");
  for (const mp of masterplans) {
    console.log(`Masterplan ID: ${mp.id}, ProjectId: ${mp.projectId}`);
    for (const phase of mp.phases) {
      console.log(`  Phase ${phase.code} - ${phase.name}:`);
      console.log(`    weightPercent: ${phase.weightPercent}`);
      console.log(`    startWeek: ${phase.startWeek}, endWeek: ${phase.endWeek}`);
      console.log(`    weeklyTargets:`, JSON.stringify(phase.weeklyTargets));
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
