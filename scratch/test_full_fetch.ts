import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  try {
    const where = {
      status: { notIn: ["CANCELLED", "DELETED"] },
    };

    console.log("Querying prisma.project.findMany with full relations...");
    const projects = await prisma.project.findMany({
      where,
      take: 10,
      include: {
        customer: true,
        history: {
          orderBy: { entryDate: "desc" },
        },
        documents: true,
        lead: {
          include: {
            documents: true,
          },
        },
        spb: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            items: {
              include: {
                material: true,
              },
            },
          },
        },
        spj: {
          include: {
            items: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        productionSetup: true,
        masterplan: {
          include: {
            phases: {
              orderBy: { orderIndex: "asc" },
              include: {
                subProgresses: { orderBy: { createdAt: "asc" } },
                unitProgresses: true,
                weeklyProgresses: { orderBy: { weekNumber: "asc" } },
                weeklyTargets: { orderBy: { weekNumber: "asc" } },
              } as any,
            },
            weeklyPlans: { orderBy: { weekNumber: "asc" } },
            divisionLeaders: true,
          },
        },
        conveyorUnits: {
          orderBy: { orderIndex: "asc" },
          include: {
            structureItems: { orderBy: { orderIndex: "asc" } },
            mechanicalItems: { orderBy: { orderIndex: "asc" } },
            progresses: true,
            qcCheckpoints: {
              include: {
                revisions: {
                  orderBy: { createdAt: "desc" },
                },
              },
            },
            qcRevisions: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
        components: {
          include: {
            stages: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        qcRevisions: {
          orderBy: { createdAt: "desc" },
        },
        productionStages: {
          include: {
            subSteps: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        productionLogs: {
          orderBy: {
            createdAt: "desc",
          },
        },
        qcLogs: {
          include: {
            stage: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        goodsReleaseMemos: {
          include: {
            items: true,
            returns: {
              include: {
                items: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        handovers: true,
        boqs: {
          include: {
            boqItems: {
              include: {
                item: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            spb: true,
          },
        },
      } as any,
      orderBy: { createdAt: "desc" },
    });

    console.log("Query completed successfully!");
    console.log("Total projects fetched:", projects.length);

    // Test serialization logic from getProjects
    const serializedProjects = projects.map((project: any) => {
      const allDocs = [
        ...((project.documents as any[]) || []),
        ...((project.lead as any)?.documents || []),
      ];

      const filteredDocs = allDocs.filter(
        (doc: any) => doc.category !== "PO" && doc.category !== "OFFERING",
      );

      const allDocIds = new Set(filteredDocs.map((d: any) => d.id));
      const hasRevisedDocs = filteredDocs.some((doc: any) => doc.version > 1);

      const approvedSpbCount = (project.spb || []).filter((s: any) => {
        if (!s.items || s.items.length === 0) return false;
        return s.items.every((it: any) => 
          it.status === "FULFILLED" || it.status === "RECEIVED"
        );
      }).length;

      return {
        ...project,
        value: project.value ? project.value.toString() : null,
        lead: project.lead
          ? {
              ...project.lead,
              value: (project.lead as any).value
                ? (project.lead as any).value.toString()
                : null,
            }
          : null,
        documentCount: allDocIds.size,
        hasRevisedDocs,
        spbCount: project._count?.spb || 0,
        approvedSpbCount,
      };
    });

    console.log("Serialization successful! First project:", serializedProjects[0]?.projectName);
    console.log("Masterplan phases in first project:", serializedProjects[0]?.masterplan?.phases?.length);
  } catch (err: any) {
    console.error("FATAL ERROR IN FETCH/SERIALIZATION:", err);
  }
}

main();
