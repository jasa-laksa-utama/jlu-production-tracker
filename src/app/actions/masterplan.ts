"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { auth } from "@/auth";
import { DEFAULT_CONVEYOR_PHASES } from "@/lib/progress-weights";
import { distributeWeeklyPlanProgress } from "@/lib/s-curve-calculator";

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
  }>;
  units: Array<{
    name: string;
    unitType: "STRUCTURE" | "MECHANICAL" | "BOTH";
    satuan: string;
    volume: number;
    structureItems?: string[];
    mechanicalItems?: string[];
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

      // 4. Create Phases & Standard Sub Steps
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
          for (const sName of u.structureItems) {
            if (!sName.trim()) continue;
            await tx.structureItem.create({
              data: {
                unitId: unit.id,
                name: sName.trim(),
                qty: 1,
                orderIndex: itemIdx++,
              },
            });
          }
        }

        // Initialize Mechanical Items if MECHANICAL/BOTH
        if (u.unitType !== "STRUCTURE" && u.mechanicalItems) {
          let itemIdx = 0;
          for (const mName of u.mechanicalItems) {
            if (!mName.trim()) continue;
            await tx.mechanicalItem.create({
              data: {
                unitId: unit.id,
                name: mName.trim(),
                qty: 1,
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

    revalidatePath(`/trackers/production`);
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
