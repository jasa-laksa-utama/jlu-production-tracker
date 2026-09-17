"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export interface BoQItemInput {
  itemId: string;
  qty: number;
  unit: string;
  price: number;
  note?: string;
}

/**
 * Fetches all BoQs for a specific project.
 */
export async function getProjectBoQs(projectId: string) {
  try {
    await requireAuth();
    if (!projectId) return [];

    const boqs = await prisma.boQ.findMany({
      where: { projectId },
      include: {
        boqItems: {
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return boqs.map((boq) => {
      const itemsCount = boq.boqItems.length;
      const totalValue = boq.boqItems.reduce(
        (sum, item) => sum + item.qty * Number(item.price || 0),
        0
      );

      return {
        id: boq.id,
        projectId: boq.projectId,
        boqNumber: boq.boqNumber,
        boqStatus: boq.boqStatus,
        boqApprovedByPpic: boq.boqApprovedByPpic,
        boqApprovedByPpicAt: boq.boqApprovedByPpicAt,
        boqApprovedByPm: boq.boqApprovedByPm,
        boqApprovedByPmAt: boq.boqApprovedByPmAt,
        boqMakerName: boq.boqMakerName,
        boqRejectedReason: boq.boqRejectedReason,
        boqRejectedAt: boq.boqRejectedAt,
        createdAt: boq.createdAt,
        updatedAt: boq.updatedAt,
        itemsCount,
        totalValue,
      };
    });
  } catch (error) {
    console.error("[getProjectBoQs] Error:", error);
    return [];
  }
}

/**
 * Fetches BoQ details and items by BoQ ID.
 */
export async function getProjectBoQ(boqId: string) {
  try {
    await requireAuth();
    if (!boqId) return null;

    const boq = await prisma.boQ.findUnique({
      where: { id: boqId },
      include: {
        boqItems: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                name: true,
                typeMerk: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!boq) return null;

    return {
      id: boq.id,
      projectId: boq.projectId,
      boqNumber: boq.boqNumber,
      boqStatus: boq.boqStatus,
      boqApprovedByPpic: boq.boqApprovedByPpic,
      boqApprovedByPpicAt: boq.boqApprovedByPpicAt,
      boqApprovedByPm: boq.boqApprovedByPm,
      boqApprovedByPmAt: boq.boqApprovedByPmAt,
      boqMakerName: boq.boqMakerName,
      boqRejectedReason: boq.boqRejectedReason,
      boqRejectedAt: boq.boqRejectedAt,
      createdAt: boq.createdAt,
      updatedAt: boq.updatedAt,
      items: boq.boqItems.map((item) => ({
        id: item.id,
        boqId: item.boqId,
        itemId: item.itemId,
        qty: item.qty,
        unit: item.unit,
        price: item.price ? Number(item.price) : 0,
        note: item.note || "",
        itemCode: item.item?.code || "",
        itemName: item.item?.name || "",
        itemTypeMerk: item.item?.typeMerk || "",
      })),
    };
  } catch (error) {
    console.error("[getProjectBoQ] Error:", error);
    return null;
  }
}

/**
 * Creates a new BoQ for a project.
 */
export async function createProjectBoQ(projectId: string, boqNumber: string, items: BoQItemInput[]) {
  try {
    const user = await requireAuth();
    if (!projectId) return { success: false, error: "Project ID is required" };

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify project
      const project = await tx.project.findUnique({
        where: { id: projectId },
      });
      if (!project) throw new Error("Project tidak ditemukan.");

      // 2. Check if boqNumber is unique
      const existingBoQ = await tx.boQ.findFirst({
        where: { boqNumber },
      });
      if (existingBoQ) {
        throw new Error(`Nomor BoQ '${boqNumber}' sudah digunakan.`);
      }

      // 3. Create BoQ
      const boq = await tx.boQ.create({
        data: {
          projectId,
          boqNumber,
          boqStatus: "DRAFT",
          boqMakerName: user.name || "Engineering",
        },
      });

      // 4. Create items
      if (items.length > 0) {
        await tx.boQItem.createMany({
          data: items.map((item) => ({
            boqId: boq.id,
            itemId: item.itemId,
            qty: item.qty,
            unit: item.unit,
            price: new Prisma.Decimal(item.price),
            note: item.note || null,
          })),
        });
      }

      return boq;
    });

    try {
      const { syncEngineeringMasterplanProgress } = await import("@/app/actions/masterplan");
      await syncEngineeringMasterplanProgress(projectId);
    } catch (e) {
      console.error("Error auto-syncing engineering masterplan on createProjectBoQ:", e);
    }

    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/ppic");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[createProjectBoQ] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat BoQ.") };
  }
}

/**
 * Updates an existing BoQ.
 */
export async function updateProjectBoQ(boqId: string, boqNumber: string, items: BoQItemInput[]) {
  try {
    await requireAuth();
    if (!boqId) return { success: false, error: "BoQ ID is required" };

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find the current BoQ
      const boq = await tx.boQ.findUnique({
        where: { id: boqId },
        include: { boqItems: true },
      });
      if (!boq) throw new Error("BoQ tidak ditemukan.");

      // 2. Check duplicate boqNumber
      if (boqNumber !== boq.boqNumber) {
        const existing = await tx.boQ.findFirst({
          where: { boqNumber, NOT: { id: boqId } },
        });
        if (existing) throw new Error(`Nomor BoQ '${boqNumber}' sudah digunakan.`);
      }

      // 3. Check SPB allocations for the whole project to see if updating this BoQ violates SPB constraints.
      const existingSpbItems = await tx.sPBItem.findMany({
        where: { spb: { projectId: boq.projectId } },
        select: { materialId: true, qty: true, name: true },
      });

      const requestedQtyMap = new Map<string, number>();
      for (const item of existingSpbItems) {
        if (item.materialId) {
          requestedQtyMap.set(item.materialId, (requestedQtyMap.get(item.materialId) || 0) + item.qty);
        }
      }

      // Get all APPROVED BoQs for this project (excluding this one)
      const approvedBoqs = await tx.boQ.findMany({
        where: { projectId: boq.projectId, boqStatus: "APPROVED", NOT: { id: boqId } },
        include: { boqItems: true },
      });

      const otherApprovedQtyMap = new Map<string, number>();
      for (const other of approvedBoqs) {
        for (const item of other.boqItems) {
          otherApprovedQtyMap.set(item.itemId, (otherApprovedQtyMap.get(item.itemId) || 0) + item.qty);
        }
      }

      // For the items in the current update payload, check against total project SPB requests
      const newItemsMap = new Map(items.map((it) => [it.itemId, it]));
      for (const [materialId, requestedQty] of requestedQtyMap.entries()) {
        const otherApprovedQty = otherApprovedQtyMap.get(materialId) || 0;
        const newItem = newItemsMap.get(materialId);
        const newItemQty = newItem ? newItem.qty : 0;
        const totalProjectBoqQty = otherApprovedQty + newItemQty;

        if (totalProjectBoqQty < requestedQty) {
          throw new Error(
            `Kuantitas total BoQ proyek untuk item ini (${totalProjectBoqQty}) tidak boleh kurang dari kuantitas yang sudah dialokasikan ke SPB (${requestedQty}).`
          );
        }
      }

      // 4. Update BoQ metadata and status
      await tx.boQ.update({
        where: { id: boqId },
        data: {
          boqNumber,
          boqStatus: "DRAFT",
          boqApprovedByPpic: false,
          boqApprovedByPpicAt: null,
          boqApprovedByPm: false,
          boqApprovedByPmAt: null,
          boqRejectedReason: null,
          boqRejectedAt: null,
        },
      });

      // 5. Delete and replace items
      await tx.boQItem.deleteMany({
        where: { boqId },
      });

      if (items.length > 0) {
        await tx.boQItem.createMany({
          data: items.map((item) => ({
            boqId,
            itemId: item.itemId,
            qty: item.qty,
            unit: item.unit,
            price: new Prisma.Decimal(item.price),
            note: item.note || null,
          })),
        });
      }

      return { count: items.length, projectId: boq.projectId };
    });

    if (result.projectId) {
      try {
        const { syncEngineeringMasterplanProgress } = await import("@/app/actions/masterplan");
        await syncEngineeringMasterplanProgress(result.projectId);
      } catch (e) {
        console.error("Error auto-syncing engineering masterplan on updateProjectBoQ:", e);
      }
    }

    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/ppic");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[updateProjectBoQ] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui BoQ.") };
  }
}

/**
 * Deletes a BoQ.
 */
export async function deleteProjectBoQ(boqId: string) {
  try {
    await requireAuth();
    if (!boqId) return { success: false, error: "BoQ ID is required" };

    const result = await prisma.$transaction(async (tx) => {
      const boq = await tx.boQ.findUnique({
        where: { id: boqId },
      });
      if (!boq) throw new Error("BoQ tidak ditemukan.");

      // Check if project has SPBs
      const spbCount = await tx.sPB.count({
        where: { projectId: boq.projectId },
      });

      if (spbCount > 0) {
        throw new Error(
          "BoQ tidak bisa dihapus karena sudah ada Surat Permintaan Barang (SPB) yang diterbitkan untuk proyek ini."
        );
      }

      // Delete items
      await tx.boQItem.deleteMany({
        where: { boqId },
      });

      // Delete BoQ
      const deleted = await tx.boQ.delete({
        where: { id: boqId },
      });

      return deleted;
    });

    if (result.projectId) {
      try {
        const { syncEngineeringMasterplanProgress } = await import("@/app/actions/masterplan");
        await syncEngineeringMasterplanProgress(result.projectId);
      } catch (e) {
        console.error("Error auto-syncing engineering masterplan on deleteProjectBoQ:", e);
      }
    }

    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/ppic");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[deleteProjectBoQ] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghapus BoQ.") };
  }
}
