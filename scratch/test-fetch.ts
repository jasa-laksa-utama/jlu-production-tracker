import prisma from "../src/lib/prisma";

async function testFetch() {
  try {
    const AND: any[] = [{ status: { notIn: ["CANCELLED", "DELETED"] } }];
    const where = { AND };

    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        skip: 0,
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
                },
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
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.count({ where }),
    ]);

    console.log("Success! Total projects found:", totalCount);
    console.log("Projects length:", projects.length);
  } catch (err: any) {
    console.error("Fetch Error:", err);
  }
}

testFetch().catch(console.error).finally(() => prisma.$disconnect());
