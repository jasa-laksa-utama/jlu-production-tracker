"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-guard";

export interface CreateSPJItemInput {
  name: string;
  qty: number;
  unit: string;
  note?: string;
}

/**
 * Create a new Surat Permintaan Jasa (SPJ)
 */
export async function createSPJ(
  projectId: string,
  items: CreateSPJItemInput[],
  customSpjNumber: string,
) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin", "PPIC"]);
    const session = await auth();
    const makerName = session?.user?.name || "User Pengaju";

    if (!projectId) {
      return { success: false, error: "Project ID wajib diisi" };
    }
    if (!items || items.length === 0) {
      return { success: false, error: "Daftar item jasa wajib diisi" };
    }
    if (!customSpjNumber || !customSpjNumber.trim()) {
      return { success: false, error: "Nomor SPJ wajib diisi" };
    }

    const spjNumber = customSpjNumber.trim();

    // Check if spjNumber already exists
    const existing = await prisma.sPJ.findUnique({
      where: { spjNumber },
    });
    if (existing) {
      return {
        success: false,
        error: `Nomor SPJ '${spjNumber}' sudah digunakan. Gunakan nomor SPJ lain.`,
      };
    }

    const newSPJ = await prisma.$transaction(async (tx) => {
      const created = await tx.sPJ.create({
        data: {
          spjNumber,
          projectId,
          status: "PENDING_APPROVAL",
          makerName,
          mengetahuiName: "Slamet",
          menyetujuiName: "Project Manager",
          items: {
            create: items.map((item) => ({
              name: item.name.trim(),
              qty: Number(item.qty) || 1,
              unit: item.unit || "ls",
              note: item.note?.trim() || null,
              status: "PENDING",
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Log to Project History
      await tx.projectHistory.create({
        data: {
          projectId,
          division: "PPIC",
          status: "IN_PROGRESS",
          action: "CREATE_SPJ",
          notes: `Surat Permintaan Jasa (SPJ) ${spjNumber} dibuat oleh ${makerName} dengan ${items.length} item jasa.`,
          updatedBy: makerName,
        },
      });

      return created;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");

    // Notification
    try {
      await createNotification({
        title: `SPJ Baru: ${spjNumber}`,
        message: `${makerName} telah mengajukan Surat Permintaan Jasa (${items.length} item jasa).`,
        type: "INFO",
        targetUrl: `/trackers/ppic?project=${projectId}`,
      });
    } catch (err) {
      console.error("Failed to send SPJ notification:", err);
    }

    return { success: true, data: JSON.parse(JSON.stringify(newSPJ)) };
  } catch (error: any) {
    console.error("[createSPJ] Error:", error);
    return { success: false, error: error.message || "Gagal membuat SPJ" };
  }
}

/**
 * Get SPJ History for a specific project
 */
export async function getSPJHistory(projectId: string) {
  try {
    if (!projectId) return [];
    const spjs = await prisma.sPJ.findMany({
      where: { projectId },
      include: {
        items: true,
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return JSON.parse(JSON.stringify(spjs));
  } catch (error) {
    console.error("[getSPJHistory] Error:", error);
    return [];
  }
}

/**
 * Get all SPJs across all projects (for PPIC monitoring table)
 */
export async function getAllSPJs() {
  try {
    const spjs = await prisma.sPJ.findMany({
      include: {
        items: true,
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return JSON.parse(JSON.stringify(spjs));
  } catch (error) {
    console.error("[getAllSPJs] Error:", error);
    return [];
  }
}

/**
 * Update an existing SPJ
 */
export async function updateSPJ(
  spjId: string,
  items: CreateSPJItemInput[],
  customSpjNumber: string,
) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin", "PPIC"]);
    const session = await auth();
    const updatedBy = session?.user?.name || "User";

    if (!spjId) return { success: false, error: "SPJ ID wajib diisi" };
    if (!items || items.length === 0)
      return { success: false, error: "Daftar item jasa wajib diisi" };
    if (!customSpjNumber || !customSpjNumber.trim())
      return { success: false, error: "Nomor SPJ wajib diisi" };

    const spjNumber = customSpjNumber.trim();

    // Check duplicate number if changed
    const current = await prisma.sPJ.findUnique({ where: { id: spjId } });
    if (!current) return { success: false, error: "SPJ tidak ditemukan" };

    if (current.spjNumber !== spjNumber) {
      const existing = await prisma.sPJ.findUnique({ where: { spjNumber } });
      if (existing) {
        return {
          success: false,
          error: `Nomor SPJ '${spjNumber}' sudah digunakan oleh SPJ lain.`,
        };
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old items and recreate
      await tx.sPJItem.deleteMany({ where: { spjId } });

      const res = await tx.sPJ.update({
        where: { id: spjId },
        data: {
          spjNumber,
          items: {
            create: items.map((item) => ({
              name: item.name.trim(),
              qty: Number(item.qty) || 1,
              unit: item.unit || "ls",
              note: item.note?.trim() || null,
              status: "PENDING",
            })),
          },
        },
        include: { items: true },
      });

      await tx.projectHistory.create({
        data: {
          projectId: current.projectId,
          division: "PPIC",
          status: "IN_PROGRESS",
          action: "UPDATE_SPJ",
          notes: `Surat Permintaan Jasa (SPJ) ${spjNumber} telah diperbarui oleh ${updatedBy}.`,
          updatedBy,
        },
      });

      return res;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    console.error("[updateSPJ] Error:", error);
    return { success: false, error: error.message || "Gagal memperbarui SPJ" };
  }
}

/**
 * Delete an SPJ
 */
export async function deleteSPJ(spjId: string) {
  try {
    await requireRole(["Superadmin", "Admin", "PPIC"]);
    const session = await auth();
    const deletedBy = session?.user?.name || "User";

    const spj = await prisma.sPJ.findUnique({ where: { id: spjId } });
    if (!spj) return { success: false, error: "SPJ tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      await tx.sPJ.delete({ where: { id: spjId } });

      await tx.projectHistory.create({
        data: {
          projectId: spj.projectId,
          division: "PPIC",
          status: "IN_PROGRESS",
          action: "DELETE_SPJ",
          notes: `Surat Permintaan Jasa (SPJ) ${spj.spjNumber} telah dihapus oleh ${deletedBy}.`,
          updatedBy: deletedBy,
        },
      });
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteSPJ] Error:", error);
    return { success: false, error: error.message || "Gagal menghapus SPJ" };
  }
}

/**
 * Approve SPJ by PPIC
 */
export async function approveSPJByPpic(spjId: string) {
  try {
    await requireRole(["PPIC", "Superadmin", "Admin"]);
    const session = await auth();
    const userBy = session?.user?.name || "PPIC";

    const spj = await prisma.sPJ.findUnique({ where: { id: spjId } });
    if (!spj) return { success: false, error: "SPJ tidak ditemukan" };

    const updated = await prisma.sPJ.update({
      where: { id: spjId },
      data: {
        approvedByPpic: true,
        approvedByPpicAt: new Date(),
        status: spj.approvedByPm ? "APPROVED" : "PENDING_APPROVAL",
      },
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    console.error("[approveSPJByPpic] Error:", error);
    return { success: false, error: error.message || "Gagal menyetujui SPJ" };
  }
}

/**
 * Approve SPJ by PM (Project Manager)
 */
export async function approveSPJByPm(spjId: string) {
  try {
    await requireRole(["PM", "Superadmin", "Admin", "Engineering"]);
    const session = await auth();

    const spj = await prisma.sPJ.findUnique({ where: { id: spjId } });
    if (!spj) return { success: false, error: "SPJ tidak ditemukan" };

    const updated = await prisma.sPJ.update({
      where: { id: spjId },
      data: {
        approvedByPm: true,
        approvedByPmAt: new Date(),
        status: spj.approvedByPpic ? "APPROVED" : "PENDING_APPROVAL",
      },
    });

    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/ppic");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    console.error("[approveSPJByPm] Error:", error);
    return { success: false, error: error.message || "Gagal menyetujui SPJ" };
  }
}

/**
 * Reject SPJ
 */
export async function rejectSPJ(spjId: string, reason: string) {
  try {
    await requireRole(["PPIC", "PM", "Superadmin", "Admin"]);
    const session = await auth();

    const spj = await prisma.sPJ.findUnique({ where: { id: spjId } });
    if (!spj) return { success: false, error: "SPJ tidak ditemukan" };

    const updated = await prisma.sPJ.update({
      where: { id: spjId },
      data: {
        status: "REJECTED",
        rejectedReason: reason,
        rejectedAt: new Date(),
      },
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    console.error("[rejectSPJ] Error:", error);
    return { success: false, error: error.message || "Gagal menolak SPJ" };
  }
}

/**
 * Update individual SPJ Item Status (Approval / Rejection per item)
 */
export async function updateSPJItemStatus(
  itemId: string,
  status: "APPROVED" | "REJECTED" | "PENDING",
) {
  try {
    await requireRole(["PPIC", "Superadmin", "Admin"]);

    const updatedItem = await prisma.sPJItem.update({
      where: { id: itemId },
      data: { status },
      include: { spj: true },
    });

    // Check all items in the SPJ to update parent SPJ status accordingly
    const allItems = await prisma.sPJItem.findMany({
      where: { spjId: updatedItem.spjId },
    });

    const allApproved = allItems.every((it) => it.status === "APPROVED");
    const anyRejected = allItems.some((it) => it.status === "REJECTED");
    const allRejected = allItems.every((it) => it.status === "REJECTED");

    let parentStatus = "PENDING_APPROVAL";
    if (allApproved) parentStatus = "APPROVED";
    else if (allRejected) parentStatus = "REJECTED";
    else if (anyRejected) parentStatus = "PARTIALLY_APPROVED";

    await prisma.sPJ.update({
      where: { id: updatedItem.spjId },
      data: { status: parentStatus },
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    return { success: true, data: JSON.parse(JSON.stringify(updatedItem)) };
  } catch (error: any) {
    console.error("[updateSPJItemStatus] Error:", error);
    return {
      success: false,
      error: error.message || "Gagal memperbarui status item SPJ",
    };
  }
}
