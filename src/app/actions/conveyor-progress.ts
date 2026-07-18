"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { auth } from "@/auth";
import {
  calcStructureItemProgress,
  calcMechanicalItemProgress,
  calcUnitProgress,
  calcPhaseProgress,
  calcProjectTotalProgress,
} from "@/lib/progress-calculator";

/**
 * Updates a structure item's checkboxes and cascades calculations to:
 * 1. The ConveyorUnit's actual progress.
 * 2. The Fabrication Phase's actual progress.
 * 3. The Project's overall actual progress.
 * 4. The current week's S-curve actual progress.
 */
export async function updateStructureItemChecklist(
  itemId: string,
  checkboxes: {
    cuttingDone?: boolean;
    settingDone?: boolean;
    weldingDone?: boolean;
    finishingDone?: boolean;
    paintingDone?: boolean;
    packagingDone?: boolean;
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get and update structure item
      const item = await tx.structureItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Item not found");

      const mergedItem = { ...item, ...checkboxes };
      const newProgress = calcStructureItemProgress(mergedItem);

      await tx.structureItem.update({
        where: { id: itemId },
        data: {
          ...checkboxes,
          progressPercent: newProgress,
        },
      });

      // 2. Recalculate unit progress
      const unit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Conveyor unit not found");

      // Update in-memory structure item's progress for calculation
      const updatedStructureItems = unit.structureItems.map((si) =>
        si.id === itemId ? { ...si, progressPercent: newProgress } : si
      );

      const newUnitProgress = calcUnitProgress(
        updatedStructureItems,
        unit.mechanicalItems,
        unit.unitType
      );

      // 3. Find the Fabrication phase in this project's masterplan
      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });
      if (!masterplan) throw new Error("Masterplan not found for this project");

      const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
      if (!fabPhase) throw new Error("Fabrication phase not found in masterplan");

      // Update UnitProgress for this unit and phase
      await tx.unitProgress.update({
        where: {
          phaseId_unitId: {
            phaseId: fabPhase.id,
            unitId: unit.id,
          },
        },
        data: {
          actualPercent: newUnitProgress,
        },
      });

      // 4. Recalculate phase progress
      const allUnitProgresses = await tx.unitProgress.findMany({
        where: { phaseId: fabPhase.id },
      });

      // Update current unit's actual percent in the list
      const updatedUnitProgresses = allUnitProgresses.map((up) =>
        up.unitId === unit.id ? { ...up, actualPercent: newUnitProgress } : up
      );

      const newPhaseProgress = calcPhaseProgress(updatedUnitProgresses);

      await tx.masterplanPhase.update({
        where: { id: fabPhase.id },
        data: {
          actualProgress: newPhaseProgress,
          status: newPhaseProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
        },
      });

      // 5. Update overall project progress
      // Fetch all phases with updated progress
      const allPhases = await tx.masterplanPhase.findMany({
        where: { masterplanId: masterplan.id },
      });
      const updatedPhases = allPhases.map((p) =>
        p.id === fabPhase.id ? { ...p, actualProgress: newPhaseProgress } : p
      );

      const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

      // 6. Update S-Curve weekly progress for the current date
      const currentDate = new Date();
      const currentWeekPlan = await tx.weeklyPlan.findFirst({
        where: {
          masterplanId: masterplan.id,
          weekStartDate: { lte: currentDate },
          weekEndDate: { gte: currentDate },
        },
      });

      // Update current week's cumulative actual progress
      if (currentWeekPlan) {
        await tx.weeklyPlan.update({
          where: { id: currentWeekPlan.id },
          data: {
            actualCumulativePercent: projectTotalProgress,
            variance: projectTotalProgress - Number(currentWeekPlan.planCumulativePercent),
          },
        });
      }

      // Record logs
      await tx.productionLog.create({
        data: {
          projectId: unit.projectId,
          message: `Update progress item Structure "${item.name}" di "${unit.name}" menjadi ${newProgress.toFixed(1)}%. Progress Unit: ${newUnitProgress.toFixed(1)}%`,
          user: userBy,
        },
      });

      return {
        unitProgress: newUnitProgress,
        phaseProgress: newPhaseProgress,
        projectProgress: projectTotalProgress,
      };
    });

    revalidatePath(`/trackers/production`);
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error updating structure item progress:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates a mechanical item's checkboxes and cascades calculations.
 */
export async function updateMechanicalItemChecklist(
  itemId: string,
  checkboxes: {
    procurementDone?: boolean;
    poDone?: boolean;
    fabricationDone?: boolean;
    packagingDone?: boolean;
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get and update item
      const item = await tx.mechanicalItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Item not found");

      const mergedItem = { ...item, ...checkboxes };
      const newProgress = calcMechanicalItemProgress(mergedItem);

      await tx.mechanicalItem.update({
        where: { id: itemId },
        data: {
          ...checkboxes,
          progressPercent: newProgress,
        },
      });

      // 2. Recalculate unit progress
      const unit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Conveyor unit not found");

      const updatedMechanicalItems = unit.mechanicalItems.map((mi) =>
        mi.id === itemId ? { ...mi, progressPercent: newProgress } : mi
      );

      const newUnitProgress = calcUnitProgress(
        unit.structureItems,
        updatedMechanicalItems,
        unit.unitType
      );

      // 3. Find Fabrication phase in masterplan
      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });
      if (!masterplan) throw new Error("Masterplan not found for this project");

      const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
      if (!fabPhase) throw new Error("Fabrication phase not found in masterplan");

      // Update UnitProgress mapping
      await tx.unitProgress.update({
        where: {
          phaseId_unitId: {
            phaseId: fabPhase.id,
            unitId: unit.id,
          },
        },
        data: {
          actualPercent: newUnitProgress,
        },
      });

      // 4. Recalculate phase progress
      const allUnitProgresses = await tx.unitProgress.findMany({
        where: { phaseId: fabPhase.id },
      });

      const updatedUnitProgresses = allUnitProgresses.map((up) =>
        up.unitId === unit.id ? { ...up, actualPercent: newUnitProgress } : up
      );

      const newPhaseProgress = calcPhaseProgress(updatedUnitProgresses);

      await tx.masterplanPhase.update({
        where: { id: fabPhase.id },
        data: {
          actualProgress: newPhaseProgress,
          status: newPhaseProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
        },
      });

      // 5. Update overall project progress
      const allPhases = await tx.masterplanPhase.findMany({
        where: { masterplanId: masterplan.id },
      });
      const updatedPhases = allPhases.map((p) =>
        p.id === fabPhase.id ? { ...p, actualProgress: newPhaseProgress } : p
      );

      const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

      // 6. Update S-Curve weekly progress for the current date
      const currentDate = new Date();
      const currentWeekPlan = await tx.weeklyPlan.findFirst({
        where: {
          masterplanId: masterplan.id,
          weekStartDate: { lte: currentDate },
          weekEndDate: { gte: currentDate },
        },
      });

      if (currentWeekPlan) {
        await tx.weeklyPlan.update({
          where: { id: currentWeekPlan.id },
          data: {
            actualCumulativePercent: projectTotalProgress,
            variance: projectTotalProgress - Number(currentWeekPlan.planCumulativePercent),
          },
        });
      }

      // Record logs
      await tx.productionLog.create({
        data: {
          projectId: unit.projectId,
          message: `Update progress item Mechanical "${item.name}" di "${unit.name}" menjadi ${newProgress.toFixed(1)}%. Progress Unit: ${newUnitProgress.toFixed(1)}%`,
          user: userBy,
        },
      });

      return {
        unitProgress: newUnitProgress,
        phaseProgress: newPhaseProgress,
        projectProgress: projectTotalProgress,
      };
    });

    revalidatePath(`/trackers/production`);
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error updating mechanical item progress:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates progress for standard phases with dynamic sub-steps (e.g. Shipment, Erection, Commissioning).
 */
export async function togglePhaseSubStep(subStepId: string, checked: boolean) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get and update sub step
      const step = await tx.phaseSubStep.findUnique({
        where: { id: subStepId },
        include: { phase: true },
      });
      if (!step) throw new Error("Sub step not found");

      await tx.phaseSubStep.update({
        where: { id: subStepId },
        data: {
          checked,
          checkedAt: checked ? new Date() : null,
          checkedBy: checked ? userBy : null,
        },
      });

      // 2. Recalculate parent phase progress based on sub step weightPercent
      const siblings = await tx.phaseSubStep.findMany({
        where: { phaseId: step.phaseId },
      });

      const updatedSiblings = siblings.map((s) =>
        s.id === subStepId ? { ...s, checked } : s
      );

      const totalActualProgress = updatedSiblings.reduce(
        (sum, s) => sum + (s.checked ? Number(s.weightPercent) : 0),
        0
      );

      await tx.masterplanPhase.update({
        where: { id: step.phaseId },
        data: {
          actualProgress: totalActualProgress,
          status: totalActualProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
        },
      });

      // 3. Update overall project progress
      const masterplanId = step.phase.masterplanId;
      const allPhases = await tx.masterplanPhase.findMany({
        where: { masterplanId },
      });
      const updatedPhases = allPhases.map((p) =>
        p.id === step.phaseId ? { ...p, actualProgress: totalActualProgress } : p
      );

      const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

      // 4. Update Weekly plan actuals
      const currentDate = new Date();
      const currentWeekPlan = await tx.weeklyPlan.findFirst({
        where: {
          masterplanId,
          weekStartDate: { lte: currentDate },
          weekEndDate: { gte: currentDate },
        },
      });

      if (currentWeekPlan) {
        await tx.weeklyPlan.update({
          where: { id: currentWeekPlan.id },
          data: {
            actualCumulativePercent: projectTotalProgress,
            variance: projectTotalProgress - Number(currentWeekPlan.planCumulativePercent),
          },
        });
      }

      return {
        phaseProgress: totalActualProgress,
        projectProgress: projectTotalProgress,
      };
    });

    revalidatePath(`/trackers/production`);
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error toggling phase sub step:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Dynamically adds a new ConveyorUnit (with Structure and/or Mechanical checklists)
 * to an already initialized project Masterplan.
 */
export async function addConveyorUnitAfter(
  projectId: string,
  input: {
    name: string;
    unitType: "STRUCTURE" | "MECHANICAL" | "BOTH";
    satuan: string;
    volume: number;
    structureItems?: string[];
    mechanicalItems?: string[];
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get the masterplan
      const masterplan = await tx.masterplan.findUnique({
        where: { projectId },
        include: { phases: true },
      });
      if (!masterplan) throw new Error("Masterplan belum diinisialisasi untuk proyek ini.");

      // 2. Count current units to get orderIndex
      const currentUnitsCount = await tx.conveyorUnit.count({
        where: { projectId },
      });

      // 3. Create ConveyorUnit
      const unit = await tx.conveyorUnit.create({
        data: {
          projectId,
          name: input.name.trim(),
          unitType: input.unitType,
          satuan: input.satuan.trim() || "unit",
          volume: Number(input.volume) || 1,
          orderIndex: currentUnitsCount + 1,
        },
      });

      // 4. Create Structure Items
      if (input.structureItems && input.structureItems.length > 0) {
        for (let i = 0; i < input.structureItems.length; i++) {
          const itemName = input.structureItems[i].trim();
          if (!itemName) continue;
          await tx.structureItem.create({
            data: {
              unitId: unit.id,
              name: itemName,
              orderIndex: i + 1,
            },
          });
        }
      }

      // 5. Create Mechanical Items
      if (input.mechanicalItems && input.mechanicalItems.length > 0) {
        for (let i = 0; i < input.mechanicalItems.length; i++) {
          const itemName = input.mechanicalItems[i].trim();
          if (!itemName) continue;
          await tx.mechanicalItem.create({
            data: {
              unitId: unit.id,
              name: itemName,
              orderIndex: i + 1,
            },
          });
        }
      }

      // 6. Connect to Fabrication phase & redistribute weights equally
      const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
      if (fabPhase) {
        await tx.unitProgress.create({
          data: {
            phaseId: fabPhase.id,
            unitId: unit.id,
            weightPercent: 0, // temporary placeholder, will update below
            actualPercent: 0,
          },
        });

        // Fetch all unit progress records for this phase to redistribute weights
        const allUps = await tx.unitProgress.findMany({
          where: { phaseId: fabPhase.id },
        });

        const equalWeight = 100 / allUps.length;

        for (const up of allUps) {
          await tx.unitProgress.update({
            where: { id: up.id },
            data: { weightPercent: equalWeight },
          });
        }
      }

      return unit;
    });

    // 7. Recalculate and re-evaluate progress
    const masterplan = await prisma.masterplan.findUnique({
      where: { projectId },
      include: { phases: true },
    });
    if (masterplan) {
      const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
      if (fabPhase) {
        // Fetch all unit progress records for this phase
        const allUnitProgresses = await prisma.unitProgress.findMany({
          where: { phaseId: fabPhase.id },
        });
        const newPhaseProgress = calcPhaseProgress(allUnitProgresses);
        
        await prisma.masterplanPhase.update({
          where: { id: fabPhase.id },
          data: {
            actualProgress: newPhaseProgress,
            status: newPhaseProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
          },
        });

        // Recalculate total project progress
        const allPhases = await prisma.masterplanPhase.findMany({
          where: { masterplanId: masterplan.id },
        });
        const projectTotalProgress = calcProjectTotalProgress(allPhases);

        // Update current week's actual progress in S-Curve
        const currentDate = new Date();
        const currentWeekPlan = await prisma.weeklyPlan.findFirst({
          where: {
            masterplanId: masterplan.id,
            weekStartDate: { lte: currentDate },
            weekEndDate: { gte: currentDate },
          },
        });
        if (currentWeekPlan) {
          await prisma.weeklyPlan.update({
            where: { id: currentWeekPlan.id },
            data: {
              actualCumulativePercent: projectTotalProgress,
              variance: projectTotalProgress - Number(currentWeekPlan.planCumulativePercent),
            },
          });
        }
      }
    }

    revalidatePath("/trackers/production");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error adding conveyor unit:", error);
    return { success: false, error: error.message || "Gagal menambah unit conveyor" };
  }
}
