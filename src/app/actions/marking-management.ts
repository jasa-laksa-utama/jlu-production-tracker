"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export type MarkingTargetType =
  | "UNIT"
  | "STRUCTURE"
  | "MECHANICAL"
  | "STRUCTURE_SUB"
  | "MECHANICAL_SUB";

export interface MarkingOverviewItem {
  id: string;
  type: MarkingTargetType;
  unitId: string;
  unitName: string;
  parentName?: string;
  name: string;
  qty: number;
  satuan: string;
  dimensionOrSpec?: string;
  markingCode: string | null;
  isCompleted?: boolean;
}

/**
 * Mengambil rekapitulasi data marking seluruh unit, komponen, dan sub-komponen dalam sebuah proyek
 */
export async function getProjectMarkingOverview(projectId: string) {
  try {
    if (!projectId) {
      return { success: false, error: "ID Proyek wajib diisi", data: [] };
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
      },
    });

    const flatItems: MarkingOverviewItem[] = [];

    units.forEach((unit) => {
      // 1. Level Unit
      flatItems.push({
        id: unit.id,
        type: "UNIT",
        unitId: unit.id,
        unitName: unit.name,
        name: `[UNIT] ${unit.name}`,
        qty: unit.volume || 1,
        satuan: unit.satuan || "unit",
        markingCode: unit.markingCode,
      });

      // 2. Level Structure Items & SubItems
      unit.structureItems.forEach((strItem) => {
        flatItems.push({
          id: strItem.id,
          type: "STRUCTURE",
          unitId: unit.id,
          unitName: unit.name,
          name: strItem.name,
          qty: strItem.qty,
          satuan: strItem.satuan,
          markingCode: strItem.markingCode,
          isCompleted: Boolean(
            strItem.progressPercent && Number(strItem.progressPercent) >= 100
          ),
        });

        strItem.subItems.forEach((sub) => {
          flatItems.push({
            id: sub.id,
            type: "STRUCTURE_SUB",
            unitId: unit.id,
            unitName: unit.name,
            parentName: strItem.name,
            name: `↳ ${sub.name}`,
            qty: sub.qty,
            satuan: sub.satuan,
            dimensionOrSpec: sub.dimension || undefined,
            markingCode: sub.markingCode || strItem.markingCode,
            isCompleted: sub.isCompleted,
          });
        });
      });

      // 3. Level Mechanical Items & SubItems
      unit.mechanicalItems.forEach((mecItem) => {
        flatItems.push({
          id: mecItem.id,
          type: "MECHANICAL",
          unitId: unit.id,
          unitName: unit.name,
          name: mecItem.name,
          qty: mecItem.qty,
          satuan: mecItem.satuan,
          markingCode: mecItem.markingCode,
          isCompleted: Boolean(
            mecItem.progressPercent && Number(mecItem.progressPercent) >= 100
          ),
        });

        mecItem.subItems.forEach((sub) => {
          flatItems.push({
            id: sub.id,
            type: "MECHANICAL_SUB",
            unitId: unit.id,
            unitName: unit.name,
            parentName: mecItem.name,
            name: `↳ ${sub.name}`,
            qty: sub.qty,
            satuan: sub.satuan,
            dimensionOrSpec: sub.spec || undefined,
            markingCode: sub.markingCode || mecItem.markingCode,
            isCompleted: sub.isCompleted,
          });
        });
      });
    });

    const unitList = units.map((u) => ({
      id: u.id,
      name: u.name,
      orderIndex: u.orderIndex,
      markingCode: u.markingCode,
    }));

    return { success: true, data: flatItems, units: unitList };
  } catch (error: any) {
    console.error("Error getting project marking overview:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data marking."),
      data: [],
    };
  }
}

/**
 * Mengubah kode marking pada satu item
 */
export async function updateItemMarking(
  type: MarkingTargetType,
  id: string,
  markingCode: string | null
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const trimmedCode = markingCode?.trim() || null;
    const markingStatus = trimmedCode ? "MARKED" : "UNMARKED";

    if (type === "UNIT") {
      await prisma.conveyorUnit.update({
        where: { id },
        data: {
          markingCode: trimmedCode,
        },
      });
    } else if (type === "STRUCTURE") {
      await prisma.structureItem.update({
        where: { id },
        data: {
          markingCode: trimmedCode,
          markingStatus,
        },
      });
    } else if (type === "MECHANICAL") {
      await prisma.mechanicalItem.update({
        where: { id },
        data: {
          markingCode: trimmedCode,
          markingStatus,
        },
      });
    } else if (type === "STRUCTURE_SUB") {
      await prisma.structureSubItem.update({
        where: { id },
        data: {
          markingCode: trimmedCode,
        },
      });
    } else if (type === "MECHANICAL_SUB") {
      await prisma.mechanicalSubItem.update({
        where: { id },
        data: {
          markingCode: trimmedCode,
        },
      });
    }

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating item marking:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memperbarui kode marking."),
    };
  }
}

/**
 * Menetapkan Kode Marking / Bundel secara massal ke semua item terpilih
 */
export async function assignMarkingCodeBulk(
  items: { type: MarkingTargetType; id: string }[],
  markingCode: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const trimmedCode = markingCode?.trim() || null;
    const markingStatus = trimmedCode ? "MARKED" : "UNMARKED";
    const updates: Promise<any>[] = [];

    for (const item of items) {
      if (item.type === "UNIT") {
        updates.push(
          prisma.conveyorUnit.update({
            where: { id: item.id },
            data: { markingCode: trimmedCode },
          })
        );
      } else if (item.type === "STRUCTURE") {
        updates.push(
          prisma.structureItem.update({
            where: { id: item.id },
            data: {
              markingCode: trimmedCode,
              markingStatus,
            },
          })
        );
      } else if (item.type === "MECHANICAL") {
        updates.push(
          prisma.mechanicalItem.update({
            where: { id: item.id },
            data: {
              markingCode: trimmedCode,
              markingStatus,
            },
          })
        );
      } else if (item.type === "STRUCTURE_SUB") {
        updates.push(
          prisma.structureSubItem.update({
            where: { id: item.id },
            data: { markingCode: trimmedCode },
          })
        );
      } else if (item.type === "MECHANICAL_SUB") {
        updates.push(
          prisma.mechanicalSubItem.update({
            where: { id: item.id },
            data: { markingCode: trimmedCode },
          })
        );
      }
    }

    await Promise.all(updates);

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true, count: items.length };
  } catch (error: any) {
    console.error("Error assigning bulk marking code:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menetapkan kode marking."),
    };
  }
}
