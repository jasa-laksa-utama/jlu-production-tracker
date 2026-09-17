"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import {
  ERECTION_WEIGHTS,
  calcErectionItemProgress,
  calcUnitErectionProgress,
} from "@/lib/erection-calculator";
import { sanitizeErrorMessage } from "@/lib/error-handler";

/**
 * Fetches all data for the Erection Tracker for a specific project.
 */
export async function getErectionTrackerData(projectId?: string) {
  try {
    await requireAuth();

    // 1. Fetch available projects with masterplan
    const projects = await prisma.project.findMany({
      where: {
        status: { notIn: ["CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectNumber: true,
        projectName: true,
        status: true,
        estimatedTonnage: true,
        customer: { select: { name: true, company: true } },
        masterplan: {
          select: {
            id: true,
            totalWeeks: true,
            startDate: true,
            phases: {
              where: {
                OR: [
                  { code: "ERECTION" },
                  { name: { contains: "ERECTION", mode: "insensitive" } },
                  { name: { contains: "EREKSI", mode: "insensitive" } },
                ],
              },
              select: {
                id: true,
                code: true,
                name: true,
                weightPercent: true,
                actualProgress: true,
                planProgress: true,
                startWeek: true,
                endWeek: true,
                status: true,
                unitProgresses: {
                  select: {
                    unitId: true,
                    weightPercent: true,
                    actualPercent: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const activeProjectId = projectId || (projects.length > 0 ? projects[0].id : null);
    if (!activeProjectId) {
      return { success: true, projects: [], currentProject: null, units: [] };
    }

    const currentProject = await prisma.project.findUnique({
      where: { id: activeProjectId },
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
            weeklyPlans: {
              orderBy: { weekNumber: "asc" },
            },
          },
        },
        conveyorUnits: {
          orderBy: { orderIndex: "asc" },
          include: {
            structureItems: { orderBy: { orderIndex: "asc" } },
            mechanicalItems: { orderBy: { orderIndex: "asc" } },
            progresses: true,
          },
        },
      },
    });

    if (!currentProject) {
      return { success: false, error: "Project not found", projects: [], currentProject: null, units: [] };
    }

    return {
      success: true,
      projects: JSON.parse(JSON.stringify(projects)),
      currentProject: JSON.parse(JSON.stringify(currentProject)),
      units: JSON.parse(JSON.stringify(currentProject.conveyorUnits)),
    };
  } catch (error: any) {
    console.error("Error getErectionTrackerData:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data Erection Tracker"),
      projects: [],
      currentProject: null,
      units: [],
    };
  }
}

/**
 * Updates an item's Erection status (Sett, Install, Finish) by quantity or checkbox boolean.
 */
export async function updateErectionItemChecklist(
  itemId: string,
  itemType: "STRUCTURE" | "MECHANICAL",
  dataInput: {
    erectionSettQty?: number;
    erectionInstallQty?: number;
    erectionFinishQty?: number;
    erectionSettDone?: boolean;
    erectionInstallDone?: boolean;
    erectionFinishDone?: boolean;
  }
) {
  try {
    await requireAuth();

    const result = await prisma.$transaction(async (tx) => {
      let unitId = "";
      let itemQty = 1;
      let existingItem: any = null;

      if (itemType === "STRUCTURE") {
        existingItem = await tx.structureItem.findUnique({
          where: { id: itemId },
        });
        if (!existingItem) throw new Error("Structure item tidak ditemukan");
        unitId = existingItem.unitId;
        itemQty = Math.max(1, existingItem.qty || 1);
      } else {
        existingItem = await tx.mechanicalItem.findUnique({
          where: { id: itemId },
        });
        if (!existingItem) throw new Error("Mechanical item tidak ditemukan");
        unitId = existingItem.unitId;
        itemQty = Math.max(1, existingItem.qty || 1);
      }

      // Calculate Sett Qty
      const erectionSettQty = Number(
        dataInput.erectionSettQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.erectionSettQty))
          : (dataInput.erectionSettDone !== undefined
              ? (dataInput.erectionSettDone ? itemQty : 0)
              : (existingItem.erectionSettQty ?? (existingItem.erectionSettDone ? itemQty : 0)))
      );

      // Calculate Install Qty
      const erectionInstallQty = Number(
        dataInput.erectionInstallQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.erectionInstallQty))
          : (dataInput.erectionInstallDone !== undefined
              ? (dataInput.erectionInstallDone ? itemQty : 0)
              : (existingItem.erectionInstallQty ?? (existingItem.erectionInstallDone ? itemQty : 0)))
      );

      // Calculate Finish Qty
      const erectionFinishQty = Number(
        dataInput.erectionFinishQty !== undefined
          ? Math.min(itemQty, Math.max(0, dataInput.erectionFinishQty))
          : (dataInput.erectionFinishDone !== undefined
              ? (dataInput.erectionFinishDone ? itemQty : 0)
              : (existingItem.erectionFinishQty ?? (existingItem.erectionFinishDone ? itemQty : 0)))
      );

      const mergedItem = {
        ...existingItem,
        qty: itemQty,
        erectionSettQty,
        erectionInstallQty,
        erectionFinishQty,
      };

      const newProgress = calcErectionItemProgress(mergedItem);

      if (itemType === "STRUCTURE") {
        await tx.structureItem.update({
          where: { id: itemId },
          data: {
            erectionSettQty,
            erectionInstallQty,
            erectionFinishQty,
            erectionSettDone: erectionSettQty >= itemQty,
            erectionInstallDone: erectionInstallQty >= itemQty,
            erectionFinishDone: erectionFinishQty >= itemQty,
            erectionProgress: newProgress,
          },
        });
      } else {
        await tx.mechanicalItem.update({
          where: { id: itemId },
          data: {
            erectionSettQty,
            erectionInstallQty,
            erectionFinishQty,
            erectionSettDone: erectionSettQty >= itemQty,
            erectionInstallDone: erectionInstallQty >= itemQty,
            erectionFinishDone: erectionFinishQty >= itemQty,
            erectionProgress: newProgress,
          },
        });
      }

      // Fetch all items for this ConveyorUnit to update unit erection progress
      const unit = await tx.conveyorUnit.findUnique({
        where: { id: unitId },
        include: {
          structureItems: true,
          mechanicalItems: true,
          project: {
            include: {
              masterplan: {
                include: {
                  phases: {
                    include: {
                      unitProgresses: true,
                    },
                  },
                  weeklyPlans: true,
                },
              },
            },
          },
        },
      });

      if (!unit) throw new Error("Conveyor unit tidak ditemukan");

      // Replace updated item in local list
      const updatedStructureItems = unit.structureItems.map((si) =>
        si.id === itemId && itemType === "STRUCTURE"
          ? {
              ...si,
              erectionSettQty,
              erectionInstallQty,
              erectionFinishQty,
              erectionProgress: newProgress,
            }
          : si
      );

      const updatedMechanicalItems = unit.mechanicalItems.map((mi) =>
        mi.id === itemId && itemType === "MECHANICAL"
          ? {
              ...mi,
              erectionSettQty,
              erectionInstallQty,
              erectionFinishQty,
              erectionProgress: newProgress,
            }
          : mi
      );

      const unitErectionProgress = calcUnitErectionProgress(
        updatedStructureItems,
        updatedMechanicalItems
      );

      // Find Erection Masterplan Phase if available
      const masterplan = unit.project?.masterplan;
      if (masterplan) {
        const erectionPhase = masterplan.phases.find(
          (p) =>
            p.code === "ERECTION" ||
            p.name.toUpperCase().includes("ERECTION") ||
            p.name.toUpperCase().includes("EREKSI")
        );

        if (erectionPhase) {
          // Update UnitProgress for Erection Phase
          await tx.unitProgress.upsert({
            where: {
              phaseId_unitId: {
                phaseId: erectionPhase.id,
                unitId: unit.id,
              },
            },
            create: {
              phaseId: erectionPhase.id,
              unitId: unit.id,
              weightPercent: 0, // default if not set
              actualPercent: unitErectionProgress,
            },
            update: {
              actualPercent: unitErectionProgress,
            },
          });

          // Fetch all unit progresses in Erection phase
          const allUnits = await tx.conveyorUnit.findMany({
            where: { projectId: unit.projectId },
            include: {
              structureItems: true,
              mechanicalItems: true,
              progresses: {
                where: { phaseId: erectionPhase.id },
              },
            },
          });

          let phaseTotalActual = 0;
          const totalUnitsCount = allUnits.length;
          const hasCustomWeights = allUnits.some(
            (u) => u.progresses.length > 0 && Number(u.progresses[0].weightPercent) > 0
          );

          allUnits.forEach((u) => {
            const uProg =
              u.id === unit.id
                ? unitErectionProgress
                : calcUnitErectionProgress(u.structureItems, u.mechanicalItems);

            if (hasCustomWeights && u.progresses.length > 0) {
              const w = Number(u.progresses[0].weightPercent) || 0;
              phaseTotalActual += (uProg * w) / 100;
            } else {
              // Equal distribution fallback
              const equalWeight = totalUnitsCount > 0 ? 100 / totalUnitsCount : 0;
              phaseTotalActual += (uProg * equalWeight) / 100;
            }
          });

          const cleanPhaseProgress = Math.min(100, Math.round(phaseTotalActual * 100) / 100);

          await tx.masterplanPhase.update({
            where: { id: erectionPhase.id },
            data: {
              actualProgress: cleanPhaseProgress,
              status:
                cleanPhaseProgress >= 100
                  ? "COMPLETED"
                  : cleanPhaseProgress > 0
                  ? "IN_PROGRESS"
                  : "NOT_STARTED",
            },
          });

          // Sync Masterplan Weekly Snapshot
          const { syncMasterplanWeeklySnapshot } = await import("@/app/actions/masterplan");
          await syncMasterplanWeeklySnapshot(masterplan.id);
        }
      }

      return {
        itemProgress: newProgress,
        unitErectionProgress,
        projectId: unit.projectId,
      };
    });

    revalidatePath("/trackers/erection");
    revalidatePath("/trackers/production");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error updateErectionItemChecklist:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui checklist Erection") };
  }
}

/**
 * Bulk updates a whole stage (e.g. SETT, INSTALL, FINISH) for all items in a unit or category.
 */
export async function bulkUpdateErectionStage(
  unitId: string,
  category: "ALL" | "STRUCTURE" | "MECHANICAL",
  stage: "SETT" | "INSTALL" | "FINISH",
  done: boolean
) {
  try {
    await requireAuth();

    const unit = await prisma.conveyorUnit.findUnique({
      where: { id: unitId },
      include: {
        structureItems: true,
        mechanicalItems: true,
      },
    });

    if (!unit) throw new Error("Unit tidak ditemukan");

    await prisma.$transaction(async (tx) => {
      if (category === "ALL" || category === "STRUCTURE") {
        for (const item of unit.structureItems) {
          const qty = Math.max(1, item.qty || 1);
          const data: any = {};
          if (stage === "SETT") {
            data.erectionSettQty = done ? qty : 0;
            data.erectionSettDone = done;
          } else if (stage === "INSTALL") {
            data.erectionInstallQty = done ? qty : 0;
            data.erectionInstallDone = done;
          } else if (stage === "FINISH") {
            data.erectionFinishQty = done ? qty : 0;
            data.erectionFinishDone = done;
          }

          const merged = { ...item, ...data };
          data.erectionProgress = calcErectionItemProgress(merged);

          await tx.structureItem.update({
            where: { id: item.id },
            data,
          });
        }
      }

      if (category === "ALL" || category === "MECHANICAL") {
        for (const item of unit.mechanicalItems) {
          const qty = Math.max(1, item.qty || 1);
          const data: any = {};
          if (stage === "SETT") {
            data.erectionSettQty = done ? qty : 0;
            data.erectionSettDone = done;
          } else if (stage === "INSTALL") {
            data.erectionInstallQty = done ? qty : 0;
            data.erectionInstallDone = done;
          } else if (stage === "FINISH") {
            data.erectionFinishQty = done ? qty : 0;
            data.erectionFinishDone = done;
          }

          const merged = { ...item, ...data };
          data.erectionProgress = calcErectionItemProgress(merged);

          await tx.mechanicalItem.update({
            where: { id: item.id },
            data,
          });
        }
      }
    });

    // Recalculate Masterplan Progress
    const { syncErectionMasterplanProgress } = await import("@/app/actions/erection-progress");
    await syncErectionMasterplanProgress(unit.projectId);

    revalidatePath("/trackers/erection");
    revalidatePath("/trackers/production");
    revalidatePath("/dashboard");

    return { success: true, message: `Bulk update ${stage} berhasil disimpan` };
  } catch (error: any) {
    console.error("Error bulkUpdateErectionStage:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal melakukan bulk update Erection") };
  }
}

/**
 * Recalculates and syncs Erection Masterplan Phase Progress for a Project.
 */
export async function syncErectionMasterplanProgress(projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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
            progresses: true,
          },
        },
      },
    });

    if (!project || !project.masterplan) return;

    const erectionPhase = project.masterplan.phases.find(
      (p) =>
        p.code === "ERECTION" ||
        p.name.toUpperCase().includes("ERECTION") ||
        p.name.toUpperCase().includes("EREKSI")
    );

    if (!erectionPhase) return;

    const allUnits = project.conveyorUnits;
    if (allUnits.length === 0) return;

    let phaseTotalActual = 0;
    const hasCustomWeights = allUnits.some(
      (u) =>
        u.progresses.some(
          (up) => up.phaseId === erectionPhase.id && Number(up.weightPercent) > 0
        )
    );

    for (const u of allUnits) {
      const uProg = calcUnitErectionProgress(u.structureItems, u.mechanicalItems);

      // Update UnitProgress for this unit
      await prisma.unitProgress.upsert({
        where: {
          phaseId_unitId: {
            phaseId: erectionPhase.id,
            unitId: u.id,
          },
        },
        create: {
          phaseId: erectionPhase.id,
          unitId: u.id,
          weightPercent: 0,
          actualPercent: uProg,
        },
        update: {
          actualPercent: uProg,
        },
      });

      const upRecord = u.progresses.find((up) => up.phaseId === erectionPhase.id);
      if (hasCustomWeights && upRecord && Number(upRecord.weightPercent) > 0) {
        phaseTotalActual += (uProg * Number(upRecord.weightPercent)) / 100;
      } else {
        const equalWeight = 100 / allUnits.length;
        phaseTotalActual += (uProg * equalWeight) / 100;
      }
    }

    const cleanPhaseProgress = Math.min(100, Math.round(phaseTotalActual * 100) / 100);

    await prisma.masterplanPhase.update({
      where: { id: erectionPhase.id },
      data: {
        actualProgress: cleanPhaseProgress,
        status:
          cleanPhaseProgress >= 100
            ? "COMPLETED"
            : cleanPhaseProgress > 0
            ? "IN_PROGRESS"
            : "NOT_STARTED",
      },
    });

    const { syncMasterplanWeeklySnapshot } = await import("@/app/actions/masterplan");
    await syncMasterplanWeeklySnapshot(project.masterplan.id);
  } catch (e) {
    console.error("Error syncing erection masterplan progress:", e);
  }
}
