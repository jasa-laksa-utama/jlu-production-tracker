"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export type ComponentType = "STRUCTURE" | "MECHANICAL";

export interface SubComponentInput {
  name: string;
  qty?: number;
  satuan?: string;
  dimension?: string;
  spec?: string;
  markingCode?: string;
  notes?: string;
}

/**
 * Mengambil daftar sub-komponen dari sebuah komponen utama
 */
export async function getSubComponents(componentId: string, type: ComponentType = "STRUCTURE") {
  try {
    if (!componentId) {
      return { success: false, error: "ID Komponen wajib diisi", data: [] };
    }

    if (type === "STRUCTURE") {
      const items = await prisma.structureSubItem.findMany({
        where: { structureItemId: componentId },
        orderBy: { orderIndex: "asc" },
      });
      return { success: true, data: items };
    } else {
      const items = await prisma.mechanicalSubItem.findMany({
        where: { mechanicalItemId: componentId },
        orderBy: { orderIndex: "asc" },
      });
      return { success: true, data: items };
    }
  } catch (error: any) {
    console.error("Error fetching sub components:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil sub-komponen."), data: [] };
  }
}

/**
 * Menambahkan sub-komponen baru (tunggal)
 */
export async function addSubComponent(
  componentId: string,
  type: ComponentType,
  data: SubComponentInput
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!data.name || !data.name.trim()) {
      return { success: false, error: "Nama sub-komponen wajib diisi" };
    }

    const trimmedName = data.name.trim();
    const qty = Number(data.qty) > 0 ? Number(data.qty) : 1;
    const satuan = data.satuan?.trim() || "pcs";
    const markingCode = data.markingCode?.trim() || null;
    const notes = data.notes?.trim() || null;

    if (type === "STRUCTURE") {
      const count = await prisma.structureSubItem.count({
        where: { structureItemId: componentId },
      });

      const item = await prisma.structureSubItem.create({
        data: {
          structureItemId: componentId,
          name: trimmedName,
          qty,
          satuan,
          dimension: data.dimension?.trim() || null,
          markingCode,
          notes,
          orderIndex: count,
        },
      });

      revalidatePath("/trackers/production");
      revalidatePath("/trackers/quality-control");
      revalidatePath("/trackers/ppic");
      return { success: true, data: item };
    } else {
      const count = await prisma.mechanicalSubItem.count({
        where: { mechanicalItemId: componentId },
      });

      const item = await prisma.mechanicalSubItem.create({
        data: {
          mechanicalItemId: componentId,
          name: trimmedName,
          qty,
          satuan,
          spec: (data.spec || data.dimension)?.trim() || null,
          markingCode,
          notes,
          orderIndex: count,
        },
      });

      revalidatePath("/trackers/production");
      revalidatePath("/trackers/quality-control");
      revalidatePath("/trackers/ppic");
      return { success: true, data: item };
    }
  } catch (error: any) {
    console.error("Error adding sub component:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menambahkan sub-komponen.") };
  }
}

/**
 * Menambahkan beberapa sub-komponen sekaligus (Bulk Add / Quick Paste)
 */
export async function bulkAddSubComponents(
  componentId: string,
  type: ComponentType,
  items: SubComponentInput[]
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!items || items.length === 0) {
      return { success: false, error: "Tidak ada sub-komponen untuk ditambahkan" };
    }

    const validItems = items.filter((i) => i.name && i.name.trim().length > 0);
    if (validItems.length === 0) {
      return { success: false, error: "Semua nama sub-komponen kosong" };
    }

    if (type === "STRUCTURE") {
      const count = await prisma.structureSubItem.count({
        where: { structureItemId: componentId },
      });

      await prisma.$transaction(
        validItems.map((item, idx) =>
          prisma.structureSubItem.create({
            data: {
              structureItemId: componentId,
              name: item.name.trim(),
              qty: Number(item.qty) > 0 ? Number(item.qty) : 1,
              satuan: item.satuan?.trim() || "pcs",
              dimension: item.dimension?.trim() || null,
              markingCode: item.markingCode?.trim() || null,
              notes: item.notes?.trim() || null,
              orderIndex: count + idx,
            },
          })
        )
      );
    } else {
      const count = await prisma.mechanicalSubItem.count({
        where: { mechanicalItemId: componentId },
      });

      await prisma.$transaction(
        validItems.map((item, idx) =>
          prisma.mechanicalSubItem.create({
            data: {
              mechanicalItemId: componentId,
              name: item.name.trim(),
              qty: Number(item.qty) > 0 ? Number(item.qty) : 1,
              satuan: item.satuan?.trim() || "pcs",
              spec: (item.spec || item.dimension)?.trim() || null,
              markingCode: item.markingCode?.trim() || null,
              notes: item.notes?.trim() || null,
              orderIndex: count + idx,
            },
          })
        )
      );
    }

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/ppic");
    return { success: true, count: validItems.length };
  } catch (error: any) {
    console.error("Error bulk adding sub components:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menambahkan sub-komponen.") };
  }
}

/**
 * Mengubah detail sub-komponen
 */
export async function updateSubComponent(
  subItemId: string,
  type: ComponentType,
  data: Partial<SubComponentInput> & { isCompleted?: boolean }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.qty !== undefined) updateData.qty = Number(data.qty) || 1;
    if (data.satuan !== undefined) updateData.satuan = data.satuan.trim();
    if (data.markingCode !== undefined) updateData.markingCode = data.markingCode?.trim() || null;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

    if (data.isCompleted !== undefined) {
      updateData.isCompleted = Boolean(data.isCompleted);
      updateData.completedAt = data.isCompleted ? new Date() : null;
      updateData.completedBy = data.isCompleted ? (session.user.name || session.user.username) : null;
    }

    if (type === "STRUCTURE") {
      if (data.dimension !== undefined) updateData.dimension = data.dimension?.trim() || null;
      const updated = await prisma.structureSubItem.update({
        where: { id: subItemId },
        data: updateData,
      });
      revalidatePath("/trackers/production");
      revalidatePath("/trackers/quality-control");
      return { success: true, data: updated };
    } else {
      if (data.spec !== undefined || data.dimension !== undefined) {
        updateData.spec = (data.spec || data.dimension)?.trim() || null;
      }
      const updated = await prisma.mechanicalSubItem.update({
        where: { id: subItemId },
        data: updateData,
      });
      revalidatePath("/trackers/production");
      revalidatePath("/trackers/quality-control");
      return { success: true, data: updated };
    }
  } catch (error: any) {
    console.error("Error updating sub component:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui sub-komponen.") };
  }
}

/**
 * Menghapus sub-komponen
 */
export async function deleteSubComponent(subItemId: string, type: ComponentType) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (type === "STRUCTURE") {
      await prisma.structureSubItem.delete({
        where: { id: subItemId },
      });
    } else {
      await prisma.mechanicalSubItem.delete({
        where: { id: subItemId },
      });
    }

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting sub component:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghapus sub-komponen.") };
  }
}

/**
 * Toggle status pengerjaan sub-komponen (Centang Selesai / Belum)
 */
export async function toggleSubComponentComplete(
  subItemId: string,
  type: ComponentType,
  isCompleted: boolean
) {
  try {
    const session = await auth();
    const userName = session?.user?.name || session?.user?.username || "Staff Produksi";

    if (type === "STRUCTURE") {
      const updated = await prisma.structureSubItem.update({
        where: { id: subItemId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          completedBy: isCompleted ? userName : null,
        },
      });
      revalidatePath("/trackers/production");
      revalidatePath("/trackers/quality-control");
      return { success: true, data: updated };
    } else {
      const updated = await prisma.mechanicalSubItem.update({
        where: { id: subItemId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          completedBy: isCompleted ? userName : null,
        },
      });
      revalidatePath("/trackers/production");
      revalidatePath("/trackers/quality-control");
      return { success: true, data: updated };
    }
  } catch (error: any) {
    console.error("Error toggling sub component completion:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengubah status pengerjaan.") };
  }
}

/**
 * Tandai semua sub-komponen dalam komponen menjadi Selesai atau Belum Selesai sekaligus
 */
export async function bulkMarkSubComponentsComplete(
  componentId: string,
  type: ComponentType,
  isCompleted: boolean
) {
  try {
    const session = await auth();
    const userName = session?.user?.name || session?.user?.username || "Staff Produksi";

    if (type === "STRUCTURE") {
      await prisma.structureSubItem.updateMany({
        where: { structureItemId: componentId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          completedBy: isCompleted ? userName : null,
        },
      });
    } else {
      await prisma.mechanicalSubItem.updateMany({
        where: { mechanicalItemId: componentId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          completedBy: isCompleted ? userName : null,
        },
      });
    }

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    console.error("Error bulk marking sub components:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui status semua sub-komponen.") };
  }
}
