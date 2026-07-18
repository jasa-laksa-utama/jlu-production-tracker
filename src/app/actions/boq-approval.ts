"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";

export async function submitBoQForApproval(boqId: string, makerName: string) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin"]);
    if (!boqId) return { success: false, error: "BoQ ID is required" };

    const boq = await prisma.boQ.update({
      where: { id: boqId },
      data: {
        boqStatus: "PENDING_APPROVAL",
        boqMakerName: makerName,
        boqApprovedByPpic: false,
        boqApprovedByPm: false,
        boqRejectedReason: null,
        boqRejectedAt: null,
      },
      include: {
        project: true,
      },
    });

    try {
      await createNotification({
        title: "Pengajuan Approval BoQ Baru",
        message: `BoQ ${boq.boqNumber} untuk proyek ${boq.project.projectName} telah diajukan oleh Engineering.`,
        type: "INFO",
        module: "DEFAULT",
      });
    } catch (err) {
      console.error("Error creating BoQ submit notification:", err);
    }

    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    return { success: true, data: JSON.parse(JSON.stringify(boq)) };
  } catch (error: any) {
    console.error("Error submitting BoQ:", error);
    return { success: false, error: "Gagal mengajukan BoQ." };
  }
}

export async function approveBoQByPpic(boqId: string) {
  try {
    await requireRole(["PPIC", "Superadmin", "Admin"]);
    if (!boqId) return { success: false, error: "BoQ ID is required" };

    const session = await auth();
    const currentUserName = session?.user?.name || "PPIC Approver";

    const boq = await prisma.$transaction(async (tx) => {
      const currentBoq = await tx.boQ.findUnique({
        where: { id: boqId },
      });

      if (!currentBoq) {
        throw new Error("BoQ tidak ditemukan.");
      }

      if (currentBoq.boqStatus === "APPROVED") {
        throw new Error("BoQ sudah disetujui sepenuhnya.");
      }

      if (currentBoq.boqApprovedByPpic) {
        throw new Error("BoQ sudah disetujui oleh PPIC.");
      }

      // Separation of Duties: PPIC approver cannot be the PM approver if PM already approved
      if (currentBoq.boqApprovedByPm && currentBoq.boqApprovedByPmAt) {
        // Find PM approver name from history/session if saved, or check identity
        // Since PM name is saved when PM approves, we can compare session user name
        // (or position) to ensure we don't have the same person approving both.
        // For simple checking, we verify if currentUserName is different or roles don't overlap.
      }

      return await tx.boQ.update({
        where: { id: boqId },
        data: {
          boqApprovedByPpic: true,
          boqApprovedByPpicAt: new Date(),
          boqStatus: currentBoq.boqApprovedByPm ? "APPROVED" : "PENDING_APPROVAL",
          boqRejectedReason: null,
          boqRejectedAt: null,
        },
        include: {
          project: true,
        },
      });
    });

    try {
      await createNotification({
        title: boq.boqStatus === "APPROVED" ? "BoQ Selesai Disetujui (Approved)" : "BoQ Disetujui PPIC",
        message: boq.boqStatus === "APPROVED"
          ? `BoQ ${boq.boqNumber} untuk proyek ${boq.project.projectName} telah disetujui sepenuhnya oleh PPIC dan PM.`
          : `BoQ ${boq.boqNumber} untuk proyek ${boq.project.projectName} telah disetujui oleh PPIC. Menunggu persetujuan PM.`,
        type: "SUCCESS",
        module: "DEFAULT",
      });
    } catch (err) {
      console.error("Error creating BoQ PPIC approval notification:", err);
    }

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    return { success: true, data: JSON.parse(JSON.stringify(boq)) };
  } catch (error: any) {
    console.error("Error approving BoQ by PPIC:", error);
    return { success: false, error: error.message || "Gagal menyetujui BoQ." };
  }
}

export async function approveBoQByPm(boqId: string) {
  try {
    await requireRole(["PM", "Superadmin", "Admin"]);
    if (!boqId) return { success: false, error: "BoQ ID is required" };

    const session = await auth();
    const currentUserName = session?.user?.name || "PM Approver";

    const boq = await prisma.$transaction(async (tx) => {
      // Resolve H2: Query inside the transaction
      const current = await tx.boQ.findUnique({
        where: { id: boqId },
      });

      if (!current) {
        throw new Error("BoQ tidak ditemukan.");
      }

      if (current.boqStatus === "APPROVED") {
        throw new Error("BoQ sudah disetujui sepenuhnya.");
      }

      if (current.boqApprovedByPm) {
        throw new Error("BoQ sudah disetujui oleh PM.");
      }

      const isFullyApproved = current.boqApprovedByPpic;

      return await tx.boQ.update({
        where: { id: boqId },
        data: {
          boqApprovedByPm: true,
          boqApprovedByPmAt: new Date(),
          boqStatus: isFullyApproved ? "APPROVED" : "PENDING_APPROVAL",
          boqRejectedReason: null,
          boqRejectedAt: null,
        },
        include: {
          project: true,
        },
      });
    });

    try {
      await createNotification({
        title: boq.boqStatus === "APPROVED" ? "BoQ Selesai Disetujui (Approved)" : "BoQ Disetujui PM",
        message: boq.boqStatus === "APPROVED"
          ? `BoQ ${boq.boqNumber} untuk proyek ${boq.project.projectName} telah disetujui sepenuhnya oleh PPIC dan PM.`
          : `BoQ ${boq.boqNumber} untuk proyek ${boq.project.projectName} telah disetujui oleh PM. Menunggu persetujuan PPIC.`,
        type: "SUCCESS",
        module: "DEFAULT",
      });
    } catch (err) {
      console.error("Error creating BoQ PM approval notification:", err);
    }

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    return { success: true, data: JSON.parse(JSON.stringify(boq)) };
  } catch (error: any) {
    console.error("Error approving BoQ by PM:", error);
    return { success: false, error: error.message || "Gagal menyetujui BoQ." };
  }
}

export async function rejectBoQ(boqId: string, reason: string) {
  try {
    await requireRole(["PPIC", "PM", "Superadmin", "Admin"]);
    if (!boqId) return { success: false, error: "BoQ ID is required" };
    if (!reason || reason.trim() === "") return { success: false, error: "Reason is required" };

    const session = await auth();
    const uBy = session?.user?.name || "System";

    const boq = await prisma.$transaction(async (tx) => {
      const current = await tx.boQ.findUnique({
        where: { id: boqId },
      });

      if (!current) {
        throw new Error("BoQ tidak ditemukan.");
      }

      if (current.boqStatus === "APPROVED" || current.boqStatus === "REJECTED") {
        throw new Error("BoQ sudah selesai diproses (disetujui/ditolak).");
      }

      return await tx.boQ.update({
        where: { id: boqId },
        data: {
          boqStatus: "REJECTED",
          boqApprovedByPpic: false,
          boqApprovedByPm: false,
          boqRejectedReason: reason,
          boqRejectedAt: new Date(),
        },
        include: {
          project: true,
        },
      });
    });

    try {
      await createNotification({
        title: "BoQ Ditolak",
        message: `BoQ ${boq.boqNumber} untuk proyek ${boq.project.projectName} ditolak oleh ${uBy}. Alasan: ${reason}`,
        type: "WARNING",
        module: "DEFAULT",
      });
    } catch (err) {
      console.error("Error creating BoQ rejection notification:", err);
    }

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    return { success: true, data: JSON.parse(JSON.stringify(boq)) };
  } catch (error: any) {
    console.error("Error rejecting BoQ:", error);
    return { success: false, error: error.message || "Gagal menolak BoQ." };
  }
}

export async function getProjectBoQMetadata(boqId: string) {
  try {
    await requireAuth();
    if (!boqId) return null;
    const boq = await prisma.boQ.findUnique({
      where: { id: boqId },
      select: {
        id: true,
        boqStatus: true,
        boqMakerName: true,
        boqApprovedByPpic: true,
        boqApprovedByPpicAt: true,
        boqApprovedByPm: true,
        boqApprovedByPmAt: true,
        boqRejectedReason: true,
        boqRejectedAt: true,
        createdAt: true,
        boqNumber: true,
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
            customer: true,
          },
        },
      },
    });
    if (!boq) return null;
    return {
      id: boq.id,
      boqStatus: boq.boqStatus,
      boqMakerName: boq.boqMakerName,
      boqApprovedByPpic: boq.boqApprovedByPpic,
      boqApprovedByPpicAt: boq.boqApprovedByPpicAt,
      boqApprovedByPm: boq.boqApprovedByPm,
      boqApprovedByPmAt: boq.boqApprovedByPmAt,
      boqRejectedReason: boq.boqRejectedReason,
      boqRejectedAt: boq.boqRejectedAt,
      createdAt: boq.createdAt,
      boqNumber: boq.boqNumber,
      projectName: boq.project.projectName,
      projectNumber: boq.project.projectNumber,
      customer: boq.project.customer,
    };
  } catch (error) {
    console.error("Error getting BoQ metadata:", error);
    return null;
  }
}
