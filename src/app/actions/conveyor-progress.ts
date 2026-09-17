"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";
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
  dataInput: {
    cuttingQty?: number;
    settingQty?: number;
    weldingQty?: number;
    finishingQty?: number;
    paintingQty?: number;
    packagingQty?: number;
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
      const item = await tx.structureItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Item not found");

      const itemQty = Math.max(1, item.qty || 1);

      const cuttingQty = Number(
        dataInput.cuttingQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.cuttingQty))
          : (dataInput.cuttingDone !== undefined ? (dataInput.cuttingDone ? itemQty : 0) : (item.cuttingQty ?? (item.cuttingDone ? itemQty : 0)))
      );

      const settingQty = Number(
        dataInput.settingQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.settingQty))
          : (dataInput.settingDone !== undefined ? (dataInput.settingDone ? itemQty : 0) : (item.settingQty ?? (item.settingDone ? itemQty : 0)))
      );

      const weldingQty = Number(
        dataInput.weldingQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.weldingQty))
          : (dataInput.weldingDone !== undefined ? (dataInput.weldingDone ? itemQty : 0) : (item.weldingQty ?? (item.weldingDone ? itemQty : 0)))
      );

      const finishingQty = Number(
        dataInput.finishingQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.finishingQty))
          : (dataInput.finishingDone !== undefined ? (dataInput.finishingDone ? itemQty : 0) : (item.finishingQty ?? (item.finishingDone ? itemQty : 0)))
      );

      const paintingQty = Number(
        dataInput.paintingQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.paintingQty))
          : (dataInput.paintingDone !== undefined ? (dataInput.paintingDone ? itemQty : 0) : (item.paintingQty ?? (item.paintingDone ? itemQty : 0)))
      );

      const packagingQty = Number(
        dataInput.packagingQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.packagingQty))
          : (dataInput.packagingDone !== undefined ? (dataInput.packagingDone ? itemQty : 0) : (item.packagingQty ?? (item.packagingDone ? itemQty : 0)))
      );

      const mergedItem = {
        ...item,
        cuttingQty,
        settingQty,
        weldingQty,
        finishingQty,
        paintingQty,
        packagingQty,
      };

      const newProgress = calcStructureItemProgress(mergedItem);

      await tx.structureItem.update({
        where: { id: itemId },
        data: {
          cuttingQty,
          settingQty,
          weldingQty,
          finishingQty,
          paintingQty,
          packagingQty,
          cuttingDone: cuttingQty >= itemQty,
          settingDone: settingQty >= itemQty,
          weldingDone: weldingQty >= itemQty,
          finishingDone: finishingQty >= itemQty,
          paintingDone: paintingQty >= itemQty,
          packagingDone: packagingQty >= itemQty,
          progressPercent: newProgress,
        },
      });

      const unit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Conveyor unit not found");

      const updatedStructureItems = unit.structureItems.map((si) =>
        si.id === itemId
          ? {
              ...si,
              cuttingQty,
              settingQty,
              weldingQty,
              finishingQty,
              paintingQty,
              packagingQty,
              progressPercent: newProgress,
            }
          : si
      );

      const newUnitProgress = calcUnitProgress(
        updatedStructureItems,
        unit.mechanicalItems,
        unit.unitType
      );

      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });
      if (!masterplan) throw new Error("Masterplan not found for this project");

      const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
      if (!fabPhase) throw new Error("Fabrication phase not found in masterplan");

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

      const allPhases = await tx.masterplanPhase.findMany({
        where: { masterplanId: masterplan.id },
      });
      const updatedPhases = allPhases.map((p) =>
        p.id === fabPhase.id ? { ...p, actualProgress: newPhaseProgress } : p
      );

      const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui progress komponen struktur.") };
  }
}

export async function updateStructureItemDetails(
  itemId: string,
  details: { name?: string; qty?: number; satuan?: string }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.structureItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Item not found");

      const newName = details.name !== undefined ? details.name.trim() : item.name;
      const newQty = details.qty !== undefined ? Math.max(1, details.qty) : item.qty;
      const newSatuan = details.satuan !== undefined ? details.satuan.trim() : item.satuan;

      const cuttingQty = Math.min(newQty, item.cuttingQty);
      const settingQty = Math.min(newQty, item.settingQty);
      const weldingQty = Math.min(newQty, item.weldingQty);
      const finishingQty = Math.min(newQty, item.finishingQty);
      const paintingQty = Math.min(newQty, item.paintingQty);
      const packagingQty = Math.min(newQty, item.packagingQty);

      const mergedItem = {
        ...item,
        name: newName,
        qty: newQty,
        satuan: newSatuan,
        cuttingQty,
        settingQty,
        weldingQty,
        finishingQty,
        paintingQty,
        packagingQty,
      };

      const newProgress = calcStructureItemProgress(mergedItem);

      await tx.structureItem.update({
        where: { id: itemId },
        data: {
          name: newName,
          qty: newQty,
          satuan: newSatuan,
          cuttingQty,
          settingQty,
          weldingQty,
          finishingQty,
          paintingQty,
          packagingQty,
          cuttingDone: cuttingQty >= newQty,
          settingDone: settingQty >= newQty,
          weldingDone: weldingQty >= newQty,
          finishingDone: finishingQty >= newQty,
          paintingDone: paintingQty >= newQty,
          packagingDone: packagingQty >= newQty,
          progressPercent: newProgress,
        },
      });

      const unit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Conveyor unit not found");

      const updatedStructureItems = unit.structureItems.map((si) =>
        si.id === itemId
          ? {
              ...si,
              name: newName,
              qty: newQty,
              satuan: newSatuan,
              cuttingQty,
              settingQty,
              weldingQty,
              finishingQty,
              paintingQty,
              packagingQty,
              progressPercent: newProgress,
            }
          : si
      );

      const newUnitProgress = calcUnitProgress(
        updatedStructureItems,
        unit.mechanicalItems,
        unit.unitType
      );

      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });
      if (masterplan) {
        const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
        if (fabPhase) {
          await tx.unitProgress.update({
            where: {
              phaseId_unitId: {
                phaseId: fabPhase.id,
                unitId: unit.id,
              },
            },
            data: { actualPercent: newUnitProgress },
          });

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

          const allPhases = await tx.masterplanPhase.findMany({
            where: { masterplanId: masterplan.id },
          });
          const updatedPhases = allPhases.map((p) =>
            p.id === fabPhase.id ? { ...p, actualProgress: newPhaseProgress } : p
          );

          const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

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
        }
      }

      await tx.productionLog.create({
        data: {
          projectId: unit.projectId,
          message: `Edit rincian komponen struktur "${newName}" (Qty: ${newQty} ${newSatuan}) pada "${unit.name}".`,
          user: userBy,
        },
      });

      return unit;
    });

    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error updating structure item details:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui detail komponen struktur.") };
  }
}

export async function updateMechanicalItemChecklist(
  itemId: string,
  dataInput: {
    procurementQty?: number;
    poQty?: number;
    fabricationQty?: number;
    packagingQty?: number;
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
      const item = await tx.mechanicalItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Item not found");

      const itemQty = Math.max(1, item.qty || 1);

      const procurementQty = Number(
        dataInput.procurementQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.procurementQty))
          : (dataInput.procurementDone !== undefined ? (dataInput.procurementDone ? itemQty : 0) : (item.procurementQty ?? (item.procurementDone ? itemQty : 0)))
      );

      const poQty = Number(
        dataInput.poQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.poQty))
          : (dataInput.poDone !== undefined ? (dataInput.poDone ? itemQty : 0) : (item.poQty ?? (item.poDone ? itemQty : 0)))
      );

      const fabricationQty = Number(
        dataInput.fabricationQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.fabricationQty))
          : (dataInput.fabricationDone !== undefined ? (dataInput.fabricationDone ? itemQty : 0) : (item.fabricationQty ?? (item.fabricationDone ? itemQty : 0)))
      );

      const packagingQty = Number(
        dataInput.packagingQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.packagingQty))
          : (dataInput.packagingDone !== undefined ? (dataInput.packagingDone ? itemQty : 0) : (item.packagingQty ?? (item.packagingDone ? itemQty : 0)))
      );

      const mergedItem = {
        ...item,
        procurementQty,
        poQty,
        fabricationQty,
        packagingQty,
      };

      const newProgress = calcMechanicalItemProgress(mergedItem);

      await tx.mechanicalItem.update({
        where: { id: itemId },
        data: {
          procurementQty,
          poQty,
          fabricationQty,
          packagingQty,
          procurementDone: procurementQty >= itemQty,
          poDone: poQty >= itemQty,
          fabricationDone: fabricationQty >= itemQty,
          packagingDone: packagingQty >= itemQty,
          progressPercent: newProgress,
        },
      });

      const unit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Conveyor unit not found");

      const updatedMechanicalItems = unit.mechanicalItems.map((mi) =>
        mi.id === itemId
          ? {
              ...mi,
              procurementQty,
              poQty,
              fabricationQty,
              packagingQty,
              progressPercent: newProgress,
            }
          : mi
      );

      const newUnitProgress = calcUnitProgress(
        unit.structureItems,
        updatedMechanicalItems,
        unit.unitType
      );

      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });
      if (!masterplan) throw new Error("Masterplan not found for this project");

      const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
      if (!fabPhase) throw new Error("Fabrication phase not found in masterplan");

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

      const allPhases = await tx.masterplanPhase.findMany({
        where: { masterplanId: masterplan.id },
      });
      const updatedPhases = allPhases.map((p) =>
        p.id === fabPhase.id ? { ...p, actualProgress: newPhaseProgress } : p
      );

      const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui progress komponen mekanikal.") };
  }
}

export async function updateMechanicalItemDetails(
  itemId: string,
  details: { name?: string; qty?: number; satuan?: string }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.mechanicalItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Item not found");

      const newName = details.name !== undefined ? details.name.trim() : item.name;
      const newQty = details.qty !== undefined ? Math.max(1, details.qty) : item.qty;
      const newSatuan = details.satuan !== undefined ? details.satuan.trim() : item.satuan;

      const procurementQty = Math.min(newQty, item.procurementQty);
      const poQty = Math.min(newQty, item.poQty);
      const fabricationQty = Math.min(newQty, item.fabricationQty);
      const packagingQty = Math.min(newQty, item.packagingQty);

      const mergedItem = {
        ...item,
        name: newName,
        qty: newQty,
        satuan: newSatuan,
        procurementQty,
        poQty,
        fabricationQty,
        packagingQty,
      };

      const newProgress = calcMechanicalItemProgress(mergedItem);

      await tx.mechanicalItem.update({
        where: { id: itemId },
        data: {
          name: newName,
          qty: newQty,
          satuan: newSatuan,
          procurementQty,
          poQty,
          fabricationQty,
          packagingQty,
          procurementDone: procurementQty >= newQty,
          poDone: poQty >= newQty,
          fabricationDone: fabricationQty >= newQty,
          packagingDone: packagingQty >= newQty,
          progressPercent: newProgress,
        },
      });

      const unit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Conveyor unit not found");

      const updatedMechanicalItems = unit.mechanicalItems.map((mi) =>
        mi.id === itemId
          ? {
              ...mi,
              name: newName,
              qty: newQty,
              satuan: newSatuan,
              procurementQty,
              poQty,
              fabricationQty,
              packagingQty,
              progressPercent: newProgress,
            }
          : mi
      );

      const newUnitProgress = calcUnitProgress(
        unit.structureItems,
        updatedMechanicalItems,
        unit.unitType
      );

      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });
      if (masterplan) {
        const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
        if (fabPhase) {
          await tx.unitProgress.update({
            where: {
              phaseId_unitId: {
                phaseId: fabPhase.id,
                unitId: unit.id,
              },
            },
            data: { actualPercent: newUnitProgress },
          });

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

          const allPhases = await tx.masterplanPhase.findMany({
            where: { masterplanId: masterplan.id },
          });
          const updatedPhases = allPhases.map((p) =>
            p.id === fabPhase.id ? { ...p, actualProgress: newPhaseProgress } : p
          );

          const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

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
        }
      }

      await tx.productionLog.create({
        data: {
          projectId: unit.projectId,
          message: `Edit rincian komponen mekanikal "${newName}" (Qty: ${newQty} ${newSatuan}) pada "${unit.name}".`,
          user: userBy,
        },
      });

      return unit;
    });

    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error updating mechanical item details:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui detail komponen mekanikal.") };
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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengubah status sub-step tahapan.") };
  }
}

/**
 * Directly updates progress (%) for site / field work phases 
 * (e.g. Clearing, Civil Work, Erection, Electrical System, Commissioning).
 */
export async function updatePhaseProgressDirect(
  phaseId: string,
  actualProgress: number,
  notes?: string,
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const cleanProgress = Math.min(100, Math.max(0, Number(actualProgress) || 0));

    const result = await prisma.$transaction(async (tx) => {
      const phase = await tx.masterplanPhase.findUnique({
        where: { id: phaseId },
      });
      if (!phase) throw new Error("Tahapan masterplan tidak ditemukan");

      // 1. Update phase actualProgress & status
      const updatedPhase = await tx.masterplanPhase.update({
        where: { id: phaseId },
        data: {
          actualProgress: cleanProgress,
          status:
            cleanProgress >= 100
              ? "COMPLETED"
              : cleanProgress > 0
                ? "IN_PROGRESS"
                : "PENDING",
        },
      });

      // 2. Recalculate total project progress
      const allPhases = await tx.masterplanPhase.findMany({
        where: { masterplanId: phase.masterplanId },
      });
      const updatedPhases = allPhases.map((p) =>
        p.id === phaseId ? { ...p, actualProgress: cleanProgress } : p,
      );
      const projectTotalProgress = calcProjectTotalProgress(updatedPhases);

      // 3. Update current week's actual S-Curve progress
      const currentDate = new Date();
      const currentWeekPlan = await tx.weeklyPlan.findFirst({
        where: {
          masterplanId: phase.masterplanId,
          weekStartDate: { lte: currentDate },
          weekEndDate: { gte: currentDate },
        },
      });

      if (currentWeekPlan) {
        await tx.weeklyPlan.update({
          where: { id: currentWeekPlan.id },
          data: {
            actualCumulativePercent: projectTotalProgress,
            variance:
              projectTotalProgress - Number(currentWeekPlan.planCumulativePercent),
          },
        });
      }

      const masterplan = await tx.masterplan.findUnique({
        where: { id: phase.masterplanId },
      });

      if (masterplan) {
        await tx.productionLog.create({
          data: {
            projectId: masterplan.projectId,
            message: `Update progress tahapan "${phase.name}" menjadi ${cleanProgress}%${notes ? ` (${notes})` : ""}`,
            user: userBy,
          },
        });
      }

      return {
        phaseProgress: cleanProgress,
        projectProgress: projectTotalProgress,
      };
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/engineering");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error updating phase progress direct:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memperbarui progress tahapan."),
    };
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
    structureItems?: Array<ComponentItemInput | string>;
    mechanicalItems?: Array<ComponentItemInput | string>;
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
          const item = input.structureItems[i];
          const name = typeof item === "string" ? item.trim() : (item.name || "").trim();
          if (!name) continue;
          const qty = typeof item === "string" ? 1 : Number(item.qty) || 1;
          const satuan = typeof item === "string" ? "unit" : (item.satuan || "unit").trim();

          await tx.structureItem.create({
            data: {
              unitId: unit.id,
              name,
              qty,
              satuan,
              orderIndex: i + 1,
            },
          });
        }
      }

      // 5. Create Mechanical Items
      if (input.mechanicalItems && input.mechanicalItems.length > 0) {
        for (let i = 0; i < input.mechanicalItems.length; i++) {
          const item = input.mechanicalItems[i];
          const name = typeof item === "string" ? item.trim() : (item.name || "").trim();
          if (!name) continue;
          const qty = typeof item === "string" ? 1 : Number(item.qty) || 1;
          const satuan = typeof item === "string" ? "unit" : (item.satuan || "unit").trim();

          await tx.mechanicalItem.create({
            data: {
              unitId: unit.id,
              name,
              qty,
              satuan,
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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menambah unit conveyor.") };
  }
}

export type ComponentItemInput = {
  name: string;
  qty?: number;
  satuan?: string;
};

/**
 * Adds new structure items directly to an existing Conveyor Unit without re-setting up the masterplan.
 */
export async function addStructureItemsToUnit(
  unitId: string,
  items: Array<ComponentItemInput | string>
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const cleanItems = items
      .map((item) => {
        if (typeof item === "string") {
          return { name: item.trim(), qty: 1, satuan: "unit" };
        }
        return {
          name: (item.name || "").trim(),
          qty: Number(item.qty) || 1,
          satuan: (item.satuan || "unit").trim(),
        };
      })
      .filter((item) => item.name.length > 0);

    if (cleanItems.length === 0) {
      throw new Error("Nama komponen tidak boleh kosong.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const unit = await tx.conveyorUnit.findUnique({
        where: { id: unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Unit Conveyor tidak ditemukan.");

      const currentCount = unit.structureItems.length;

      // 1. Create items
      let idx = currentCount + 1;
      for (const itemObj of cleanItems) {
        await tx.structureItem.create({
          data: {
            unitId,
            name: itemObj.name,
            qty: itemObj.qty,
            satuan: itemObj.satuan,
            orderIndex: idx++,
          },
        });
      }

      // 2. Fetch updated items
      const updatedUnit = await tx.conveyorUnit.findUnique({
        where: { id: unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!updatedUnit) throw new Error("Unit Conveyor tidak ditemukan.");

      // 3. Recalculate unit progress
      const newUnitProgress = calcUnitProgress(
        updatedUnit.structureItems,
        updatedUnit.mechanicalItems,
        updatedUnit.unitType
      );

      // 4. Update FAB_STRUCT_MECH phase progress
      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });

      if (masterplan) {
        const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
        if (fabPhase) {
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

          const allUnitProgresses = await tx.unitProgress.findMany({
            where: { phaseId: fabPhase.id },
          });
          const newPhaseProgress = calcPhaseProgress(allUnitProgresses);

          await tx.masterplanPhase.update({
            where: { id: fabPhase.id },
            data: {
              actualProgress: newPhaseProgress,
              status: newPhaseProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
            },
          });

          const allPhases = await tx.masterplanPhase.findMany({
            where: { masterplanId: masterplan.id },
          });
          const projectTotalProgress = calcProjectTotalProgress(allPhases);

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
        }
      }

      await tx.productionLog.create({
        data: {
          projectId: unit.projectId,
          message: `Menambahkan ${cleanItems.length} komponen struktur baru pada unit "${unit.name}".`,
          user: userBy,
        },
      });

      return updatedUnit;
    });

    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error adding structure items:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menambah komponen struktur.") };
  }
}

/**
 * Adds new mechanical items directly to an existing Conveyor Unit without re-setting up the masterplan.
 */
export async function addMechanicalItemsToUnit(
  unitId: string,
  items: Array<ComponentItemInput | string>
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const cleanItems = items
      .map((item) => {
        if (typeof item === "string") {
          return { name: item.trim(), qty: 1, satuan: "unit" };
        }
        return {
          name: (item.name || "").trim(),
          qty: Number(item.qty) || 1,
          satuan: (item.satuan || "unit").trim(),
        };
      })
      .filter((item) => item.name.length > 0);

    if (cleanItems.length === 0) {
      throw new Error("Nama komponen tidak boleh kosong.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const unit = await tx.conveyorUnit.findUnique({
        where: { id: unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!unit) throw new Error("Unit Conveyor tidak ditemukan.");

      const currentCount = unit.mechanicalItems.length;

      // 1. Create items
      let idx = currentCount + 1;
      for (const itemObj of cleanItems) {
        await tx.mechanicalItem.create({
          data: {
            unitId,
            name: itemObj.name,
            qty: itemObj.qty,
            satuan: itemObj.satuan,
            orderIndex: idx++,
          },
        });
      }

      // 2. Fetch updated items
      const updatedUnit = await tx.conveyorUnit.findUnique({
        where: { id: unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!updatedUnit) throw new Error("Unit Conveyor tidak ditemukan.");

      // 3. Recalculate unit progress
      const newUnitProgress = calcUnitProgress(
        updatedUnit.structureItems,
        updatedUnit.mechanicalItems,
        updatedUnit.unitType
      );

      // 4. Update FAB_STRUCT_MECH phase progress
      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: unit.projectId },
        include: { phases: true },
      });

      if (masterplan) {
        const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
        if (fabPhase) {
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

          const allUnitProgresses = await tx.unitProgress.findMany({
            where: { phaseId: fabPhase.id },
          });
          const newPhaseProgress = calcPhaseProgress(allUnitProgresses);

          await tx.masterplanPhase.update({
            where: { id: fabPhase.id },
            data: {
              actualProgress: newPhaseProgress,
              status: newPhaseProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
            },
          });

          const allPhases = await tx.masterplanPhase.findMany({
            where: { masterplanId: masterplan.id },
          });
          const projectTotalProgress = calcProjectTotalProgress(allPhases);

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
        }
      }

      await tx.productionLog.create({
        data: {
          projectId: unit.projectId,
          message: `Menambahkan ${cleanItems.length} komponen mekanikal baru pada unit "${unit.name}".`,
          user: userBy,
        },
      });

      return updatedUnit;
    });

    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error adding mechanical items:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menambah komponen mekanikal.") };
  }
}

/**
 * Deletes a structure item directly from a unit.
 */
export async function deleteStructureItem(itemId: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.structureItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Komponen tidak ditemukan.");

      await tx.structureItem.delete({
        where: { id: itemId },
      });

      const updatedUnit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!updatedUnit) throw new Error("Unit Conveyor tidak ditemukan.");

      const newUnitProgress = calcUnitProgress(
        updatedUnit.structureItems,
        updatedUnit.mechanicalItems,
        updatedUnit.unitType
      );

      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: updatedUnit.projectId },
        include: { phases: true },
      });

      if (masterplan) {
        const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
        if (fabPhase) {
          await tx.unitProgress.update({
            where: {
              phaseId_unitId: {
                phaseId: fabPhase.id,
                unitId: updatedUnit.id,
              },
            },
            data: {
              actualPercent: newUnitProgress,
            },
          });

          const allUnitProgresses = await tx.unitProgress.findMany({
            where: { phaseId: fabPhase.id },
          });
          const newPhaseProgress = calcPhaseProgress(allUnitProgresses);

          await tx.masterplanPhase.update({
            where: { id: fabPhase.id },
            data: {
              actualProgress: newPhaseProgress,
              status: newPhaseProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
            },
          });

          const allPhases = await tx.masterplanPhase.findMany({
            where: { masterplanId: masterplan.id },
          });
          const projectTotalProgress = calcProjectTotalProgress(allPhases);

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
        }
      }

      await tx.productionLog.create({
        data: {
          projectId: updatedUnit.projectId,
          message: `Menghapus komponen struktur "${item.name}" pada unit "${item.unit.name}".`,
          user: userBy,
        },
      });

      return updatedUnit;
    });

    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error deleting structure item:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghapus komponen struktur.") };
  }
}

/**
 * Deletes a mechanical item directly from a unit.
 */
export async function deleteMechanicalItem(itemId: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.mechanicalItem.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });
      if (!item) throw new Error("Komponen tidak ditemukan.");

      await tx.mechanicalItem.delete({
        where: { id: itemId },
      });

      const updatedUnit = await tx.conveyorUnit.findUnique({
        where: { id: item.unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
        },
      });
      if (!updatedUnit) throw new Error("Unit Conveyor tidak ditemukan.");

      const newUnitProgress = calcUnitProgress(
        updatedUnit.structureItems,
        updatedUnit.mechanicalItems,
        updatedUnit.unitType
      );

      const masterplan = await tx.masterplan.findUnique({
        where: { projectId: updatedUnit.projectId },
        include: { phases: true },
      });

      if (masterplan) {
        const fabPhase = masterplan.phases.find((p) => p.code === "FAB_STRUCT_MECH");
        if (fabPhase) {
          await tx.unitProgress.update({
            where: {
              phaseId_unitId: {
                phaseId: fabPhase.id,
                unitId: updatedUnit.id,
              },
            },
            data: {
              actualPercent: newUnitProgress,
            },
          });

          const allUnitProgresses = await tx.unitProgress.findMany({
            where: { phaseId: fabPhase.id },
          });
          const newPhaseProgress = calcPhaseProgress(allUnitProgresses);

          await tx.masterplanPhase.update({
            where: { id: fabPhase.id },
            data: {
              actualProgress: newPhaseProgress,
              status: newPhaseProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
            },
          });

          const allPhases = await tx.masterplanPhase.findMany({
            where: { masterplanId: masterplan.id },
          });
          const projectTotalProgress = calcProjectTotalProgress(allPhases);

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
        }
      }

      await tx.productionLog.create({
        data: {
          projectId: updatedUnit.projectId,
          message: `Menghapus komponen mekanikal "${item.name}" pada unit "${item.unit.name}".`,
          user: userBy,
        },
      });

      return updatedUnit;
    });

    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error deleting mechanical item:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghapus komponen mekanikal.") };
  }
}

export async function reorderStructureItems(
  unitId: string,
  orderedIds: string[]
) {
  try {
    await requireAuth();
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.structureItem.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (error: any) {
    console.error("Error reordering structure items:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyusun urutan komponen struktur.") };
  }
}

export async function reorderMechanicalItems(
  unitId: string,
  orderedIds: string[]
) {
  try {
    await requireAuth();
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.mechanicalItem.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (error: any) {
    console.error("Error reordering mechanical items:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyusun urutan komponen mekanikal.") };
  }
}

export async function updateConveyorUnitDetails(
  unitId: string,
  dataInput: {
    name: string;
    unitType: "STRUCTURE" | "MECHANICAL" | "BOTH";
    satuan?: string;
    volume?: number;
  }
) {
  try {
    await requireAuth();
    await prisma.conveyorUnit.update({
      where: { id: unitId },
      data: {
        name: dataInput.name.trim(),
        unitType: dataInput.unitType,
        satuan: dataInput.satuan?.trim() || "unit",
        volume: Number(dataInput.volume) || 1,
      },
    });

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating conveyor unit details:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui detail unit conveyor.") };
  }
}

export async function updateAllUnitWeights(
  projectId: string,
  weights: Array<{ unitId: string; weightPercent: number }>
) {
  try {
    await requireAuth();

    await prisma.$transaction(async (tx) => {
      for (const item of weights) {
        await tx.unitProgress.updateMany({
          where: { unitId: item.unitId },
          data: { weightPercent: Number(item.weightPercent) },
        });
      }
    });

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating unit weights:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui bobot unit.") };
  }
}

export async function deleteConveyorUnit(unitId: string) {
  try {
    await requireAuth();
    const unit = await prisma.conveyorUnit.findUnique({
      where: { id: unitId },
    });
    if (!unit) throw new Error("Unit conveyor tidak ditemukan.");

    await prisma.$transaction(async (tx) => {
      await tx.structureItem.deleteMany({ where: { unitId } });
      await tx.mechanicalItem.deleteMany({ where: { unitId } });
      await tx.unitProgress.deleteMany({ where: { unitId } });
      await tx.conveyorUnit.delete({ where: { id: unitId } });
    });

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting conveyor unit:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghapus unit conveyor.") };
  }
}

export async function reorderConveyorUnits(
  projectId: string,
  orderedUnitIds: string[]
) {
  try {
    await requireAuth();
    await prisma.$transaction(
      orderedUnitIds.map((id, index) =>
        prisma.conveyorUnit.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (error: any) {
    console.error("Error reordering conveyor units:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyusun urutan unit conveyor.") };
  }
}

export async function bulkUpdateStructureStage(
  unitId: string,
  stage: "CUTTING" | "SETTING" | "WELDING" | "FINISHING" | "PAINTING" | "PACKAGING" | "RESET" | "ALL",
  isDone: boolean
) {
  try {
    await requireAuth();

    await prisma.$transaction(async (tx) => {
      const items = await tx.structureItem.findMany({
        where: { unitId },
      });

      for (const item of items) {
        const qty = Math.max(1, item.qty || 1);
        let cuttingQty = item.cuttingQty ?? (item.cuttingDone ? qty : 0);
        let settingQty = item.settingQty ?? (item.settingDone ? qty : 0);
        let weldingQty = item.weldingQty ?? (item.weldingDone ? qty : 0);
        let finishingQty = item.finishingQty ?? (item.finishingDone ? qty : 0);
        let paintingQty = item.paintingQty ?? (item.paintingDone ? qty : 0);
        let packagingQty = item.packagingQty ?? (item.packagingDone ? qty : 0);

        if (stage === "ALL") {
          cuttingQty = isDone ? qty : 0;
          settingQty = isDone ? qty : 0;
          weldingQty = isDone ? qty : 0;
          finishingQty = isDone ? qty : 0;
          paintingQty = isDone ? qty : 0;
          packagingQty = isDone ? qty : 0;
        } else if (stage === "RESET") {
          cuttingQty = 0;
          settingQty = 0;
          weldingQty = 0;
          finishingQty = 0;
          paintingQty = 0;
          packagingQty = 0;
        } else if (stage === "CUTTING") {
          cuttingQty = isDone ? qty : 0;
        } else if (stage === "SETTING") {
          settingQty = isDone ? qty : 0;
        } else if (stage === "WELDING") {
          weldingQty = isDone ? qty : 0;
        } else if (stage === "FINISHING") {
          finishingQty = isDone ? qty : 0;
        } else if (stage === "PAINTING") {
          paintingQty = isDone ? qty : 0;
        } else if (stage === "PACKAGING") {
          packagingQty = isDone ? qty : 0;
        }

        const merged = {
          ...item,
          cuttingQty,
          settingQty,
          weldingQty,
          finishingQty,
          paintingQty,
          packagingQty,
        };
        const newProgress = calcStructureItemProgress(merged);

        await tx.structureItem.update({
          where: { id: item.id },
          data: {
            cuttingQty,
            settingQty,
            weldingQty,
            finishingQty,
            paintingQty,
            packagingQty,
            cuttingDone: cuttingQty >= qty,
            settingDone: settingQty >= qty,
            weldingDone: weldingQty >= qty,
            finishingDone: finishingQty >= qty,
            paintingDone: paintingQty >= qty,
            packagingDone: packagingQty >= qty,
            progressPercent: newProgress,
          },
        });
      }
    });

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (err: any) {
    console.error("Error bulk updating structure stage:", err);
    return { success: false, error: sanitizeErrorMessage(err, "Gagal memperbarui tahapan struktur secara massal.") };
  }
}

export async function bulkUpdateMechanicalStage(
  unitId: string,
  stage: "PROCUREMENT" | "PO" | "FABRICATION" | "PACKAGING" | "RESET" | "ALL",
  isDone: boolean
) {
  try {
    await requireAuth();

    await prisma.$transaction(async (tx) => {
      const items = await tx.mechanicalItem.findMany({
        where: { unitId },
      });

      for (const item of items) {
        const qty = Math.max(1, item.qty || 1);
        let procurementQty = item.procurementQty ?? (item.procurementDone ? qty : 0);
        let poQty = item.poQty ?? (item.poDone ? qty : 0);
        let fabricationQty = item.fabricationQty ?? (item.fabricationDone ? qty : 0);
        let packagingQty = item.packagingQty ?? (item.packagingDone ? qty : 0);

        if (stage === "ALL") {
          procurementQty = isDone ? qty : 0;
          poQty = isDone ? qty : 0;
          fabricationQty = isDone ? qty : 0;
          packagingQty = isDone ? qty : 0;
        } else if (stage === "RESET") {
          procurementQty = 0;
          poQty = 0;
          fabricationQty = 0;
          packagingQty = 0;
        } else if (stage === "PROCUREMENT") {
          procurementQty = isDone ? qty : 0;
        } else if (stage === "PO") {
          poQty = isDone ? qty : 0;
        } else if (stage === "FABRICATION") {
          fabricationQty = isDone ? qty : 0;
        } else if (stage === "PACKAGING") {
          packagingQty = isDone ? qty : 0;
        }

        const merged = {
          ...item,
          procurementQty,
          poQty,
          fabricationQty,
          packagingQty,
        };
        const newProgress = calcMechanicalItemProgress(merged);

        await tx.mechanicalItem.update({
          where: { id: item.id },
          data: {
            procurementQty,
            poQty,
            fabricationQty,
            packagingQty,
            procurementDone: procurementQty >= qty,
            poDone: poQty >= qty,
            fabricationDone: fabricationQty >= qty,
            packagingDone: packagingQty >= qty,
            progressPercent: newProgress,
          },
        });
      }
    });

    revalidatePath("/trackers/production");
    return { success: true };
  } catch (err: any) {
    console.error("Error bulk updating mechanical stage:", err);
    return { success: false, error: sanitizeErrorMessage(err, "Gagal memperbarui tahapan mekanikal secara massal.") };
  }
}


