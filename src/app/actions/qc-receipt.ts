"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { auth } from "@/auth";
import { createNotification } from "@/app/actions/notifications";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureBucketExists } from "@/lib/supabase/setup";

export interface ItemQCInput {
  itemId: string;
  status: "PASSED" | "FAILED";
  qtyPassed: number;
  qtyFailed: number;
  qcNotes?: string | null;
  qcDefectReason?: string | null;
  qcAttachments?: string[] | null;
}

export interface SingleItemQCInput {
  poId: string;
  itemId: string;
  qtyPassed: number;
  qtyFailed: number;
  qcNotes?: string | null;
  qcDefectReason?: string | null;
  qcAttachments?: string[] | null;
}

export interface POQCSubmitInput {
  poId: string;
  items: ItemQCInput[];
}

/**
 * Fetches all Purchase Orders for QC inspection from `PurchaseOrder` and `PurchaseOrderItem`.
 * Matches PANDUAN_INTEGRASI_QC_PENERIMAAN_PO.md Section 2.
 */
export async function getPOReceiptsForQC(statusFilter: string = "ALL") {
  try {
    await requireAuth();

    const where: any = {};
    if (statusFilter && statusFilter !== "ALL") {
      if (statusFilter === "PENDING" || statusFilter === "PENDING_INSPECTION") {
        where.qcStatus = "PENDING_INSPECTION";
      } else {
        where.qcStatus = statusFilter;
      }
    } else {
      // Hanya mengambil PO yang diajukan ke QC (PENDING_INSPECTION, APPROVED, REJECTED, PARTIAL)
      where.qcStatus = { in: ["PENDING_INSPECTION", "APPROVED", "REJECTED", "PARTIAL"] };
    }

    const purchaseOrders = await (prisma.purchaseOrder as any).findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: true,
      },
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(purchaseOrders)),
    };
  } catch (error: any) {
    console.error("Error getPOReceiptsForQC:", error);
    return {
      success: false,
      error: error?.message || "Gagal mengambil data pengajuan QC PO",
      data: [],
    };
  }
}

/**
 * Submits QC inspection result per-item for a Purchase Order.
 * Updates PurchaseOrderItem per item (qcStatus, qtyPassed, qtyFailed, qcNotes, qcDefectReason, qcApprovedAt, qcApprovedBy).
 * Computes aggregated PurchaseOrder.qcStatus ("APPROVED", "REJECTED", or "PARTIAL") and updates header.
 */
export async function submitPOReceiptQCValidation(input: POQCSubmitInput) {
  try {
    await requireRole(["Superadmin", "Admin", "Quality Control", "QC", "PM"]);
    const session = await auth();
    const inspectorName = session?.user?.name || "QC Inspector";

    if (!input.poId || !input.items || !Array.isArray(input.items) || input.items.length === 0) {
      return { success: false, error: "Data pengujian per-item PO tidak valid" };
    }

    const existingPO = await (prisma.purchaseOrder as any).findUnique({
      where: { id: input.poId },
      include: { items: true },
    });

    if (!existingPO) {
      return { success: false, error: "Data Purchase Order tidak ditemukan" };
    }

    const now = new Date();

    // 1. Update setiap item pada database
    await prisma.$transaction(async (tx) => {
      for (const itemInput of input.items) {
        await (tx.purchaseOrderItem as any).update({
          where: { id: itemInput.itemId },
          data: {
            qcStatus: itemInput.status,
            qtyPassed: Number(itemInput.qtyPassed) || 0,
            qtyFailed: Number(itemInput.qtyFailed) || 0,
            qcNotes: itemInput.qcNotes?.trim() || null,
            qcDefectReason: itemInput.qcDefectReason?.trim() || null,
            qcAttachments: itemInput.qcAttachments || [],
            qcApprovedAt: now,
            qcApprovedBy: inspectorName,
          },
        });
      }
    });

    // 2. Fetch seluruh item PO untuk menghitung status agregat global secara presisi
    const allItems = await (prisma.purchaseOrderItem as any).findMany({
      where: { purchaseOrderId: input.poId },
    });

    let allPassed = true;
    let allFailed = true;
    let hasAnyChecked = false;

    for (const item of allItems) {
      const qtyTotal = Number(item.qty) || 0;
      const qtyPassed = Number(item.qtyPassed) || 0;
      const qtyFailed = Number(item.qtyFailed) || 0;
      const unchecked = Math.max(0, qtyTotal - (qtyPassed + qtyFailed));

      if (qtyPassed > 0 || qtyFailed > 0) {
        hasAnyChecked = true;
      }
      if (qtyPassed !== qtyTotal || qtyFailed > 0 || unchecked > 0) {
        allPassed = false;
      }
      if (qtyFailed !== qtyTotal || qtyPassed > 0 || unchecked > 0) {
        allFailed = false;
      }
    }

    let globalStatus = "APPROVED";
    if (allPassed) {
      globalStatus = "APPROVED";
    } else if (allFailed) {
      globalStatus = "REJECTED";
    } else if (hasAnyChecked) {
      globalStatus = "PARTIAL";
    } else {
      globalStatus = "PENDING_INSPECTION";
    }

    // 3. Update PurchaseOrder Header
    const updatedPO = await (prisma.purchaseOrder as any).update({
      where: { id: input.poId },
      data: {
        qcStatus: globalStatus,
        qcApprovedBy: inspectorName,
        qcApprovedAt: now,
      },
    });

    const passedCount = allItems.filter((i: any) => (i.qtyPassed || 0) > 0).length;
    const failedCount = allItems.filter((i: any) => (i.qtyFailed || 0) > 0).length;

    // Send Notification
    const poNum = existingPO.nomorPO || "PO";
    await createNotification({
      title: `Hasil QC Pengecekan Barang PO (${globalStatus})`,
      message: `Inspector ${inspectorName} telah menyelesaikan pengujian QC per-item untuk ${poNum}. Status Global: ${globalStatus} (${passedCount} Item Lolos, ${failedCount} Item Ditolak).`,
      type: globalStatus === "APPROVED" ? "SUCCESS" : globalStatus === "PARTIAL" ? "WARNING" : "ALERT",
      module: "QC",
      targetUrl: "/trackers/quality-control",
    });

    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Hasil pengujian QC per-item untuk ${poNum} berhasil disimpan (Status Global: ${globalStatus}).`,
      data: JSON.parse(JSON.stringify(updatedPO)),
    };
  } catch (error: any) {
    console.error("Error submitPOReceiptQCValidation:", error);
    return {
      success: false,
      error: error?.message || "Gagal menyimpan hasil validasi QC per-item",
    };
  }
}

/**
 * Uploads a compressed QC attachment image to Supabase Storage bucket `qc-attachments`.
 * Returns public URL of the uploaded image.
 */
export async function uploadQCAttachmentAction(formData: FormData) {
  try {
    await requireAuth();

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "Berkas foto tidak ditemukan." };
    }

    // 1. Ensure bucket exists
    await ensureBucketExists();

    const supabase = createAdminClient();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `qc-items/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${safeFileName}`;

    const { error } = await supabase.storage
      .from("qc-attachments")
      .upload(filePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Supabase Storage upload error:", error);
      return { success: false, error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from("qc-attachments")
      .getPublicUrl(filePath);

    return {
      success: true,
      url: publicUrlData.publicUrl,
    };
  } catch (error: any) {
    console.error("Error uploadQCAttachmentAction:", error);
    return {
      success: false,
      error: error?.message || "Gagal mengunggah foto bukti QC",
    };
  }
}

/**
 * Submits QC inspection result for a SINGLE item in a Purchase Order.
 */
export async function submitSingleItemQCValidation(input: SingleItemQCInput) {
  try {
    await requireRole(["Superadmin", "Admin", "Quality Control", "QC", "PM"]);
    const session = await auth();
    const inspectorName = session?.user?.name || "QC Inspector";

    if (!input.poId || !input.itemId) {
      return { success: false, error: "ID PO dan ID Item wajib diisi" };
    }

    const itemObj = await (prisma.purchaseOrderItem as any).findUnique({
      where: { id: input.itemId },
    });

    if (!itemObj) {
      return { success: false, error: "Data item barang PO tidak ditemukan" };
    }

    const totalQty = Number(itemObj.qty) || 0;
    const pQty = Number(input.qtyPassed) || 0;
    const rQty = Number(input.qtyFailed) || 0;

    if (pQty + rQty > totalQty) {
      return {
        success: false,
        error: `Jumlah Qty Passed (${pQty}) + Qty Reject (${rQty}) melebihi total Qty PO (${totalQty} ${itemObj.satuan || "Pcs"})!`,
      };
    }

    if (rQty > 0 && (!input.qcDefectReason || !input.qcDefectReason.trim())) {
      return {
        success: false,
        error: "Alasan kerusakan (Defect) wajib diisi jika terdapat Qty Reject!",
      };
    }

    // Determine Item qcStatus
    let itemStatus = "PENDING_INSPECTION";
    if (pQty === totalQty && rQty === 0) {
      itemStatus = "PASSED";
    } else if (rQty === totalQty && pQty === 0) {
      itemStatus = "FAILED";
    } else if (pQty > 0 || rQty > 0) {
      itemStatus = "PARTIAL";
    } else {
      itemStatus = "PENDING_INSPECTION";
    }

    const now = new Date();

    // 1. Update PurchaseOrderItem
    const updatedItem = await (prisma.purchaseOrderItem as any).update({
      where: { id: input.itemId },
      data: {
        qcStatus: itemStatus,
        qtyPassed: pQty,
        qtyFailed: rQty,
        qcNotes: input.qcNotes?.trim() || null,
        qcDefectReason: input.qcDefectReason?.trim() || null,
        qcAttachments: input.qcAttachments || [],
        qcApprovedAt: now,
        qcApprovedBy: inspectorName,
      },
    });

    // 2. Update PO Header Status (agregat)
    const allItems = await (prisma.purchaseOrderItem as any).findMany({
      where: { purchaseOrderId: input.poId },
    });

    let allPassed = true;
    let allFailed = true;
    let hasAnyChecked = false;

    for (const item of allItems) {
      const qTotal = Number(item.qty) || 0;
      const qPassed = Number(item.qtyPassed) || 0;
      const qFailed = Number(item.qtyFailed) || 0;
      const unchecked = Math.max(0, qTotal - (qPassed + qFailed));

      if (qPassed > 0 || qFailed > 0) {
        hasAnyChecked = true;
      }
      if (qPassed !== qTotal || qFailed > 0 || unchecked > 0) {
        allPassed = false;
      }
      if (qFailed !== qTotal || qPassed > 0 || unchecked > 0) {
        allFailed = false;
      }
    }

    let globalStatus = "APPROVED";
    if (allPassed) {
      globalStatus = "APPROVED";
    } else if (allFailed) {
      globalStatus = "REJECTED";
    } else if (hasAnyChecked) {
      globalStatus = "PARTIAL";
    } else {
      globalStatus = "PENDING_INSPECTION";
    }

    await (prisma.purchaseOrder as any).update({
      where: { id: input.poId },
      data: {
        qcStatus: globalStatus,
        qcApprovedAt: now,
        qcApprovedBy: inspectorName,
      },
    });

    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Hasil pengujian QC untuk "${itemObj.namaBarang}" berhasil disimpan (${itemStatus}).`,
      data: JSON.parse(JSON.stringify(updatedItem)),
      globalPOStatus: globalStatus,
    };
  } catch (error: any) {
    console.error("Error submitSingleItemQCValidation:", error);
    return {
      success: false,
      error: error?.message || "Gagal menyimpan hasil validasi QC item",
    };
  }
}
