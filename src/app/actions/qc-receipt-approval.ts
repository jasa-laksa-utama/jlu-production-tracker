"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { auth } from "@/auth";
import { createNotification } from "@/app/actions/notifications";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export interface RejectItemDispositionInput {
  itemId: string;
  disposition: "USE_AS_IS" | "RETURN_TO_VENDOR";
  notes?: string;
}

export interface EngineeringApprovalInput {
  poId: string;
  notes?: string;
  dispositions?: RejectItemDispositionInput[];
}

/**
 * Mengajukan hasil inspeksi QC Penerimaan Barang PO ke Approval Engineering & PM
 */
export async function submitQCReceiptForApproval(
  poId: string,
  qcNotes?: string
) {
  try {
    await requireRole(["Superadmin", "Admin", "Quality Control", "QC", "PM"]);
    const session = await auth();
    const inspectorName = session?.user?.name || "QC Inspector";

    if (!poId) {
      return { success: false, error: "ID Purchase Order tidak valid" };
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!existingPO) {
      return { success: false, error: "Data Purchase Order tidak ditemukan" };
    }

    const reportNo =
      existingPO.qcReportNumber ||
      `QCR-${existingPO.nomorPO.replace(/[^a-zA-Z0-9-]/g, "")}`;

    const now = new Date();

    const hasRejectedItems = (existingPO.items || []).some(
      (it: any) => (Number(it.qtyFailed) || 0) > 0
    );

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        qcStatus: "PENDING_APPROVAL",
        qcReportNumber: reportNo,
        qcApprovedBy: inspectorName,
        qcApprovedAt: now,
        qcNotes: qcNotes !== undefined ? qcNotes : existingPO.qcNotes,
        qcApprovedByEngineering: false,
        qcApprovedByEngineeringAt: null,
        qcApprovedByEngineeringName: null,
        qcApprovedByPm: false,
        qcApprovedByPmAt: null,
        qcApprovedByPmName: null,
      },
    });

    // Send Notification: Hanya ke Engineering jika ada barang reject, atau Hanya ke PM jika semua lolos
    if (hasRejectedItems) {
      await createNotification({
        title: `Disposisi QC Barang Reject: ${existingPO.nomorPO}`,
        message: `Inspector ${inspectorName} melaporkan barang reject pada PO ${existingPO.nomorPO}. Memerlukan disposisi teknis Engineering.`,
        type: "ALERT",
        module: "QC",
        targetUrl: "/trackers/spb-approval-engineering",
      });
    } else {
      await createNotification({
        title: `Approval QC Penerimaan Barang: ${existingPO.nomorPO}`,
        message: `Inspector ${inspectorName} telah menyelesaikan inspeksi QC PO ${existingPO.nomorPO} (Semua barang lolos). Menunggu persetujuan PM.`,
        type: "INFO",
        module: "QC",
        targetUrl: "/trackers/spb-approval-pm",
      });
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/spb-approval-engineering");
    revalidatePath("/trackers/spb-approval-pm");

    return {
      success: true,
      message: hasRejectedItems
        ? `Laporan QC (${reportNo}) memiliki barang reject dan diajukan ke Engineering untuk disposisi.`
        : `Laporan QC (${reportNo}) seluruh barang lolos dan diajukan ke PM untuk persetujuan.`,
      data: JSON.parse(JSON.stringify(updatedPO)),
    };
  } catch (error: any) {
    console.error("Error submitQCReceiptForApproval:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengajukan approval QC."),
    };
  }
}

/**
 * Mengambil daftar PO QC yang menunggu disposisi Engineering (Hanya PO dengan barang reject)
 */
export async function getPendingQCReceiptsForEngineering() {
  try {
    await requireAuth();

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        qcStatus: "PENDING_APPROVAL",
        qcApprovedByEngineering: false,
        items: {
          some: {
            qtyFailed: { gt: 0 },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: true,
        supplier: true,
      },
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(purchaseOrders)),
    };
  } catch (error: any) {
    console.error("Error getPendingQCReceiptsForEngineering:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data approval QC Engineering."),
      data: [],
    };
  }
}

/**
 * Persetujuan & Disposisi Barang Reject oleh Engineering
 */
export async function approveQCReceiptByEngineering(
  input: EngineeringApprovalInput
) {
  try {
    await requireRole([
      "Superadmin",
      "Admin",
      "Engineering",
      "PPIC (Head)",
      "PPIC Head",
      "PM",
      "Project Manager",
    ]);
    const session = await auth();
    const engineerName = session?.user?.name || "Engineering";

    if (!input.poId) {
      return { success: false, error: "ID Purchase Order tidak valid" };
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: input.poId },
      include: { items: true },
    });

    if (!existingPO) {
      return { success: false, error: "Data Purchase Order tidak ditemukan" };
    }

    const now = new Date();

    // 1. Simpan disposisi barang reject jika ada
    if (input.dispositions && input.dispositions.length > 0) {
      for (const disp of input.dispositions) {
        await prisma.purchaseOrderItem.update({
          where: { id: disp.itemId },
          data: {
            qcDisposition: disp.disposition,
            qcDispositionNotes: disp.notes?.trim() || null,
            qcDispositionBy: engineerName,
            qcDispositionAt: now,
          },
        });
      }
    }

    // 2. Ambil PO terbaru untuk kalkulasi status akhir berdasarkan disposisi
    const poAfterDisp = await prisma.purchaseOrder.findUnique({
      where: { id: input.poId },
      include: { items: true },
    });

    let allScrapped = true;
    for (const item of poAfterDisp?.items || []) {
      const qtyTotal = Number(item.qty) || 0;
      const qtyFailed = Number(item.qtyFailed) || 0;
      const isReturn = item.qcDisposition === "RETURN_TO_VENDOR";

      if (qtyFailed === qtyTotal && isReturn) {
        // fully scrapped / returned
      } else {
        allScrapped = false;
      }
    }

    const finalGlobalStatus = allScrapped ? "REJECTED" : "APPROVED";

    // 3. Update status approval Engineering pada Purchase Order Header (Penyelesaian Disposisi Final)
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: input.poId },
      data: {
        qcStatus: finalGlobalStatus,
        qcApprovedByEngineering: true,
        qcApprovedByEngineeringAt: now,
        qcApprovedByEngineeringName: engineerName,
        qcEngineeringNotes: input.notes?.trim() || null,
        qcApprovedAt: now,
      },
    });

    // Auto-sync masterplan procurement progress
    try {
      const spbNumbers = (existingPO.items || [])
        .map((i: any) => i.noSpb)
        .filter(Boolean);
      if (spbNumbers.length > 0) {
        const matchingSpbs = await prisma.sPB.findMany({
          where: { spbNumber: { in: spbNumbers } },
          select: { projectId: true },
        });
        const projectIds = Array.from(
          new Set(matchingSpbs.map((s) => s.projectId).filter(Boolean))
        );
        if (projectIds.length > 0) {
          const { syncProcurementMasterplanProgress } = await import(
            "@/app/actions/masterplan"
          );
          for (const pId of projectIds) {
            await syncProcurementMasterplanProgress(pId);
          }
        }
      }
    } catch (e) {
      console.error(
        "Error auto-syncing masterplan procurement in approveQCReceiptByEngineering:",
        e
      );
    }

    // Send Notification to QC and Gudang
    await createNotification({
      title: `Disposisi QC Selesai oleh Engineering: ${existingPO.nomorPO} (${finalGlobalStatus})`,
      message: `Engineering (${engineerName}) telah menyelesaikan disposisi teknis untuk ${existingPO.nomorPO} dengan status final: ${finalGlobalStatus}.`,
      type: "SUCCESS",
      module: "QC",
      targetUrl: "/trackers/quality-control",
    });

    revalidatePath("/trackers/spb-approval-engineering");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Persetujuan & Disposisi teknis Engineering untuk ${existingPO.nomorPO} berhasil disimpan (Status Final: ${finalGlobalStatus}).`,
      data: JSON.parse(JSON.stringify(updatedPO)),
    };
  } catch (error: any) {
    console.error("Error approveQCReceiptByEngineering:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyimpan persetujuan Engineering."),
    };
  }
}

/**
 * Menolak pengajuan QC oleh Engineering (minta revisi inspeksi)
 */
export async function rejectQCReceiptByEngineering(
  poId: string,
  reason: string
) {
  try {
    await requireRole([
      "Superadmin",
      "Admin",
      "Engineering",
      "PPIC (Head)",
      "PPIC Head",
      "PM",
      "Project Manager",
    ]);
    const session = await auth();
    const engineerName = session?.user?.name || "Engineering";

    if (!poId || !reason?.trim()) {
      return { success: false, error: "Alasan penolakan wajib diisi" };
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      return { success: false, error: "Data Purchase Order tidak ditemukan" };
    }

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        qcStatus: "PENDING_INSPECTION",
        qcEngineeringNotes: `Ditolak oleh Engineering (${engineerName}): ${reason.trim()}`,
      },
    });

    await createNotification({
      title: `Pengajuan QC Ditolak Engineering: ${existingPO.nomorPO}`,
      message: `Engineering (${engineerName}) mengembalikan pengajuan QC PO ${existingPO.nomorPO}. Alasan: ${reason.trim()}`,
      type: "ALERT",
      module: "QC",
      targetUrl: "/trackers/quality-control",
    });

    revalidatePath("/trackers/spb-approval-engineering");
    revalidatePath("/trackers/quality-control");

    return {
      success: true,
      message: `Pengajuan QC ${existingPO.nomorPO} telah dikembalikan ke tim QC.`,
    };
  } catch (error: any) {
    console.error("Error rejectQCReceiptByEngineering:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menolak pengajuan QC."),
    };
  }
}

/**
 * Mengambil daftar PO QC yang siap untuk persetujuan PM (Hanya PO yang seluruh barangnya lolos inspeksi)
 */
export async function getPendingQCReceiptsForPM() {
  try {
    await requireAuth();

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        qcStatus: "PENDING_APPROVAL",
        qcApprovedByPm: false,
        items: {
          none: {
            qtyFailed: { gt: 0 },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: true,
        supplier: true,
      },
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(purchaseOrders)),
    };
  } catch (error: any) {
    console.error("Error getPendingQCReceiptsForPM:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data approval QC PM."),
      data: [],
    };
  }
}

/**
 * Persetujuan Final oleh Project Manager (PM) dengan Digital Signature
 */
export async function approveQCReceiptByPM(poId: string, notes?: string) {
  try {
    await requireRole(["Superadmin", "Admin", "Project Manager", "PM"]);
    const session = await auth();
    const pmName = session?.user?.name || "Project Manager";

    if (!poId) {
      return { success: false, error: "ID Purchase Order tidak valid" };
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!existingPO) {
      return { success: false, error: "Data Purchase Order tidak ditemukan" };
    }

    const now = new Date();

    // Hitung status global final berdasarkan hasil QC & Disposisi Engineering
    let allUsable = true;
    let allScrapped = true;
    let hasAnyChecked = false;

    for (const item of existingPO.items) {
      const qtyTotal = Number(item.qty) || 0;
      const qtyPassed = Number(item.qtyPassed) || 0;
      const qtyFailed = Number(item.qtyFailed) || 0;
      const isUseAsIs = item.qcDisposition === "USE_AS_IS";
      const isReturn = item.qcDisposition === "RETURN_TO_VENDOR";

      if (qtyPassed > 0 || qtyFailed > 0) {
        hasAnyChecked = true;
      }

      // Barang usable jika PASSED atau (FAILED tapi di-keep USE_AS_IS oleh Engineering)
      if (qtyPassed === qtyTotal || (qtyFailed === qtyTotal && isUseAsIs)) {
        // all good
      } else {
        allUsable = false;
      }

      if (qtyFailed === qtyTotal && isReturn) {
        // fully scrapped/returned
      } else {
        allScrapped = false;
      }
    }

    let finalGlobalStatus = "APPROVED";
    if (allScrapped) {
      finalGlobalStatus = "REJECTED";
    } else {
      finalGlobalStatus = "APPROVED";
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        qcStatus: finalGlobalStatus,
        qcApprovedByPm: true,
        qcApprovedByPmAt: now,
        qcApprovedByPmName: pmName,
        qcPmNotes: notes?.trim() || null,
        qcApprovedAt: now,
      },
    });

    // Auto-sync masterplan procurement progress
    try {
      const spbNumbers = existingPO.items
        .map((i: any) => i.noSpb)
        .filter(Boolean);
      if (spbNumbers.length > 0) {
        const matchingSpbs = await prisma.sPB.findMany({
          where: { spbNumber: { in: spbNumbers } },
          select: { projectId: true },
        });
        const projectIds = Array.from(
          new Set(matchingSpbs.map((s) => s.projectId).filter(Boolean))
        );
        if (projectIds.length > 0) {
          const { syncProcurementMasterplanProgress } = await import(
            "@/app/actions/masterplan"
          );
          for (const pId of projectIds) {
            await syncProcurementMasterplanProgress(pId);
          }
        }
      }
    } catch (e) {
      console.error(
        "Error auto-syncing masterplan procurement in approveQCReceiptByPM:",
        e
      );
    }

    // Send Notification to QC, Gudang, and Purchasing
    await createNotification({
      title: `Persetujuan Final QC PO Selesai: ${existingPO.nomorPO} (${finalGlobalStatus})`,
      message: `Project Manager (${pmName}) telah menyetujui Laporan QC ${existingPO.nomorPO} dengan status final: ${finalGlobalStatus}. Dokumen Berita Acara QC telah bertandatangan lengkap.`,
      type: "SUCCESS",
      module: "QC",
      targetUrl: "/trackers/quality-control",
    });

    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-engineering");
    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Laporan QC ${existingPO.nomorPO} berhasil disetujui (Status Final: ${finalGlobalStatus}).`,
      data: JSON.parse(JSON.stringify(updatedPO)),
    };
  } catch (error: any) {
    console.error("Error approveQCReceiptByPM:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyetujui laporan QC."),
    };
  }
}

/**
 * Menolak laporan QC oleh Project Manager
 */
export async function rejectQCReceiptByPM(poId: string, reason: string) {
  try {
    await requireRole(["Superadmin", "Admin", "Project Manager", "PM"]);
    const session = await auth();
    const pmName = session?.user?.name || "Project Manager";

    if (!poId || !reason?.trim()) {
      return { success: false, error: "Alasan penolakan wajib diisi" };
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      return { success: false, error: "Data Purchase Order tidak ditemukan" };
    }

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        qcStatus: "PENDING_INSPECTION",
        qcApprovedByPm: false,
        qcPmNotes: `Ditolak oleh PM (${pmName}): ${reason.trim()}`,
      },
    });

    await createNotification({
      title: `Pengajuan QC Ditolak PM: ${existingPO.nomorPO}`,
      message: `PM (${pmName}) mengembalikan pengajuan QC PO ${existingPO.nomorPO} ke tim QC. Alasan: ${reason.trim()}`,
      type: "ALERT",
      module: "QC",
      targetUrl: "/trackers/quality-control",
    });

    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-engineering");
    revalidatePath("/trackers/quality-control");

    return {
      success: true,
      message: `Pengajuan QC ${existingPO.nomorPO} telah dikembalikan ke tim QC.`,
    };
  } catch (error: any) {
    console.error("Error rejectQCReceiptByPM:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menolak persetujuan QC."),
    };
  }
}
