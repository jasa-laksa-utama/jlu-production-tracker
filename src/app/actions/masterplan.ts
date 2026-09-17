"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";
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
            conveyorUnits: {
              include: {
                structureItems: true,
                mechanicalItems: true,
              },
            },
            shipmentPackages: {
              include: {
                project_components: true,
              },
            },
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
        i."approvalPpic",
        i."approvalPm", 
        i."approvalDireksi",
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

        const isFullyReceived =
          item.status === "RECEIVED" ||
          item.status === "COMPLETED" ||
          (item.qtyIssued && parseFloat(item.qtyIssued) >= parseFloat(item.qty || "0"));

        const isQcPassed =
          item.status === "QC_PASSED" ||
          item.qcStatus === "PASSED" ||
          item.qcStatus === "APPROVED";

        const isArrivedInWarehouse =
          item.status === "IN_QC" ||
          item.status === "DELIVERED" ||
          item.qcStatus === "PENDING_INSPECTION" ||
          item.qcStatus === "PARTIAL";

        const isPoOrderedOrProcessing =
          item.status === "PO_PROCESSING" ||
          item.status === "ORDERED" ||
          item.status === "IN_TRANSIT" ||
          item.status === "SHIPPED";

        const isPoCreatedOrVendorFinal =
          item.status === "PO_PENDING" ||
          item.vendorSelectionStatus === "APPROVED" ||
          item.approvalDireksi === "APPROVED";

        const isPmApproved =
          item.approvalPm === "APPROVED";

        const isPpicApproved =
          item.approvalPpic === "APPROVED";

        const isRecommendationSubmitted =
          item.vendorSelectionStatus === "SUBMITTED" ||
          item.vendorSelectionStatus === "PENDING_PPIC" ||
          item.approvalEngineering === "APPROVED" ||
          !!item.selectedSupplierName ||
          !!item.selectedSupplierId;

        if (isFullyReceived) {
          score = 100; // Pilar 3.3: Barang fisik diterima penuh di gudang & diproses inventory (100%)
        } else if (isQcPassed) {
          score = 90;  // Pilar 3.2: Barang tiba & telah lolos inspeksi QC (90%)
        } else if (isArrivedInWarehouse) {
          score = 75;  // Pilar 3.1: Barang telah tiba secara fisik & masuk antrean/proses QC (75%)
        } else if (isPoOrderedOrProcessing) {
          score = 60;  // Pilar 2.2: PO telah diproses / dipesan ke vendor (60%)
        } else if (isPoCreatedOrVendorFinal) {
          // PO terbit (45%) atau vendor disetujui Direksi (30%)
          score = item.status === "PO_PENDING" ? 45 : 30;
        } else if (isPmApproved) {
          score = 24;  // Pilar 1.3: Rekomendasi vendor disetujui PM (24%)
        } else if (isPpicApproved) {
          score = 18;  // Pilar 1.2: Rekomendasi vendor disetujui PPIC (18%)
        } else if (isRecommendationSubmitted) {
          score = 10;  // Pilar 1.1: Pengajuan rekomendasi vendor diajukan (10%)
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
    weightPercent?: number;
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

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Bersihkan data lama secara terstruktur untuk mencegah lock contention
        const existing = await tx.masterplan.findUnique({
          where: { projectId },
          select: { id: true },
        });
        if (existing) {
          await tx.masterplan.delete({
            where: { projectId },
          });
        }

        const existingUnits = await tx.conveyorUnit.findMany({
          where: { projectId },
          select: { id: true },
        });
        const unitIds = existingUnits.map((u) => u.id);
        if (unitIds.length > 0) {
          await tx.structureSubItem.deleteMany({
            where: { structureItem: { unitId: { in: unitIds } } },
          });
          await tx.mechanicalSubItem.deleteMany({
            where: { mechanicalItem: { unitId: { in: unitIds } } },
          });
          await tx.structureItem.deleteMany({
            where: { unitId: { in: unitIds } },
          });
          await tx.mechanicalItem.deleteMany({
            where: { unitId: { in: unitIds } },
          });
          await tx.unitProgress.deleteMany({
            where: { unitId: { in: unitIds } },
          });
          await tx.conveyorUnit.deleteMany({
            where: { projectId },
          });
        }

        // 2. Create new Masterplan
        const masterplan = await tx.masterplan.create({
          data: {
            projectId,
            totalWeeks,
            startDate: new Date(startDate),
            createdBy: userBy,
          },
        });

        // 3. Create Division Leaders (Batch insert)
        const leaderData = leaders
          .filter((l) => l.leaderName && l.leaderName.trim())
          .map((leader) => ({
            masterplanId: masterplan.id,
            divisionName: leader.divisionName.toUpperCase(),
            leaderName: leader.leaderName.trim(),
            leaderUserId: leader.leaderUserId || null,
          }));
        if (leaderData.length > 0) {
          await tx.divisionLeader.createMany({
            data: leaderData,
          });
        }

        // 4. Create Phases & Standard Sub Steps
        const dbPhases = [];
        const allSubStepsData = [];
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

          if (phase.subSteps && phase.subSteps.length > 0) {
            const stepWeight = 100 / phase.subSteps.length;
            for (const stepName of phase.subSteps) {
              allSubStepsData.push({
                phaseId: createdPhase.id,
                name: stepName,
                weightPercent: stepWeight,
                checked: false,
              });
            }
          }
        }
        if (allSubStepsData.length > 0) {
          await tx.phaseSubStep.createMany({
            data: allSubStepsData,
          });
        }

        // 5. Generate Weekly Plan S-Curve values (Batch insert)
        const distributed = distributeWeeklyPlanProgress(totalWeeks, phases);
        const startDateTime = new Date(startDate);
        const weeklyPlansData = distributed.map((wp) => {
          const weekStartDate = new Date(startDateTime);
          weekStartDate.setDate(
            startDateTime.getDate() + (wp.weekNumber - 1) * 7,
          );
          const weekEndDate = new Date(weekStartDate);
          weekEndDate.setDate(weekStartDate.getDate() + 6);
          return {
            masterplanId: masterplan.id,
            weekNumber: wp.weekNumber,
            weekStartDate,
            weekEndDate,
            planWeeklyPercent: wp.planWeekly,
            planCumulativePercent: wp.planCumulative,
            actualWeeklyPercent: 0,
            actualCumulativePercent: 0,
            variance: -wp.planCumulative,
          };
        });
        if (weeklyPlansData.length > 0) {
          await tx.weeklyPlan.createMany({
            data: weeklyPlansData,
          });
        }

        // 6. Create Conveyor Units & Items (Batch insert)
        const allUnitProgressData: any[] = [];
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

          const unitWeight =
            u.weightPercent !== undefined &&
            u.weightPercent !== null &&
            Number(u.weightPercent) > 0
              ? Number(u.weightPercent)
              : 100 / Math.max(1, units.length);

          for (const dbPhase of dbPhases) {
            allUnitProgressData.push({
              phaseId: dbPhase.id,
              unitId: unit.id,
              weightPercent: unitWeight,
              actualPercent: 0,
            });
          }

          // Structure Items batch
          if (u.unitType !== "MECHANICAL" && u.structureItems) {
            let itemIdx = 0;
            const strItemsData = [];
            for (const sItem of u.structureItems) {
              const sName =
                typeof sItem === "string"
                  ? sItem.trim()
                  : (sItem.name || "").trim();
              if (!sName) continue;
              const sQty =
                typeof sItem === "string" ? 1 : Number(sItem.qty) || 1;
              const sSatuan =
                typeof sItem === "string"
                  ? "unit"
                  : (sItem.satuan || "unit").trim();
              strItemsData.push({
                unitId: unit.id,
                name: sName,
                qty: sQty,
                satuan: sSatuan,
                orderIndex: itemIdx++,
              });
            }
            if (strItemsData.length > 0) {
              await tx.structureItem.createMany({
                data: strItemsData,
              });
            }
          }

          // Mechanical Items batch
          if (u.unitType !== "STRUCTURE" && u.mechanicalItems) {
            let itemIdx = 0;
            const mechItemsData = [];
            for (const mItem of u.mechanicalItems) {
              const mName =
                typeof mItem === "string"
                  ? mItem.trim()
                  : (mItem.name || "").trim();
              if (!mName) continue;
              const mQty =
                typeof mItem === "string" ? 1 : Number(mItem.qty) || 1;
              const mSatuan =
                typeof mItem === "string"
                  ? "unit"
                  : (mItem.satuan || "unit").trim();
              mechItemsData.push({
                unitId: unit.id,
                name: mName,
                qty: mQty,
                satuan: mSatuan,
                orderIndex: itemIdx++,
              });
            }
            if (mechItemsData.length > 0) {
              await tx.mechanicalItem.createMany({
                data: mechItemsData,
              });
            }
          }
        }

        if (allUnitProgressData.length > 0) {
          await tx.unitProgress.createMany({
            data: allUnitProgressData,
          });
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
      },
      {
        maxWait: 15000,
        timeout: 30000,
      },
    );

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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menginisialisasi masterplan proyek.") };
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
            weeklyProgresses: {
              orderBy: { weekNumber: "asc" },
            },
          } as any,
        },
        weeklyPlans: {
          orderBy: { weekNumber: "asc" },
        },
      },
    });

    if (!masterplan) {
      return { success: false, error: "Masterplan proyek tidak ditemukan." };
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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memuat data masterplan.") };
  }
}

export interface MasterplanWeeklyLogItem {
  id: string;
  timestamp: string;
  rawDate: Date;
  user: string;
  source: "PRODUCTION" | "QC";
  category: "FABRICATION_STRUCTURE" | "FABRICATION_MECHANICAL" | "QC" | "PROCUREMENT" | "SHIPMENT" | "GENERAL";
  categoryLabel: string;
  title: string;
  itemName?: string;
  unitName?: string;
  progressPercent?: number;
  message: string;
}

/**
 * Fetches all detailed production logs, QC activities, and updates within a specific week date range.
 */
export async function getMasterplanWeeklyLogs(
  projectId: string,
  startDateStr: string,
  endDateStr: string,
) {
  try {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    // 1. Fetch production logs within the date range
    const rawProdLogs = await prisma.productionLog.findMany({
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch QC logs within the date range
    const rawQcLogs = await prisma.qCLog.findMany({
      where: {
        projectId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: { stage: true },
      orderBy: { createdAt: "desc" },
    });

    const items: MasterplanWeeklyLogItem[] = [];

    // Parse production logs
    for (const log of rawProdLogs) {
      const msg = log.message || "";
      const lower = msg.toLowerCase();

      const isQCLog =
        lower.includes("qc") ||
        lower.includes("ncr") ||
        lower.includes("inspeksi") ||
        lower.includes("re-inspeksi");

      const source: "PRODUCTION" | "QC" = isQCLog ? "QC" : "PRODUCTION";

      let category: MasterplanWeeklyLogItem["category"] = "GENERAL";
      let categoryLabel = "Umum";

      if (isQCLog) {
        category = "QC";
        categoryLabel = "Quality Control";
      } else if (lower.includes("structure") || lower.includes("struktur")) {
        category = "FABRICATION_STRUCTURE";
        categoryLabel = "Fabrikasi Struktur";
      } else if (lower.includes("mechanical") || lower.includes("mekanikal")) {
        category = "FABRICATION_MECHANICAL";
        categoryLabel = "Fabrikasi Mekanikal";
      } else if (lower.includes("spb") || lower.includes("procure") || lower.includes("material")) {
        category = "PROCUREMENT";
        categoryLabel = "Pengadaan";
      } else if (lower.includes("shipment") || lower.includes("pengiriman") || lower.includes("paket")) {
        category = "SHIPMENT";
        categoryLabel = "Pengiriman";
      }

      // Extract item name & unit name if available in quotes
      // e.g. Update progress item Structure "Rangka Atas" di "BC-01" menjadi 40.0%
      const quotesMatches = msg.match(/"([^"]+)"/g);
      let itemName: string | undefined;
      let unitName: string | undefined;

      if (quotesMatches && quotesMatches.length >= 2) {
        itemName = quotesMatches[0].replace(/"/g, "");
        unitName = quotesMatches[1].replace(/"/g, "");
      } else if (quotesMatches && quotesMatches.length === 1) {
        itemName = quotesMatches[0].replace(/"/g, "");
      }

      // Extract percentage if available
      const percentMatch = msg.match(/menjadi\s+([\d.]+)\%/i);
      const progressPercent = percentMatch ? Number(percentMatch[1]) : undefined;

      let title = "Aktivitas Produksi";
      if (itemName && unitName) {
        title = `${itemName} (${unitName})`;
      } else if (itemName) {
        title = itemName;
      } else if (categoryLabel !== "Umum") {
        title = categoryLabel;
      }

      items.push({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        rawDate: log.createdAt,
        user: log.user || "Operator",
        source,
        category,
        categoryLabel,
        title,
        itemName,
        unitName,
        progressPercent,
        message: msg,
      });
    }

    // Parse QC logs
    for (const qc of rawQcLogs) {
      items.push({
        id: qc.id,
        timestamp: qc.createdAt.toISOString(),
        rawDate: qc.createdAt,
        user: qc.user || "QC Inspector",
        source: "QC",
        category: "QC",
        categoryLabel: "Quality Control",
        title: `Inspeksi ${qc.stage?.name || "Tahapan"}`,
        message: `Status: ${qc.status}${qc.notes ? ` - Catatan: ${qc.notes}` : ""}`,
      });
    }

    // Sort all events by createdAt descending (most recent first)
    items.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

    return {
      success: true,
      data: items,
    };
  } catch (error: any) {
    console.error("Error fetching weekly masterplan logs:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil log aktivitas masterplan.") };
  }
}
