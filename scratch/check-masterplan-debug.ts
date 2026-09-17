import prisma from "../src/lib/prisma";
import { getPhaseProgressAtCutoff } from "../src/lib/masterplan-cutoff-utils";

async function main() {
  const projects = await prisma.project.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      masterplan: {
        include: {
          phases: {
            include: {
              unitProgresses: true,
            },
          },
        },
      },
      conveyorUnits: {
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      },
      boqs: true,
      documents: true,
      spb: {
        include: {
          items: true,
        },
      },
    },
  });

  for (const p of projects) {
    console.log("========================================");
    console.log(`PROJECT: ${p.projectNumber} - ${p.projectName} (Status: ${p.status})`);
    if (!p.masterplan) {
      console.log("  NO MASTERPLAN FOUND!");
      continue;
    }
    console.log(`  Masterplan ID: ${p.masterplan.id}, TotalWeeks: ${p.masterplan.totalWeeks}`);
    console.log(`  Total Phases: ${p.masterplan.phases.length}`);
    let totalCutoff = 0;
    let totalDirect = 0;

    for (const phase of p.masterplan.phases) {
      const progCutoff = getPhaseProgressAtCutoff(phase, p, new Date());
      const act = Number(phase.actualProgress || 0);
      const w = Number(phase.weightPercent || 0);
      totalCutoff += (progCutoff / 100) * w;
      totalDirect += (act / 100) * w;
      console.log(`    Phase: ${phase.name} (Code: ${phase.code}) | Weight: ${w}% | actualProgress db: ${act}% | cutoffCalc: ${progCutoff}%`);
    }
    console.log(`  ==> Total Calculated via Cutoff: ${totalCutoff}%`);
    console.log(`  ==> Total Calculated via Direct actualProgress: ${totalDirect}%`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
