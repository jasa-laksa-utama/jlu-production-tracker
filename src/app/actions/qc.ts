"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";
import { getStoragePhotoUrl } from "@/app/actions/progress-photos";
import { sanitizeErrorMessage } from "@/lib/error-handler";

/**
 * Interface untuk data pembuatan NCR baru
 */
export interface CreateNCRInput {
  projectId: string;
  unitId: string;
  itemType: "STRUCTURE" | "MECHANICAL";
  itemId: string;
  stage: string; // e.g. "WELDING", "SETTING", "CUTTING", "FINISHING", "PAINTING", "PACKAGING", "FABRICATION"
  ncrCategory: string; // "DIMENSI", "WELD_QUALITY", "MATERIAL", "ASSEMBLY", "PAINTING", "OTHER"
  ncrDescription: string;
  correctiveAction?: string;
  resetStage?: boolean; // Jika true, reset status tahap produksi terkait
  raisedBy: string;
}

/**
 * Generates an auto-incrementing NCR Number: NCR/[PROJECT_NUMBER]/[YEAR]/[SEQ]
 */
async function generateNCRNumber(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { projectNumber: true },
  });

  const prjCode = project?.projectNumber || "PRJ";
  const year = new Date().getFullYear();
  const prefix = `NCR/${prjCode}/${year}/`;

  const count = await prisma.qCRevision.count({
    where: {
      projectId,
      ncrNumber: { startsWith: prefix },
    },
  });

  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

/**
 * Fetch all units, items, checkpoints, and NCRs for a Project in QC Tracker
 */
export async function getProjectQCCheckpoints(projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectName: true,
        projectNumber: true,
      },
    });

    if (!project) {
      return { success: false, error: "Project tidak ditemukan" };
    }

    const units = await prisma.conveyorUnit.findMany({
      where: { projectId },
      orderBy: { orderIndex: "asc" },
      include: {
        structureItems: {
          orderBy: { orderIndex: "asc" },
          include: {
            subItems: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        mechanicalItems: {
          orderBy: { orderIndex: "asc" },
          include: {
            subItems: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
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
    });

    const ncrs = await prisma.qCRevision.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        unit: { select: { id: true, name: true } },
        checkpoint: true,
      },
    });

    // Ambil bukti foto & catatan tahapan produksi untuk komponen di proyek ini
    let stagePhotos: any[] = [];
    try {
      const rawStagePhotos = await prisma.progressPhoto.findMany({
        where: {
          projectId,
        },
        orderBy: { createdAt: "desc" },
      });

      stagePhotos = await Promise.all(
        rawStagePhotos.map(async (p: any) => {
          let validUrl = p.url;
          if (!validUrl.startsWith("http") || validUrl.includes("supabase.co/storage/v1/object/sign/")) {
            validUrl = await getStoragePhotoUrl(p.url);
          }
          return {
            ...p,
            url: validUrl,
          };
        })
      );
    } catch (photoErr) {
      console.warn("[getProjectQCCheckpoints] Warning loading stagePhotos:", photoErr);
      stagePhotos = [];
    }

    const data = JSON.parse(
      JSON.stringify({
        project,
        units,
        ncrs,
        stagePhotos,
      })
    );

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error("[getProjectQCCheckpoints] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil data QC checkpoints.") };
  }
}

/**
 * Fast Inspect QC Item Checkpoint (Mark PASS or PENDING)
 */
export async function inspectQCItem(input: {
  projectId: string;
  unitId: string;
  itemType: "STRUCTURE" | "MECHANICAL";
  itemId: string;
  stage: string;
  status: "PASS" | "PENDING";
  inspectedBy: string;
  notes?: string;
  unitName?: string;
  itemName?: string;
}) {
  try {
    let uName = input.unitName || "";
    let iName = input.itemName || "";

    if (!uName && input.unitId) {
      const unit = await prisma.conveyorUnit
        .findUnique({
          where: { id: input.unitId },
          select: { name: true },
        })
        .catch(() => null);
      if (unit?.name) uName = unit.name;
    }

    if (!iName && input.itemId) {
      if (input.itemType === "STRUCTURE") {
        const item = await prisma.structureItem
          .findUnique({
            where: { id: input.itemId },
            select: { name: true },
          })
          .catch(() => null);
        if (item?.name) {
          iName = item.name;
        }
      } else if (input.itemType === "MECHANICAL") {
        const item = await prisma.mechanicalItem
          .findUnique({
            where: { id: input.itemId },
            select: { name: true },
          })
          .catch(() => null);
        if (item?.name) {
          iName = item.name;
        }
      }
    }

    const checkpoint = await prisma.qCItemCheckpoint.upsert({
      where: {
        unitId_itemType_itemId_stage: {
          unitId: input.unitId,
          itemType: input.itemType,
          itemId: input.itemId,
          stage: input.stage,
        },
      },
      update: {
        status: input.status,
        inspectedBy: input.inspectedBy,
        inspectedAt: new Date(),
        notes: input.notes || null,
      },
      create: {
        projectId: input.projectId,
        unitId: input.unitId,
        itemType: input.itemType,
        itemId: input.itemId,
        stage: input.stage,
        status: input.status,
        inspectedBy: input.inspectedBy,
        inspectedAt: new Date(),
        notes: input.notes || null,
      },
    });

    const infoParts = [
      uName ? `Unit: ${uName}` : null,
      iName ? `Komponen: ${iName}` : null,
    ]
      .filter(Boolean);

    const infoString = infoParts.length > 0 ? ` (${infoParts.join(" | ")})` : "";

    // Record audit log
    await prisma.projectHistory.create({
      data: {
        projectId: input.projectId,
        division: "QUALITY_CONTROL",
        status: "IN_PROGRESS",
        action: "QC_ITEM_INSPECTED",
        notes: `QC Inspeksi [${input.itemType}] Tahap ${input.stage}${infoString}: Status ${input.status}. Catatan: ${input.notes || "-"}`,
        updatedBy: input.inspectedBy,
      },
    });

    // Record production log for Masterplan audit trail
    await prisma.productionLog.create({
      data: {
        projectId: input.projectId,
        message: `QC Inspeksi [${input.itemType}] Tahap ${input.stage} "${iName || "Komponen"}" di "${uName || "Unit"}": Status ${input.status}${input.notes ? ` - ${input.notes}` : ""}`,
        user: input.inspectedBy || "QC Inspector",
      },
    });

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/production");

    return { success: true, data: checkpoint };
  } catch (error: any) {
    console.error("[inspectQCItem] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyimpan inspeksi QC.") };
  }
}

/**
 * Raise a Non-Conformance Report (NCR) for a Production Item
 */
export async function createNCR(input: CreateNCRInput) {
  try {
    const ncrNumber = await generateNCRNumber(input.projectId);

    // 1. Create or Update QC Item Checkpoint to FAIL
    const checkpoint = await prisma.qCItemCheckpoint.upsert({
      where: {
        unitId_itemType_itemId_stage: {
          unitId: input.unitId,
          itemType: input.itemType,
          itemId: input.itemId,
          stage: input.stage,
        },
      },
      update: {
        status: "FAIL",
        inspectedBy: input.raisedBy,
        inspectedAt: new Date(),
        notes: `NCR ${ncrNumber}: ${input.ncrDescription}`,
      },
      create: {
        projectId: input.projectId,
        unitId: input.unitId,
        itemType: input.itemType,
        itemId: input.itemId,
        stage: input.stage,
        status: "FAIL",
        inspectedBy: input.raisedBy,
        inspectedAt: new Date(),
        notes: `NCR ${ncrNumber}: ${input.ncrDescription}`,
      },
    });

    // 2. Create QCRevision record
    const ncrRecord = await prisma.qCRevision.create({
      data: {
        projectId: input.projectId,
        unitId: input.unitId,
        checkpointId: checkpoint.id,
        revisionType: "NCR",
        level: "ITEM",
        ncrNumber,
        ncrCategory: input.ncrCategory,
        ncrDescription: input.ncrDescription,
        correctiveAction: input.correctiveAction || null,
        resetStage: input.stage,
        status: "OPEN",
        raisedBy: input.raisedBy,
      },
    });

    // 3. Reset Production Stage by default
    let itemName = "Item";
    if (input.itemType === "STRUCTURE") {
      const item = await prisma.structureItem.findUnique({
        where: { id: input.itemId },
        select: { name: true },
      });
      if (item?.name) itemName = item.name;
    } else if (input.itemType === "MECHANICAL") {
      const item = await prisma.mechanicalItem.findUnique({
        where: { id: input.itemId },
        select: { name: true },
      });
      if (item?.name) itemName = item.name;
    }

    await resetItemStageProgress(input.itemType, input.itemId, input.stage);

    // 4. Log Project History
    await prisma.projectHistory.create({
      data: {
        projectId: input.projectId,
        division: "QUALITY_CONTROL",
        status: "IN_PROGRESS",
        action: "NCR_RAISED",
        notes: `NCR DITERBITKAN [${ncrNumber}] Kategori: ${input.ncrCategory} | Item: ${itemName} (${input.stage}) | Temuan: ${input.ncrDescription} | Action Required: ${input.correctiveAction || "-"}`,
        updatedBy: input.raisedBy,
      },
    });

    // Log to ProductionLog for Masterplan audit trail
    await prisma.productionLog.create({
      data: {
        projectId: input.projectId,
        message: `QC menerbitkan NCR [${ncrNumber}] untuk "${itemName}" (Tahap ${input.stage}): ${input.ncrDescription}`,
        user: input.raisedBy || "QC Inspector",
      },
    });

    // 5. Send Real-Time In-App Notification to Produksi Division
    try {
      await createNotification({
        title: `🔴 NCR Diterbitkan [${ncrNumber}]`,
        message: `QC menerbitkan NCR untuk item ${itemName} (${input.stage}): ${input.ncrDescription}`,
        type: "WARNING",
        module: "TRACKER",
        targetUrl: "/trackers/production",
      });
    } catch (e) {
      console.warn("Could not send notification for NCR creation:", e);
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/production");

    return { success: true, data: JSON.parse(JSON.stringify(ncrRecord)) };
  } catch (error: any) {
    console.error("[createNCR] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menerbitkan NCR.") };
  }
}

/**
 * Production Team submits resolution/fix for an NCR
 */
export async function submitNCRResolution(input: {
  ncrId: string;
  resolvedNotes: string;
  resolvedBy: string;
}) {
  try {
    let ncr = await prisma.qCRevision.findFirst({
      where: {
        OR: [{ id: input.ncrId }, { checkpointId: input.ncrId }],
      },
    });

    if (!ncr) {
      const cp = await prisma.qCItemCheckpoint.findUnique({
        where: { id: input.ncrId },
      });
      if (cp && cp.status === "ON_HOLD") {
        return {
          success: false,
          error:
            "Revisi drawing belum diselesaikan oleh tim Engineering. Mohon tunggu tim Engineering merilis gambar kerja terbaru.",
        };
      }
    }

    if (!ncr) {
      return { success: false, error: "Laporan revisi tidak ditemukan" };
    }

    const isDR =
      ncr.revisionType === "DRAWING_REVISION" ||
      ncr.revisionType === "DR" ||
      Boolean(ncr.drNumber) ||
      Boolean(ncr.ncrNumber?.startsWith("DR/"));

    const isEngResolved =
      ncr.status === "RESOLVED_BY_ENG" ||
      ncr.status === "RESOLVED" ||
      ncr.status === "CLOSED" ||
      Boolean(ncr.revisedDocUrl) ||
      Boolean(ncr.resolvedNotes);

    if (isDR && !isEngResolved) {
      return {
        success: false,
        error:
          "Revisi drawing belum diselesaikan oleh tim Engineering. Mohon tunggu tim Engineering merilis gambar kerja terbaru.",
      };
    }

    const updatedNCR = await prisma.qCRevision.update({
      where: { id: ncr.id },
      data: {
        status: "RESOLVED",
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date(),
        resolvedNotes: input.resolvedNotes,
      },
    });

    if (ncr.checkpointId) {
      await prisma.qCItemCheckpoint.update({
        where: { id: ncr.checkpointId },
        data: {
          status: "PENDING",
          notes: `Perbaikan dilaporkan selesai oleh ${input.resolvedBy}: ${input.resolvedNotes}`,
        },
      });
    }

    await prisma.projectHistory.create({
      data: {
        projectId: ncr.projectId,
        division: "PRODUKSI",
        status: "IN_PROGRESS",
        action: "NCR_RESOLVED_BY_PRODUCTION",
        notes: `Tim Produksi (${input.resolvedBy}) melapor perbaikan NCR [${ncr.ncrNumber}] Selesai: ${input.resolvedNotes}`,
        updatedBy: input.resolvedBy,
      },
    });

    try {
      await createNotification({
        title: `🟡 Perbaikan NCR Dilaporkan [${ncr.ncrNumber}]`,
        message: `Tim Produksi (${input.resolvedBy}) melapor perbaikan NCR selesai: ${input.resolvedNotes}`,
        type: "INFO",
        module: "TRACKER",
        targetUrl: "/trackers/quality-control",
      });
    } catch (e) {
      console.warn("Could not send notification for NCR resolution:", e);
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/production");

    return { success: true, data: updatedNCR };
  } catch (error: any) {
    console.error("[submitNCRResolution] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui status perbaikan NCR.") };
  }
}

/**
 * QC Re-inspects & Closes an NCR
 */
export async function closeNCR(input: {
  ncrId: string;
  isPassed: boolean;
  closedNotes?: string;
  closedBy: string;
}) {
  try {
    const ncr = await prisma.qCRevision.findUnique({
      where: { id: input.ncrId },
      include: { checkpoint: true },
    });

    if (!ncr) {
      return { success: false, error: "NCR tidak ditemukan" };
    }

    if (input.isPassed) {
      // 1. Close NCR
      const updatedNCR = await prisma.qCRevision.update({
        where: { id: input.ncrId },
        data: {
          status: "CLOSED",
          closedBy: input.closedBy,
          closedAt: new Date(),
        },
      });

      // 2. Update Checkpoint to PASS
      if (ncr.checkpointId) {
        await prisma.qCItemCheckpoint.update({
          where: { id: ncr.checkpointId },
          data: {
            status: "PASS",
            inspectedBy: input.closedBy,
            inspectedAt: new Date(),
            notes: `NCR ${ncr.ncrNumber} RE-INSPEKSI PASS: ${input.closedNotes || "Perbaikan diterima QC"}`,
          },
        });
      }

      await prisma.projectHistory.create({
        data: {
          projectId: ncr.projectId,
          division: "QUALITY_CONTROL",
          status: "IN_PROGRESS",
          action: "NCR_CLOSED_PASS",
          notes: `QC (${input.closedBy}) melakukan re-inspeksi & MENUTUP NCR [${ncr.ncrNumber}] (Status: PASS). Catatan: ${input.closedNotes || "-"}`,
          updatedBy: input.closedBy,
        },
      });

      // Log to ProductionLog for Masterplan audit trail
      await prisma.productionLog.create({
        data: {
          projectId: ncr.projectId,
          message: `QC menutup NCR [${ncr.ncrNumber}] (Status: PASS)${input.closedNotes ? ` - ${input.closedNotes}` : ""}`,
          user: input.closedBy || "QC Inspector",
        },
      });

      try {
        await createNotification({
          title: `🟢 NCR Ditutup PASS [${ncr.ncrNumber}]`,
          message: `QC (${input.closedBy}) menyetujui perbaikan & menutup NCR ${ncr.ncrNumber}.`,
          type: "SUCCESS",
          module: "TRACKER",
          targetUrl: "/trackers/production",
        });
      } catch (e) {
        console.warn("Could not send notification for NCR close pass:", e);
      }

      revalidatePath("/trackers/quality-control");
      revalidatePath("/trackers/production");

      return { success: true, data: updatedNCR };
    } else {
      // Re-open NCR (Re-inspeksi Gagal)
      const updatedNCR = await prisma.qCRevision.update({
        where: { id: input.ncrId },
        data: {
          status: "OPEN",
          resolvedNotes: `[RE-OPEN oleh QC (${input.closedBy})]: ${input.closedNotes || "Hasil perbaikan belum memenuhi syarat"}`,
        },
      });

      await prisma.projectHistory.create({
        data: {
          projectId: ncr.projectId,
          division: "QUALITY_CONTROL",
          status: "IN_PROGRESS",
          action: "NCR_REOPENED",
          notes: `QC (${input.closedBy}) menolak hasil perbaikan NCR [${ncr.ncrNumber}] (Status: RE-OPEN). Alasan: ${input.closedNotes || "-"}`,
          updatedBy: input.closedBy,
        },
      });

      // Log to ProductionLog for Masterplan audit trail
      await prisma.productionLog.create({
        data: {
          projectId: ncr.projectId,
          message: `QC menolak perbaikan NCR [${ncr.ncrNumber}] (Status: RE-OPEN)${input.closedNotes ? ` - ${input.closedNotes}` : ""}`,
          user: input.closedBy || "QC Inspector",
        },
      });

      try {
        await createNotification({
          title: `🔴 NCR Ditolak (Re-Open) [${ncr.ncrNumber}]`,
          message: `QC (${input.closedBy}) menolak perbaikan NCR ${ncr.ncrNumber}. Alasan: ${input.closedNotes || "-"}`,
          type: "ERROR",
          module: "TRACKER",
          targetUrl: "/trackers/production",
        });
      } catch (e) {
        console.warn("Could not send notification for NCR re-open:", e);
      }

      revalidatePath("/trackers/quality-control");
      revalidatePath("/trackers/production");

      return { success: true, data: updatedNCR };
    }
  } catch (error: any) {
    console.error("[closeNCR] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memproses penutupan NCR.") };
  }
}

/**
 * Generates an auto-incrementing DR Number: DR/[PROJECT_NUMBER]/[YEAR]/[SEQ]
 */
async function generateDRNumber(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { projectNumber: true },
  });

  const prjCode = project?.projectNumber || "PRJ";
  const year = new Date().getFullYear();
  const prefix = `DR/${prjCode}/${year}/`;

  const count = await prisma.qCRevision.count({
    where: {
      projectId,
      drNumber: { startsWith: prefix },
    },
  });

  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

/**
 * Interface untuk data pengajuan Drawing Revision Request (DR)
 */
export interface CreateDRInput {
  projectId: string;
  unitId?: string;
  itemType?: "STRUCTURE" | "MECHANICAL";
  itemId?: string;
  stage?: string;
  drawingRef: string;
  fieldCondition: string;
  requestedChange: string;
  raisedBy: string;
}

/**
 * Reset production item stage progress to 0% and recalculate progressPercent
 */
export async function resetItemStageProgress(
  itemType: "STRUCTURE" | "MECHANICAL",
  itemId: string,
  stage: string
) {
  const stageLower = stage.toLowerCase().trim();

  if (itemType === "STRUCTURE") {
    const item = await prisma.structureItem.findUnique({
      where: { id: itemId },
    });
    if (item) {
      const updateData: any = {};

      if (
        stageLower === "cutting" ||
        stageLower === "cutt" ||
        stageLower === "c/d"
      ) {
        updateData.cuttingDone = false;
        updateData.cuttingQty = 0;
      } else if (stageLower === "setting" || stageLower === "sett") {
        updateData.settingDone = false;
        updateData.settingQty = 0;
      } else if (stageLower === "welding" || stageLower === "weld") {
        updateData.weldingDone = false;
        updateData.weldingQty = 0;
      } else if (stageLower === "finishing" || stageLower === "fin") {
        updateData.finishingDone = false;
        updateData.finishingQty = 0;
      } else if (stageLower === "painting" || stageLower === "paint") {
        updateData.paintingDone = false;
        updateData.paintingQty = 0;
      } else if (stageLower === "packaging" || stageLower === "pack") {
        updateData.packagingDone = false;
        updateData.packagingQty = 0;
      }

      const isCut = updateData.cuttingDone ?? item.cuttingDone;
      const isSet = updateData.settingDone ?? item.settingDone;
      const isWeld = updateData.weldingDone ?? item.weldingDone;
      const isFin = updateData.finishingDone ?? item.finishingDone;
      const isPaint = updateData.paintingDone ?? item.paintingDone;
      const isPack = updateData.packagingDone ?? item.packagingDone;

      const newProgress =
        (isCut ? 15 : 0) +
        (isSet ? 35 : 0) +
        (isWeld ? 40 : 0) +
        (isFin ? 5 : 0) +
        (isPaint ? 3.5 : 0) +
        (isPack ? 1.5 : 0);

      updateData.progressPercent = newProgress;

      await prisma.structureItem.update({
        where: { id: itemId },
        data: updateData,
      });
    }
  } else if (itemType === "MECHANICAL") {
    const item = await prisma.mechanicalItem.findUnique({
      where: { id: itemId },
    });
    if (item) {
      const updateData: any = {};

      if (stageLower === "procurement" || stageLower === "proc") {
        updateData.procurementDone = false;
        updateData.procurementQty = 0;
      } else if (stageLower === "po") {
        updateData.poDone = false;
        updateData.poQty = 0;
      } else if (stageLower === "fabrication" || stageLower === "fab") {
        updateData.fabricationDone = false;
        updateData.fabricationQty = 0;
      } else if (stageLower === "packaging" || stageLower === "pack") {
        updateData.packagingDone = false;
        updateData.packagingQty = 0;
      }

      const isProc = updateData.procurementDone ?? item.procurementDone;
      const isPo = updateData.poDone ?? item.poDone;
      const isFab = updateData.fabricationDone ?? item.fabricationDone;
      const isPack = updateData.packagingDone ?? item.packagingDone;

      const newProgress =
        (isProc ? 40 : 0) +
        (isPo ? 10 : 0) +
        (isFab ? 45 : 0) +
        (isPack ? 5 : 0);

      updateData.progressPercent = newProgress;

      await prisma.mechanicalItem.update({
        where: { id: itemId },
        data: updateData,
      });
    }
  }
}

/**
 * Create a Drawing Revision Request (DR) to Engineering
 */
export async function createDrawingRevisionRequest(input: CreateDRInput) {
  try {
    const drNumber = await generateDRNumber(input.projectId);

    let checkpointId: string | undefined = undefined;

    // 1. If linked to an item stage, set Checkpoint status to ON_HOLD & reset stage progress
    if (input.unitId && input.itemType && input.itemId && input.stage) {
      const checkpoint = await prisma.qCItemCheckpoint.upsert({
        where: {
          unitId_itemType_itemId_stage: {
            unitId: input.unitId,
            itemType: input.itemType,
            itemId: input.itemId,
            stage: input.stage,
          },
        },
        update: {
          status: "ON_HOLD",
          inspectedBy: input.raisedBy,
          inspectedAt: new Date(),
          notes: `DRAWING REVISION ${drNumber}: Item di-hold menunggu revisi drawing dari Engineering`,
        },
        create: {
          projectId: input.projectId,
          unitId: input.unitId,
          itemType: input.itemType,
          itemId: input.itemId,
          stage: input.stage,
          status: "ON_HOLD",
          inspectedBy: input.raisedBy,
          inspectedAt: new Date(),
          notes: `DRAWING REVISION ${drNumber}: Item di-hold menunggu revisi drawing dari Engineering`,
        },
      });
      checkpointId = checkpoint.id;

      // Reset stage progress automatically by default for Drawing Revision (ON_HOLD)
      await resetItemStageProgress(input.itemType, input.itemId, input.stage);
    }

    // 2. Create QCRevision record with type DRAWING_REVISION
    const drRecord = await prisma.qCRevision.create({
      data: {
        projectId: input.projectId,
        unitId: input.unitId || null,
        checkpointId: checkpointId || null,
        revisionType: "DRAWING_REVISION",
        level: input.itemId ? "ITEM" : "UNIT",
        drNumber,
        drawingRef: input.drawingRef,
        fieldCondition: input.fieldCondition,
        requestedChange: input.requestedChange,
        resetStage: input.stage || null,
        status: "SUBMITTED_TO_ENG",
        raisedBy: input.raisedBy,
      },
    });

    // 3. Log Project History for Engineering & QC
    await prisma.projectHistory.create({
      data: {
        projectId: input.projectId,
        division: "ENGINEERING",
        status: "REVISION_TO_ENG",
        action: "DRAWING_REVISION_REQUESTED",
        notes: `REQUEST REVISI DRAWING [${drNumber}] Ref: ${input.drawingRef} | Kondisi Lapangan: ${input.fieldCondition} | Usulan Perubahan: ${input.requestedChange}`,
        updatedBy: input.raisedBy,
      },
    });

    // 4. Send Notification to Engineering Division
    try {
      await createNotification({
        title: `🟡 Request Revisi Drawing [${drNumber}]`,
        message: `QC/Produksi mengajukan revisi drawing ${input.drawingRef}. Kendala: ${input.fieldCondition}`,
        type: "WARNING",
        module: "TRACKER",
        targetUrl: "/trackers/engineering",
      });
    } catch (e) {
      console.warn("Could not send notification for DR creation:", e);
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/production");

    return { success: true, data: JSON.parse(JSON.stringify(drRecord)) };
  } catch (error: any) {
    console.error("[createDrawingRevisionRequest] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengajukan request revisi drawing.") };
  }
}

/**
 * Engineering submits revised drawing URL / document
 */
export async function resolveDrawingRevisionByEngineering(input: {
  drId: string;
  revisedDocUrl?: string;
  resolvedNotes: string;
  resolvedBy: string;
}) {
  try {
    let dr = await prisma.qCRevision.findFirst({
      where: {
        OR: [{ id: input.drId }, { checkpointId: input.drId }],
      },
    });

    if (!dr) {
      // Check if input.drId is a QCItemCheckpoint
      const cp = await prisma.qCItemCheckpoint.findUnique({
        where: { id: input.drId },
      });
      if (cp) {
        const drNo =
          cp.notes?.match(/DR\/[A-Z0-9-/]+/i)?.[0] ||
          (await generateDRNumber(cp.projectId));
        dr = await prisma.qCRevision.create({
          data: {
            projectId: cp.projectId,
            unitId: cp.unitId,
            checkpointId: cp.id,
            revisionType: "DRAWING_REVISION",
            level: "ITEM",
            drNumber: drNo,
            fieldCondition: cp.notes || "Item di-hold untuk Drawing Revision",
            requestedChange: "Permintaan Revisi Drawing",
            status: "SUBMITTED_TO_ENG",
            raisedBy: cp.inspectedBy || "QC Inspector",
          },
        });
      }
    }

    if (!dr) {
      return {
        success: false,
        error: "Record Drawing Revision tidak ditemukan",
      };
    }

    const updatedDR = await prisma.qCRevision.update({
      where: { id: dr.id },
      data: {
        status: "RESOLVED_BY_ENG",
        revisedDocUrl: input.revisedDocUrl || null,
        resolvedNotes: input.resolvedNotes,
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date(),
      },
    });

    if (dr.checkpointId) {
      await prisma.qCItemCheckpoint.update({
        where: { id: dr.checkpointId },
        data: {
          notes: `DRAWING REVISED [${dr.drNumber}]: ${input.resolvedNotes}. Link: ${input.revisedDocUrl || "-"}`,
        },
      });
    }

    await prisma.projectHistory.create({
      data: {
        projectId: dr.projectId,
        division: "ENGINEERING",
        status: "IN_PROGRESS",
        action: "DRAWING_REVISED_BY_ENG",
        notes: `Tim Engineering (${input.resolvedBy}) telah menyelesaikan revisi drawing [${dr.drNumber}]. Catatan: ${input.resolvedNotes}. Link: ${input.revisedDocUrl || "-"}`,
        updatedBy: input.resolvedBy,
      },
    });

    try {
      await createNotification({
        title: `🔵 Drawing Revisi Rilis [${dr.drNumber}]`,
        message: `Tim Engineering (${input.resolvedBy}) telah mengunggah gambar revisi baru untuk ${dr.drawingRef || "Komponen"}.`,
        type: "INFO",
        module: "TRACKER",
        targetUrl: "/trackers/quality-control",
      });
    } catch (e) {
      console.warn("Could not send notification for DR resolution:", e);
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/production");

    return { success: true, data: JSON.parse(JSON.stringify(updatedDR)) };
  } catch (error: any) {
    console.error("[resolveDrawingRevisionByEngineering] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyimpan revisi drawing dari Engineering.") };
  }
}

/**
 * QC / Production verifies new drawing and unfreezes (Closes) the DR
 */
export async function closeDrawingRevision(input: {
  drId: string;
  closedNotes?: string;
  closedBy: string;
}) {
  try {
    const dr = await prisma.qCRevision.findUnique({
      where: { id: input.drId },
      include: { checkpoint: true },
    });

    if (!dr) {
      return { success: false, error: "Record Drawing Revision tidak ditemukan" };
    }

    // 1. Close DR
    const updatedDR = await prisma.qCRevision.update({
      where: { id: input.drId },
      data: {
        status: "CLOSED",
        closedBy: input.closedBy,
        closedAt: new Date(),
      },
    });

    // 2. Unfreeze Checkpoint (set status to PENDING so production can proceed)
    if (dr.checkpointId) {
      await prisma.qCItemCheckpoint.update({
        where: { id: dr.checkpointId },
        data: {
          status: "PENDING",
          inspectedBy: input.closedBy,
          inspectedAt: new Date(),
          notes: `HOLD DILEPAS (DR ${dr.drNumber} CLOSED): Gambar revisi telah diterima. Pengerjaan dilanjutkan.`,
        },
      });
    }

    await prisma.projectHistory.create({
      data: {
        projectId: dr.projectId,
        division: "QUALITY_CONTROL",
        status: "IN_PROGRESS",
        action: "DRAWING_REVISION_CLOSED",
        notes: `QC (${input.closedBy}) memverifikasi drawing baru & MENUTUP DR [${dr.drNumber}]. Item dilepas dari status Hold. Catatan: ${input.closedNotes || "-"}`,
        updatedBy: input.closedBy,
      },
    });

    try {
      await createNotification({
        title: `🟢 Hold Drawing Dilepas [${dr.drNumber}]`,
        message: `Gambar revisi baru disetujui QC. Pengerjaan produksi dapat dilanjutkan.`,
        type: "SUCCESS",
        module: "TRACKER",
        targetUrl: "/trackers/production",
      });
    } catch (e) {
      console.warn("Could not send notification for DR close:", e);
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/production");

    return { success: true, data: JSON.parse(JSON.stringify(updatedDR)) };
  } catch (error: any) {
    console.error("[closeDrawingRevision] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menutup request revisi drawing.") };
  }
}

/**
 * P2: Fetch QC Masterplan Metrics & Inspection Summary
 */
export async function getQCMasterplanSummary(projectId: string) {
  try {
    const units = await prisma.conveyorUnit.findMany({
      where: { projectId },
      include: {
        structureItems: true,
        mechanicalItems: true,
        qcCheckpoints: true,
      },
    });

    let totalCheckpoints = 0;
    let passCount = 0;
    let ncrCount = 0;
    let drCount = 0;
    let pendingCount = 0;

    units.forEach((u) => {
      // Structure items have 6 stages
      const structCheckpointCount = (u.structureItems?.length || 0) * 6;
      // Mechanical items have 4 stages
      const mechCheckpointCount = (u.mechanicalItems?.length || 0) * 4;

      const unitTotal = structCheckpointCount + mechCheckpointCount;
      totalCheckpoints += unitTotal;

      (u.qcCheckpoints || []).forEach((cp) => {
        if (cp.status === "PASS") passCount++;
        else if (cp.status === "FAIL") ncrCount++;
        else if (cp.status === "ON_HOLD") drCount++;
      });
    });

    pendingCount = Math.max(0, totalCheckpoints - passCount - ncrCount - drCount);
    const inspectedCount = passCount + ncrCount + drCount;
    const inspectionProgressPercent =
      totalCheckpoints > 0 ? Number(((passCount / totalCheckpoints) * 100).toFixed(1)) : 0;

    return {
      success: true,
      data: {
        totalCheckpoints,
        inspectedCount,
        passCount,
        ncrCount,
        drCount,
        pendingCount,
        inspectionProgressPercent,
        unitCount: units.length,
      },
    };
  } catch (error: any) {
    console.error("[getQCMasterplanSummary] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghitung ringkasan QC Masterplan.") };
  }
}

/**
 * Mengambil data terkompilasi lengkap untuk pembuatan Laporan QC Report PDF
 * Mendukung 2 level: Unit (Multiple / Single Units) dan Component (Multiple / Single Components)
 */
export async function getQCReportCompiledDataAction(
  projectId: string,
  unitIdsInput?: string[] | string,
  componentIdsInput?: string[] | string,
  componentType?: "STRUCTURE" | "MECHANICAL",
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        customer: true,
        lead: {
          select: {
            leadNumber: true,
            projectName: true,
          },
        },
      },
    });

    if (!project) {
      return { success: false, error: "Project tidak ditemukan" };
    }

    // Normalize unitIds to array
    let unitIds: string[] = [];
    if (Array.isArray(unitIdsInput)) {
      unitIds = unitIdsInput.filter((id) => id && id !== "ALL");
    } else if (unitIdsInput && unitIdsInput !== "ALL") {
      unitIds = [unitIdsInput];
    }

    // Normalize componentIds to array
    let componentIds: string[] = [];
    if (Array.isArray(componentIdsInput)) {
      componentIds = componentIdsInput.filter((id) => id && id !== "ALL");
    } else if (componentIdsInput && componentIdsInput !== "ALL") {
      componentIds = [componentIdsInput];
    }

    // Fetch ALL units for selector options in frontend
    const allUnitsRaw = await prisma.conveyorUnit.findMany({
      where: { projectId },
      orderBy: { orderIndex: "asc" },
      include: {
        structureItems: {
          orderBy: { orderIndex: "asc" },
        },
        mechanicalItems: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    // Filter units based on scope
    const unitWhere: any = { projectId };
    if (unitIds.length > 0) {
      unitWhere.id = { in: unitIds };
    }

    let units = await prisma.conveyorUnit.findMany({
      where: unitWhere,
      orderBy: { orderIndex: "asc" },
      include: {
        structureItems: {
          orderBy: { orderIndex: "asc" },
        },
        mechanicalItems: {
          orderBy: { orderIndex: "asc" },
        },
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
    });

    // If components are filtered
    let targetComponent: any = null;
    if (componentIds.length > 0) {
      units = units
        .map((u) => {
          const struct = u.structureItems.filter((i) =>
            componentIds.includes(i.id),
          );
          const mech = u.mechanicalItems.filter((i) =>
            componentIds.includes(i.id),
          );

          if (struct.length > 0 || mech.length > 0) {
            if (!targetComponent) {
              if (struct.length > 0) {
                targetComponent = {
                  ...struct[0],
                  itemType: "STRUCTURE",
                  unitName: u.name,
                };
              } else if (mech.length > 0) {
                targetComponent = {
                  ...mech[0],
                  itemType: "MECHANICAL",
                  unitName: u.name,
                };
              }
            }
            return {
              ...u,
              structureItems: struct,
              mechanicalItems: mech,
              qcCheckpoints: u.qcCheckpoints.filter((cp) =>
                componentIds.includes(cp.itemId),
              ),
            };
          }
          return null;
        })
        .filter(Boolean) as any[];
    }

    // Fetch unified documentation photos (Both QC & Production) for this project
    const photoWhere: any = {
      projectId,
    };

    if (unitIds.length > 0) {
      photoWhere.OR = [
        { unitId: { in: unitIds } },
        { unitId: null },
      ];
    }

    let rawPhotos = await (prisma as any).progressPhoto.findMany({
      where: photoWhere,
      include: {
        unit: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // If no unit-matched photos, fetch ALL photos in this project
    if (rawPhotos.length === 0) {
      rawPhotos = await (prisma as any).progressPhoto.findMany({
        where: {
          projectId,
        },
        include: {
          unit: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    }

    // Resolve active signed URLs for every photo
    const progressPhotos = await Promise.all(
      rawPhotos.map(async (p: any) => {
        let validUrl = p.url;
        if (
          !validUrl.startsWith("http") ||
          validUrl.includes("supabase.co/storage/v1/object/sign/")
        ) {
          validUrl = await getStoragePhotoUrl(p.url);
        }
        const isQC = p.category === "QC_INSPECTION";
        return {
          ...p,
          url: validUrl,
          isQC,
          source: isQC ? "QC" : "PRODUCTION",
          sourceDepartment: isQC ? "QC" : "PRODUCTION",
        };
      }),
    );

    // Fetch NCRs
    const ncrWhere: any = { projectId };
    if (unitIds.length === 1) {
      ncrWhere.unitId = unitIds[0];
    } else if (unitIds.length > 1) {
      ncrWhere.unitId = { in: unitIds };
    }
    if (componentIds.length > 0) {
      ncrWhere.checkpoint = {
        itemId: { in: componentIds },
      };
    }

    const ncrs = await prisma.qCRevision.findMany({
      where: ncrWhere,
      orderBy: { createdAt: "desc" },
      include: {
        unit: { select: { id: true, name: true } },
      },
    });

    // Generate auto default QC Report Number (Ringkas: QC-01/[PROJECT_NUMBER])
    const prjRef =
      project.projectNumber || project.id.substring(0, 8).toUpperCase();
    const autoReportNumber = `QC-01/${prjRef}`;

    return {
      success: true,
      data: JSON.parse(
        JSON.stringify({
          project,
          units,
          allUnitsList: allUnitsRaw,
          targetComponent,
          progressPhotos,
          ncrs,
          autoReportNumber,
        })
      ),
    };
  } catch (error: any) {
    console.error("[getQCReportCompiledDataAction] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil data laporan QC.") };
  }
}


