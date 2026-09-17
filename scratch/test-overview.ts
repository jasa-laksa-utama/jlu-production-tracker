import prisma from "../src/lib/prisma";

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      status: { notIn: ["CLOSED", "COMPLETED", "CANCELLED", "DELETED"] },
    },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      masterplan: {
        include: {
          phases: {
            orderBy: { orderIndex: "asc" },
            include: {
              unitProgresses: true,
            },
          },
        },
      },
    },
  });

  for (const project of projects) {
    console.log("PROJ:", project.projectNumber, project.projectName);
    const phases = project.masterplan?.phases || [];
    console.log("  phases length:", phases.length);
    let overallProgress = 0;
    if (project.status === "CLOSED" || project.status === "COMPLETED") {
      overallProgress = 100;
    } else {
      if (phases.length > 0) {
        const totalWeight = phases.reduce(
          (sum: number, p: any) => sum + Number(p.weightPercent || 0),
          0
        );
        console.log("  totalWeight:", totalWeight);
        if (totalWeight > 0) {
          const rawProgress = phases.reduce((sum: number, p: any) => {
            const act = Number(p.actualProgress || 0);
            const w = Number(p.weightPercent || 0);
            console.log(`    phase ${p.name}: weight=${w}, actual=${act}`);
            return sum + (act * w) / 100;
          }, 0);
          console.log("  rawProgress:", rawProgress);
          overallProgress = totalWeight === 100 ? rawProgress : (rawProgress / totalWeight) * 100;
        } else {
          const sumAct = phases.reduce((sum: number, p: any) => sum + Number(p.actualProgress || 0), 0);
          overallProgress = sumAct / phases.length;
        }
      }
    }
    overallProgress = Math.min(100, Math.max(0, Math.round(overallProgress * 10) / 10));
    console.log("  overallProgress result:", overallProgress);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
