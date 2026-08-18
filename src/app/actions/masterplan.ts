"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { auth } from "@/auth";
import { DEFAULT_CONVEYOR_PHASES } from "@/lib/progress-weights";
import { distributeWeeklyPlanProgress } from "@/lib/s-curve-calculator";
import {
  checkEngineeringPrerequisitesLocal,
  calculateEngineeringProgress,
} from "@/lib/engineering-progress";
import { getPhaseProgressAtCutoff } from "@/lib/masterplan-cutoff-utils";

export async function checkEngineeringPrerequisites(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: true,
      lead: {
        include: { documents: true },
      },
      boqs: {
        include: { boqItems: true },
      },
    },
  });

  if (!project) {
    return {
      canCreateMasterplan: false,
      hasDrawing: false,
      hasBoq: false,
      hasPartList: false,
      missingItems: ["Proyek tidak ditemukan"],
    };
  }

  return checkEngineeringPrerequisitesLocal(project);
}



export async function syncMasterplanWeeklySnapshot(masterplanId: string) {
  try {
    const masterplan = await prisma.masterplan.findUnique({
      where: { id: masterplanId },
      include: {
        phases: {
          include: { subProgresses: true },
        },
        weeklyPlans: { orderBy: { weekNumber: "asc" } },
        project: {
          include: {
            spb: true,
            boqs: { include: { boqItems: true } },
            documents: true,
            productionLogs: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    });

    if (!masterplan) return;

    const start = masterplan.startDate ? new Date(masterplan.startDate) : new Date();
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const elapsedDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const currentWeekNum = Math.min(masterplan.totalWeeks, Math.max(1, Math.floor(elapsedDays / 7) + 1));

    let prevActualCum = 0;

    for (const wp of masterplan.weeklyPlans) {
      if (wp.weekNumber <= currentWeekNum) {
        // Cutoff end date for this week: 23:59:59 of weekEndDate
        const weekCutoff = new Date(wp.weekEndDate);
        weekCutoff.setHours(23, 59, 59, 999);

        // Calculate total actual progress at this week's end cutoff
        const weekActualCum = masterplan.phases.reduce((sum, phase) => {
          const weight = Number(phase.weightPercent || 0);
          const phaseProgAtCutoff = getPhaseProgressAtCutoff(phase, masterplan.project, weekCutoff);
          return sum + (phaseProgAtCutoff / 100) * weight;
        }, 0);

        const roundedActualCum = Math.round(weekActualCum * 100) / 100;
        const planCum = Number(wp.planCumulativePercent || 0);
        const actualWeekly = Math.max(0, Math.round((roundedActualCum - prevActualCum) * 100) / 100);
        const variance = Math.round((roundedActualCum - planCum) * 100) / 100;

        await prisma.weeklyPlan.update({
          where: { id: wp.id },
          data: {
            actualCumulativePercent: roundedActualCum,
            actualWeeklyPercent: actualWeekly,
            variance,
          },
        });

        prevActualCum = roundedActualCum;
      }
    }
  } catch (err) {
    console.error("Error syncing masterplan weekly snapshot:", err);
  }
}

export async function syncEngineeringMasterplanProgress(projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        documents: true,
        lead: {
          include: { documents: true },
        },
        boqs: {
          include: { boqItems: true },
          orderBy: { createdAt: "desc" },
        },
        masterplan: {
          include: { phases: true },
        },
      },
    });

    if (!project) return;

    const { engProgress } = calculateEngineeringProgress(project);

    if (project.masterplan) {
      const engPhase = project.masterplan.phases.find(
        (p) => p.code === "ENGINEERING" || p.name.toUpperCase().includes("ENG"),
      );

      if (engPhase) {
        await prisma.masterplanPhase.update({
          where: { id: engPhase.id },
          data: {
            actualProgress: engProgress,
            status: engProgress === 100 ? "COMPLETED" : engProgress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
          },
        });
        await syncMasterplanWeeklySnapshot(project.masterplan.id);
      }
    }
  } catch (err) {
    console.error("Error syncing engineering masterplan progress:", err);
  }
}

export async function syncProcurementMasterplanProgress(projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        masterplan: {
          include: { phases: true },
        },
      },
    });

    if (!project || !project.masterplan) return;

    // Fetch all SPB items for this project using Raw SQL to include raw columns
    const rawSpbItems: any[] = await prisma.$queryRaw`
      SELECT 
        i.id, 
        i.status, 
        i.qty, 
        i."qtyIssued", 
        i."vendorSelectionStatus", 
        i."approvalEngineering", 
        i."approvalPm", 
        i."selectedSupplierId",
        i."selectedSupplierName"
      FROM spb_items i
      JOIN spbs s ON i."spbId" = s.id
      WHERE s."projectId" = ${projectId}
    `;

    let totalItemProgress = 0;
    const totalItems = rawSpbItems.length;

    if (totalItems > 0) {
      rawSpbItems.forEach((item) => {
        let score = 0;

        const isReceivedInWarehouse =
          item.status === "RECEIVED" ||
          (item.qtyIssued && parseFloat(item.qtyIssued) >= parseFloat(item.qty || "0"));

        const isPoProcessed =
          item.vendorSelectionStatus === "APPROVED" ||
          !!item.selectedSupplierId ||
          !!item.selectedSupplierName;

        const isRecommendationSubmitted =
          item.vendorSelectionStatus === "SUBMITTED" ||
          item.approvalEngineering === "APPROVED" ||
          item.approvalPm === "APPROVED";

        if (isReceivedInWarehouse) {
          score = 100; // Tahap 3: Barang/PO sudah sampai digudang
        } else if (isPoProcessed) {
          score = 66; // Tahap 2: PO diproses / vendor ditetapkan
        } else if (isRecommendationSubmitted) {
          score = 33; // Tahap 1: Pengajuan penawaran rekomendasi vendor diproses
        } else {
          score = 0;
        }

        totalItemProgress += score;
      });
    }

    const procProgress = totalItems > 0 ? Math.min(100, Math.round(totalItemProgress / totalItems)) : 0;

    const procPhase = project.masterplan.phases.find(
      (p: any) =>
        p.code === "PROCUREMENT" ||
        p.name.toUpperCase().includes("PROCURE")
    );

    if (procPhase) {
      await prisma.masterplanPhase.update({
        where: { id: procPhase.id },
        data: {
          actualProgress: procProgress,
          status:
            procProgress === 100
              ? "COMPLETED"
              : procProgress > 0
                ? "IN_PROGRESS"
                : "NOT_STARTED",
        },
      });
      await syncMasterplanWeeklySnapshot(project.masterplan.id);
    }
  } catch (err) {
    console.error("Error syncing procurement masterplan progress:", err);
  }
}

export interface MasterplanSetupInput {
  projectId: string;
  totalWeeks: number;
  startDate: Date | string;
  leaders: Array<{ divisionName: string; leaderName: string; leaderUserId?: string }>;
  phases: Array<{
    code: string;
    name: string;
    weightPercent: number;
    startWeek: number;
    endWeek: number;
    orderIndex: number;
    subSteps?: string[]; // Standard sub steps (e.g. for Shipment, Erection, Commissioning)
    weeklyTargets?: Record<number, number> | Array<{ weekNumber: number; targetPercent: number }>;
  }>;
  units: Array<{
    name: string;
    unitType: "STRUCTURE" | "MECHANICAL" | "BOTH";
    satuan: string;
    volume: number;
    structureItems?: Array<{ name: string; qty?: number; satuan?: string } | string>;
    mechanicalItems?: Array<{ name: string; qty?: number; satuan?: string } | string>;
  }>;
}

/**
 * Initializes or updates the Masterplan for a Project.
 * Automatically distributes the weekly plan progress and creates conveyor units/items.
 */
export async function setupProjectMasterplan(input: MasterplanSetupInput) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin", "PPIC"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, PPIC, Admin, atau Superadmin yang diizinkan.");
    }

    const { projectId, totalWeeks, startDate, leaders, phases, units } = input;

    // Validate Engineering prerequisites (min. 1 Drawing, 1 BoQ with items, 1 Mechanical Part List)
    const prereqCheck = await checkEngineeringPrerequisites(projectId);
    if (!prereqCheck.canCreateMasterplan) {
      throw new Error(
        `Masterplan belum dapat dibuat! Dokumen/BoQ Engineering belum lengkap. Kurang: ${prereqCheck.missingItems.join(", ")}`
      );
    }

    // Validate total weight equals 100
    const totalWeight = phases.reduce((sum, p) => sum + Number(p.weightPercent), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Total bobot tahapan harus tepat 100.00% (saat ini: ${totalWeight.toFixed(2)}%)`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete existing masterplan to overwrite clean
      const existing = await tx.masterplan.findUnique({
        where: { projectId },
      });
      if (existing) {
        await tx.masterplan.delete({
          where: { projectId },
        });
      }

      // Also clean up conveyor units for this project to start fresh
      await tx.conveyorUnit.deleteMany({
        where: { projectId },
      });

      // 2. Create new Masterplan
      const masterplan = await tx.masterplan.create({
        data: {
          projectId,
          totalWeeks,
          startDate: new Date(startDate),
          createdBy: userBy,
        },
      });

      // 3. Create Division Leaders
      for (const leader of leaders) {
        if (!leader.leaderName.trim()) continue;
        await tx.divisionLeader.create({
          data: {
            masterplanId: masterplan.id,
            divisionName: leader.divisionName.toUpperCase(),
            leaderName: leader.leaderName.trim(),
            leaderUserId: leader.leaderUserId || null,
          },
        });
      }

      // 4. Create Phases, Custom Weekly Targets & Standard Sub Steps
      const dbPhases = [];
      for (const phase of phases) {
        const createdPhase = await tx.masterplanPhase.create({
          data: {
            masterplanId: masterplan.id,
            name: phase.name,
            code: phase.code.toUpperCase(),
            weightPercent: phase.weightPercent,
            startWeek: phase.startWeek,
            endWeek: phase.endWeek,
            orderIndex: phase.orderIndex,
            status: "NOT_STARTED",
          },
        });
        dbPhases.push(createdPhase);



        // Add default/standard sub steps if provided
        if (phase.subSteps && phase.subSteps.length > 0) {
          const stepWeight = 100 / phase.subSteps.length;
          for (const stepName of phase.subSteps) {
            await tx.phaseSubStep.create({
              data: {
                phaseId: createdPhase.id,
                name: stepName,
                weightPercent: stepWeight,
                checked: false,
              },
            });
          }
        }
      }

      // 5. Generate Weekly Plan S-Curve values
      const distributed = distributeWeeklyPlanProgress(totalWeeks, phases);
      const startDateTime = new Date(startDate);
      for (const wp of distributed) {
        const weekStartDate = new Date(startDateTime);
        weekStartDate.setDate(startDateTime.getDate() + (wp.weekNumber - 1) * 7);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);

        await tx.weeklyPlan.create({
          data: {
            masterplanId: masterplan.id,
            weekNumber: wp.weekNumber,
            weekStartDate,
            weekEndDate,
            planWeeklyPercent: wp.planWeekly,
            planCumulativePercent: wp.planCumulative,
            actualWeeklyPercent: 0,
            actualCumulativePercent: 0,
            variance: -wp.planCumulative,
          },
        });
      }

      // 6. Create Conveyor Units & Items
      let unitIdx = 0;
      for (const u of units) {
        const unit = await tx.conveyorUnit.create({
          data: {
            projectId,
            name: u.name,
            unitType: u.unitType,
            satuan: u.satuan || "unit",
            volume: u.volume || 1,
            orderIndex: unitIdx++,
          },
        });

        // Initialize Phase - Unit Progress mappings (distribute equally among units per phase)
        for (const dbPhase of dbPhases) {
          await tx.unitProgress.create({
            data: {
              phaseId: dbPhase.id,
              unitId: unit.id,
              weightPercent: 100 / units.length, // equal share of phase weight
              actualPercent: 0,
            },
          });
        }

        // Initialize Structure Items if STRUCTURE/BOTH
        if (u.unitType !== "MECHANICAL" && u.structureItems) {
          let itemIdx = 0;
          for (const sItem of u.structureItems) {
            const sName = typeof sItem === "string" ? sItem.trim() : (sItem.name || "").trim();
            if (!sName) continue;
            const sQty = typeof sItem === "string" ? 1 : Number(sItem.qty) || 1;
            const sSatuan = typeof sItem === "string" ? "unit" : (sItem.satuan || "unit").trim();

            await tx.structureItem.create({
              data: {
                unitId: unit.id,
                name: sName,
                qty: sQty,
                satuan: sSatuan,
                orderIndex: itemIdx++,
              },
            });
          }
        }

        // Initialize Mechanical Items if MECHANICAL/BOTH
        if (u.unitType !== "STRUCTURE" && u.mechanicalItems) {
          let itemIdx = 0;
          for (const mItem of u.mechanicalItems) {
            const mName = typeof mItem === "string" ? mItem.trim() : (mItem.name || "").trim();
            if (!mName) continue;
            const mQty = typeof mItem === "string" ? 1 : Number(mItem.qty) || 1;
            const mSatuan = typeof mItem === "string" ? "unit" : (mItem.satuan || "unit").trim();

            await tx.mechanicalItem.create({
              data: {
                unitId: unit.id,
                name: mName,
                qty: mQty,
                satuan: mSatuan,
                orderIndex: itemIdx++,
              },
            });
          }
        }
      }

      // Update project entry statuses
      await tx.project.update({
        where: { id: projectId },
        data: {
          prodStatus: "IN_PROGRESS",
          status: "IN_PROGRESS",
        },
      });

      // Log action
      await tx.projectHistory.create({
        data: {
          projectId,
          division: "PRODUCTION",
          status: "IN_PROGRESS",
          entryDate: new Date(),
          action: "SETUP_MASTERPLAN",
          notes: `Setup Masterplan selesai oleh ${userBy}. Total minggu: ${totalWeeks}.`,
          updatedBy: userBy,
        },
      });

      return masterplan;
    });

    try {
      await syncEngineeringMasterplanProgress(projectId);
      await syncProcurementMasterplanProgress(projectId);
    } catch (err) {
      console.error("Auto sync masterplan progress error:", err);
    }

    revalidatePath(`/trackers/production`);
    revalidatePath(`/trackers/engineering`);
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error setting up project masterplan:", error);
    return { success: false, error: error.message || "Failed to setup masterplan" };
  }
}

/**
 * Gets the complete Masterplan details for a project.
 */
export async function getProjectMasterplan(projectId: string) {
  try {
    const masterplan = await prisma.masterplan.findUnique({
      where: { projectId },
      include: {
        divisionLeaders: true,
        phases: {
          orderBy: { orderIndex: "asc" },
          include: {
            subProgresses: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
        weeklyPlans: {
          orderBy: { weekNumber: "asc" },
        },
      },
    });

    if (!masterplan) {
      return { success: false, error: "Masterplan not found" };
    }

    const units = await prisma.conveyorUnit.findMany({
      where: { projectId },
      orderBy: { orderIndex: "asc" },
      include: {
        structureItems: { orderBy: { orderIndex: "asc" } },
        mechanicalItems: { orderBy: { orderIndex: "asc" } },
      },
    });

    return { success: true, data: { ...masterplan, units } };
  } catch (error: any) {
    console.error("Error fetching masterplan:", error);
    return { success: false, error: error.message };
  }
}
