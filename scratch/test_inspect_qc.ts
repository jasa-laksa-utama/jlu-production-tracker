import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  try {
    const project = await prisma.project.findFirst({
      include: {
        conveyorUnits: {
          include: {
            structureItems: true,
            mechanicalItems: true,
          }
        }
      }
    });

    if (!project || !project.conveyorUnits || project.conveyorUnits.length === 0) {
      console.log("No unit found to test");
      return;
    }

    const unit = project.conveyorUnits[0];
    const sItem = unit.structureItems[0];
    if (!sItem) {
      console.log("No structure item found");
      return;
    }

    console.log("Testing prisma.qCItemCheckpoint.upsert for unit:", unit.name, "item:", sItem.name);
    const checkpoint = await (prisma as any).qCItemCheckpoint.upsert({
      where: {
        unitId_itemType_itemId_stage: {
          unitId: unit.id,
          itemType: "STRUCTURE",
          itemId: sItem.id,
          stage: "CUTTING",
        },
      },
      update: {
        status: "PASS",
        inspectedBy: "QC Inspector Test",
        inspectedAt: new Date(),
        notes: "Test inspection pass",
      },
      create: {
        projectId: project.id,
        unitId: unit.id,
        itemType: "STRUCTURE",
        itemId: sItem.id,
        stage: "CUTTING",
        status: "PASS",
        inspectedBy: "QC Inspector Test",
        inspectedAt: new Date(),
        notes: "Test inspection pass",
      },
    });

    console.log("QC Checkpoint upsert SUCCESS! ID:", checkpoint.id, "Status:", checkpoint.status);
  } catch (err: any) {
    console.error("QC Checkpoint Error:", err);
  }
}

main();
