"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";
import { calcMechanicalItemProgress } from "@/lib/progress-calculator";

export interface CreateSPBItemInput {
  name: string;
  qty: number;
  source: string; // WAREHOUSE or TRADING
  unit: string;
  note?: string;
  materialId?: string;
  typeMerk?: string;
}

export async function createSPB(
  projectId: string,
  items: CreateSPBItemInput[],
  customSpbNumber?: string,
  options?: {
    deadlineDate?: string | Date | null;
    imageUrl?: string | null;
  }
) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin", "PPIC"]);
    const session = await auth();
    const makerName = session?.user?.name || "User Pengaju";
    if (!projectId) {
      return { success: false, error: "Project ID is required" };
    }
    if (!items || items.length === 0) {
      return { success: false, error: "Items are required" };
    }

    if (!customSpbNumber || !customSpbNumber.trim()) {
      return { success: false, error: "Nomor SPB wajib diisi" };
    }

    const warnings: { title: string; message: string }[] = [];

    const result = await prisma.$transaction(async (tx) => {
      // 0. Get all approved BoQs for this project
      const approvedBoqs = await tx.boQ.findMany({
        where: {
          projectId,
          boqStatus: "APPROVED",
        },
        include: {
          boqItems: true,
        },
      });

      if (approvedBoqs.length === 0) {
        throw new Error(
          "Surat Permintaan Barang (SPB) hanya dapat dibuat jika proyek memiliki setidaknya satu BoQ yang telah disetujui (Approved) sepenuhnya."
        );
      }

      // Aggregate item quantities across all APPROVED BoQs
      const boqItemMap = new Map<string, { qty: number; unit: string }>();
      for (const boq of approvedBoqs) {
        for (const item of boq.boqItems) {
          const current = boqItemMap.get(item.itemId);
          if (current) {
            current.qty += item.qty;
          } else {
            boqItemMap.set(item.itemId, {
              qty: item.qty,
              unit: item.unit,
            });
          }
        }
      }

      // Get all other SPB items already requested for this project
      const existingSpbItems = await tx.sPBItem.findMany({
        where: {
          spb: {
            projectId,
          },
        },
        select: {
          materialId: true,
          qty: true,
          name: true,
        },
      });

      const requestedQtyMap = new Map<string, number>();
      for (const item of existingSpbItems) {
        if (item.materialId) {
          requestedQtyMap.set(
            item.materialId,
            (requestedQtyMap.get(item.materialId) || 0) + item.qty
          );
        }
      }

      // Check each requested item in SPB
      for (const item of items) {
        if (!item.materialId) {
          throw new Error(`Barang '${item.name}' harus terhubung dengan Master Data.`);
        }

        const boqItem = boqItemMap.get(item.materialId);
        if (!boqItem) {
          throw new Error(
            `Barang '${item.name}' tidak terdaftar dalam BoQ Proyek ini.`
          );
        }

        const alreadyRequested = requestedQtyMap.get(item.materialId) || 0;
        const totalRequested = alreadyRequested + item.qty;
        if (totalRequested > boqItem.qty) {
          throw new Error(
            `Kuantitas barang '${item.name}' (${totalRequested} ${item.unit}) melebihi batas BoQ (${boqItem.qty} ${boqItem.unit}). Sudah diminta sebelumnya: ${alreadyRequested} ${item.unit}.`
          );
        }
      }

      // Validate WAREHOUSE item stock levels
      for (const item of items) {
        if (item.source === "WAREHOUSE" && item.materialId) {
          const dbItem = await tx.item.findUnique({
            where: { id: item.materialId },
            include: { unit: true },
          });
          if (!dbItem) {
            throw new Error(`Barang gudang '${item.name}' tidak ditemukan.`);
          }
          const availableStock = dbItem.currentStock - dbItem.reservedStock;
          const unitName = dbItem.unit?.name || "pcs";
          if (item.qty > availableStock) {
            throw new Error(
              `Stok tidak mencukupi untuk '${item.name}'. Tersedia: ${availableStock} ${unitName}, Diminta: ${item.qty} ${unitName}. Silakan ubah sumber ke TRADING.`
            );
          }
          const remainingAvailable = availableStock - item.qty;
          if (remainingAvailable < dbItem.minStock) {
            warnings.push({
              title: `Stok Menipis: ${dbItem.name}`,
              message: `Stok tersedia untuk '${dbItem.name}' tersisa ${remainingAvailable} ${unitName} (Batas minimum: ${dbItem.minStock} ${unitName}).`,
            });
          }
        }
      }

      const spbNumber = customSpbNumber!.trim();
      const existing = await tx.sPB.findUnique({
        where: { spbNumber },
      });
      if (existing) {
        throw new Error(`Nomor SPB '${spbNumber}' sudah digunakan.`);
      }

      // Create SPB
      const newSPB = await tx.sPB.create({
        data: {
          spbNumber,
          projectId,
          status: "PENDING_APPROVAL",
          makerName,
          mengetahuiName: "Slamet",
          menyetujuiName: "Project Manager",
          deadlineDate: options?.deadlineDate ? new Date(options.deadlineDate) : null,
          imageUrl: options?.imageUrl || null,
          items: {
            create: items.map((item) => ({
              name: item.name,
              typeMerk: item.typeMerk || null,
              qty: item.qty,
              unit: item.unit || "pcs",
              source: item.source,
              note: item.note || null,
              materialId: item.materialId || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Increment reservedStock for WAREHOUSE items
      for (const item of items) {
        if (item.source === "WAREHOUSE" && item.materialId) {
          await tx.item.update({
            where: { id: item.materialId },
            data: {
              reservedStock: {
                increment: item.qty,
              },
            },
          });
        }
      }

      return newSPB;
    });

    revalidatePath("/trackers/ppic");

    // Trigger notification
    try {
      const session = await auth();
      const uBy = session?.user?.name || "Seseorang";

      // Fetch project details
      const proj = await prisma.project.findUnique({
        where: { id: projectId },
        select: { projectNumber: true },
      });
      const targetName = proj ? `Proyek ${proj.projectNumber || "-"}` : "proyek";

      await createNotification({
        title: "Pembuatan Surat Permintaan Barang (SPB)",
        message: `${uBy} membuat SPB baru (${result.spbNumber}) untuk ${targetName}.`,
        type: "SUCCESS",
        module: "DEFAULT",
        targetUrl: `/trackers/ppic?search=${encodeURIComponent(proj?.projectNumber || "")}`,
      });
    } catch (err) {
      console.error("Error creating SPB notification:", err);
    }

    // Create low stock warnings in the background
    if (warnings.length > 0) {
      try {
        for (const w of warnings) {
          await createNotification({
            title: w.title,
            message: w.message,
            type: "WARNING",
            module: "TRACKER",
            targetUrl: `/trackers/ppic`,
          });
        }
      } catch (err) {
        console.error("Error creating low stock notifications:", err);
      }
    }

    return { success: true, data: result, warnings: warnings.map((w) => w.message) };
  } catch (error: any) {
    console.error("Error creating SPB:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat SPB.") };
  }
}

export async function getSPBHistory(projectId: string) {
  try {
    await requireAuth();
    if (!projectId) return [];
    
    const history = await prisma.sPB.findMany({
      where: { projectId },
      include: {
        items: {
          include: {
            material: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Map history to UI expected fields
    return history.map((spb: any) => {
      const formattedDate = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(spb.createdAt));

      return {
        id: spb.spbNumber,
        dbId: spb.id, // Database UUID
        spbNumber: spb.spbNumber,
        date: formattedDate,
        totalItems: spb.items.length,
        status: spb.status, // Add SPB status field
        approvedByPpic: spb.approvedByPpic,
        approvedByPpicAt: spb.approvedByPpicAt,
        approvedByPm: spb.approvedByPm,
        approvedByPmAt: spb.approvedByPmAt,
        makerName: spb.makerName,
        deadlineDate: spb.deadlineDate,
        imageUrl: spb.imageUrl,
        createdAt: spb.createdAt,
        items: spb.items.map((item: any) => ({
          name: item.name,
          typeMerk: item.typeMerk || "",
          qty: item.qty,
          source: item.source,
          unit: item.unit,
          note: item.note || "",
          status: item.status || "PENDING",
          materialId: item.materialId || undefined,
          materialCode: item.material?.code || undefined,
        })),
      };
    });
  } catch (error) {
    console.error("Error fetching SPB history:", error);
    return [];
  }
}

export async function deleteSPB(spbId: string) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin", "PPIC"]);
    if (!spbId) {
      return { success: false, error: "SPB ID is required" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find SPB and its items
      const spb = await tx.sPB.findUnique({
        where: { id: spbId },
        include: {
          items: true,
        },
      });

      if (!spb) {
        throw new Error("SPB tidak ditemukan");
      }

      const hasIssuedItems = spb.items.some(
        (i) => (i.qtyIssued || 0) > 0 || i.status === "FULFILLED" || i.status === "RECEIVED"
      );

      if (hasIssuedItems) {
        throw new Error("SPB yang barangnya sudah diproses/dikeluarkan tidak dapat dihapus.");
      }

      const isRejected = spb.status === "REJECTED" || spb.status.includes("REJECTED");

      // Revert reservedStock for WAREHOUSE items ONLY IF not already reverted via REJECTED status
      if (!isRejected) {
        for (const item of spb.items) {
          if (item.source === "WAREHOUSE" && item.materialId) {
            const material = await tx.item.findUnique({
              where: { id: item.materialId },
              select: { reservedStock: true },
            });
            if (material) {
              await tx.item.update({
                where: { id: item.materialId },
                data: {
                  reservedStock: Math.max(0, (material.reservedStock || 0) - item.qty),
                },
              });
            }
          }
        }
      }

      // Delete the SPB record (cascade delete handles spb_items)
      await tx.sPB.delete({
        where: { id: spbId },
      });

      return spb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-engineering");

    // Trigger notification
    try {
      const session = await auth();
      const uBy = session?.user?.name || "Seseorang";
      await createNotification({
        title: "Penghapusan Surat Permintaan Barang (SPB)",
        message: `${uBy} menghapus SPB (${result.spbNumber}).`,
        type: "WARNING",
        module: "DEFAULT",
      });
    } catch (err) {
      console.error("Error creating SPB delete notification:", err);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting SPB:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghapus SPB.") };
  }
}

export async function updateSPB(
  spbId: string,
  items: CreateSPBItemInput[],
  customSpbNumber?: string,
  options?: {
    deadlineDate?: string | Date | null;
    imageUrl?: string | null;
  }
) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin", "PPIC"]);
    if (!spbId) {
      return { success: false, error: "SPB ID is required" };
    }
    if (!customSpbNumber || !customSpbNumber.trim()) {
      return { success: false, error: "Nomor SPB wajib diisi" };
    }
    if (!items || items.length === 0) {
      return { success: false, error: "Items are required" };
    }

    const warnings: { title: string; message: string }[] = [];

    const result = await prisma.$transaction(async (tx) => {
      // Find current SPB and its items
      const existingSPB = await tx.sPB.findUnique({
        where: { id: spbId },
        include: {
          items: true,
        },
      });

      if (!existingSPB) {
        throw new Error("SPB tidak ditemukan");
      }

      if (existingSPB.status !== "PENDING_APPROVAL") {
        throw new Error("SPB yang sudah diproses tidak dapat diubah.");
      }

      // 0. Get all approved BoQs for this project
      const projectId = existingSPB.projectId;
      const approvedBoqs = await tx.boQ.findMany({
        where: {
          projectId,
          boqStatus: "APPROVED",
        },
        include: {
          boqItems: true,
        },
      });

      if (approvedBoqs.length === 0) {
        throw new Error(
          "Surat Permintaan Barang (SPB) hanya dapat diperbarui jika proyek memiliki setidaknya satu BoQ yang telah disetujui (Approved) sepenuhnya."
        );
      }

      // Aggregate item quantities across all APPROVED BoQs
      const boqItemMap = new Map<string, { qty: number; unit: string }>();
      for (const boq of approvedBoqs) {
        for (const item of boq.boqItems) {
          const current = boqItemMap.get(item.itemId);
          if (current) {
            current.qty += item.qty;
          } else {
            boqItemMap.set(item.itemId, {
              qty: item.qty,
              unit: item.unit,
            });
          }
        }
      }

      // Get all other SPB items already requested for this project, EXCLUDING the current SPB
      const existingSpbItems = await tx.sPBItem.findMany({
        where: {
          spb: {
            projectId,
            NOT: { id: spbId },
          },
        },
        select: {
          materialId: true,
          qty: true,
          name: true,
        },
      });

      const requestedQtyMap = new Map<string, number>();
      for (const item of existingSpbItems) {
        if (item.materialId) {
          requestedQtyMap.set(
            item.materialId,
            (requestedQtyMap.get(item.materialId) || 0) + item.qty
          );
        }
      }

      // Check each requested item in SPB
      for (const item of items) {
        if (!item.materialId) {
          throw new Error(`Barang '${item.name}' harus terhubung dengan Master Data.`);
        }

        const boqItem = boqItemMap.get(item.materialId);
        if (!boqItem) {
          throw new Error(
            `Barang '${item.name}' tidak terdaftar dalam BoQ Proyek ini.`
          );
        }

        const alreadyRequested = requestedQtyMap.get(item.materialId) || 0;
        const totalRequested = alreadyRequested + item.qty;
        if (totalRequested > boqItem.qty) {
          throw new Error(
            `Kuantitas barang '${item.name}' (${totalRequested} ${item.unit}) melebihi batas BoQ (${boqItem.qty} ${boqItem.unit}). Sudah diminta sebelumnya: ${alreadyRequested} ${item.unit}.`
          );
        }
      }

      // 1. Revert reservedStock for old WAREHOUSE items
      for (const item of existingSPB.items) {
        if (item.source === "WAREHOUSE" && item.materialId) {
          const material = await tx.item.findUnique({
            where: { id: item.materialId },
            select: { reservedStock: true },
          });
          if (material) {
            await tx.item.update({
              where: { id: item.materialId },
              data: {
                reservedStock: Math.max(0, (material.reservedStock || 0) - item.qty),
              },
            });
          }
        }
      }

      // 2. Delete existing spb_items
      await tx.sPBItem.deleteMany({
        where: { spbId },
      });

      // 3. Validate WAREHOUSE item stock levels (after reverting old reservedStock)
      for (const item of items) {
        if (item.source === "WAREHOUSE" && item.materialId) {
          const dbItem = await tx.item.findUnique({
            where: { id: item.materialId },
            include: { unit: true },
          });
          if (!dbItem) {
            throw new Error(`Barang gudang '${item.name}' tidak ditemukan.`);
          }
          const availableStock = dbItem.currentStock - dbItem.reservedStock;
          const unitName = dbItem.unit?.name || "pcs";
          if (item.qty > availableStock) {
            throw new Error(
              `Stok tidak mencukupi untuk '${item.name}'. Tersedia: ${availableStock} ${unitName}, Diminta: ${item.qty} ${unitName}. Silakan ubah sumber ke TRADING.`
            );
          }
          const remainingAvailable = availableStock - item.qty;
          if (remainingAvailable < dbItem.minStock) {
            warnings.push({
              title: `Stok Menipis: ${dbItem.name}`,
              message: `Stok tersedia untuk '${dbItem.name}' tersisa ${remainingAvailable} ${unitName} (Batas minimum: ${dbItem.minStock} ${unitName}).`,
            });
          }
        }
      }

      // 4. Update SPB number if changed & Create new spb_items
      let spbNumber = customSpbNumber?.trim();
      if (spbNumber && spbNumber !== existingSPB.spbNumber) {
        const existing = await tx.sPB.findUnique({
          where: { spbNumber },
        });
        if (existing) {
          throw new Error(`Nomor SPB '${spbNumber}' sudah digunakan.`);
        }
      }

      const updatedSPB = await tx.sPB.update({
        where: { id: spbId },
        data: {
          spbNumber: spbNumber || undefined,
          deadlineDate: options?.deadlineDate !== undefined ? (options.deadlineDate ? new Date(options.deadlineDate) : null) : undefined,
          imageUrl: options?.imageUrl !== undefined ? (options.imageUrl || null) : undefined,
          items: {
            create: items.map((item) => ({
              name: item.name,
              typeMerk: item.typeMerk || null,
              qty: item.qty,
              unit: item.unit || "pcs",
              source: item.source,
              note: item.note || null,
              materialId: item.materialId || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // 5. Increment reservedStock for new WAREHOUSE items
      for (const item of items) {
        if (item.source === "WAREHOUSE" && item.materialId) {
          await tx.item.update({
            where: { id: item.materialId },
            data: {
              reservedStock: {
                increment: item.qty,
              },
            },
          });
        }
      }

      return updatedSPB;
    });

    revalidatePath("/trackers/ppic");

    // Trigger notification
    try {
      const session = await auth();
      const uBy = session?.user?.name || "Seseorang";
      await createNotification({
        title: "Pembaruan Surat Permintaan Barang (SPB)",
        message: `${uBy} memperbarui SPB (${result.spbNumber}).`,
        type: "SUCCESS",
        module: "DEFAULT",
      });
    } catch (err) {
      console.error("Error creating SPB update notification:", err);
    }

    // Create low stock warnings in the background
    if (warnings.length > 0) {
      try {
        for (const w of warnings) {
          await createNotification({
            title: w.title,
            message: w.message,
            type: "WARNING",
            module: "TRACKER",
            targetUrl: `/trackers/ppic`,
          });
        }
      } catch (err) {
        console.error("Error creating low stock notifications:", err);
      }
    }

    return { success: true, data: result, warnings: warnings.map((w) => w.message) };
  } catch (error: any) {
    console.error("Error updating SPB:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui SPB.") };
  }
}

export async function updateSPBItemStatus(spbItemId: string, newStatus: string) {
  try {
    await requireAuth();
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the SPBItem status
      const item = await tx.sPBItem.update({
        where: { id: spbItemId },
        data: { status: newStatus },
        include: {
          spb: {
            include: {
              project: {
                include: {
                  spb: {
                    include: {
                      items: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (newStatus === "PENDING" && item.spb.status === "REJECTED") {
        await tx.sPB.update({
          where: { id: item.spbId },
          data: {
            status: "PENDING_APPROVAL",
            approvedByPpic: false,
            approvedByPm: false,
            rejectedReason: null,
            rejectedAt: null,
          },
        });
      }

      const project = item.spb.project;

      // 2. Check if at least 1 item in any SPB is processed to completion (FULFILLED or RECEIVED)
      let hasCompletedItem = false;
      for (const spb of project.spb) {
        for (const it of spb.items) {
          const s = it.status.toUpperCase();
          if (s === "FULFILLED" || s === "RECEIVED") {
            hasCompletedItem = true;
            break;
          }
        }
        if (hasCompletedItem) break;
      }

      // If at least 1 item is finished, trigger "Inventory Accepted"
      if (hasCompletedItem) {
        // Close last history entry
        const lastHistory = await tx.projectHistory.findFirst({
          where: { projectId: project.id, exitDate: null },
          orderBy: { entryDate: "desc" },
        });

        if (lastHistory) {
          await tx.projectHistory.update({
            where: { id: lastHistory.id },
            data: { exitDate: new Date() },
          });
        }

        // Create new history entry
        await tx.projectHistory.create({
          data: {
            projectId: project.id,
            division: "PRODUCTION",
            status: "INVENTORY_ACCEPTED",
            entryDate: new Date(),
            notes: `Project status automatically updated to Inventory Accepted - Triggered by SPB item fulfillment`,
            updatedBy: "System",
          },
        });

        // Update Project record
        await tx.project.update({
          where: { id: project.id },
          data: {
            status: "INVENTORY_ACCEPTED",
            warehouseStatus: "READY",
            purchasingStatus: "COMPLETED",
          },
        });
      }

      return item;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/dashboard");
    return { success: true, data: { id: result.id, status: result.status } };
  } catch (error: any) {
    console.error("Error updating SPB item status:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui status item SPB.") };
  }
}

export async function approveSpbByPpic(spbId: string) {
  try {
    await requireRole(["PPIC", "Superadmin", "Admin"]);
    const session = await auth();
    const userName = session?.user?.name || "PPIC Approver";

    const result = await prisma.$transaction(async (tx) => {
      const spbRecord = await tx.sPB.findUnique({
        where: { id: spbId },
      });

      if (!spbRecord) {
        throw new Error("SPB tidak ditemukan.");
      }

      if (spbRecord.status === "APPROVED" || spbRecord.status === "REJECTED") {
        throw new Error("SPB sudah selesai diproses (disetujui/ditolak).");
      }

      if (spbRecord.approvedByPpic) {
        throw new Error("SPB sudah disetujui oleh PPIC.");
      }

      const updatedSpb = await tx.sPB.update({
        where: { id: spbId },
        data: {
          approvedByPpic: true,
          approvedByPpicAt: new Date(),
          mengetahuiName: userName,
          status: "PENDING_APPROVAL",
        },
      });

      return updatedSpb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-direksi");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error approving SPB by PPIC:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyetujui SPB.") };
  }
}

export async function approveSpbByPm(spbId: string) {
  try {
    await requireRole(["PM", "Superadmin", "Admin", "PPIC"]);
    const session = await auth();
    const pmName = session?.user?.name || "Project Manager";

    const result = await prisma.$transaction(async (tx) => {
      const spbRecord = await tx.sPB.findUnique({
        where: { id: spbId },
      });

      if (!spbRecord) {
        throw new Error("SPB tidak ditemukan.");
      }

      if (spbRecord.status === "APPROVED" || spbRecord.status === "REJECTED") {
        throw new Error("SPB sudah selesai diproses (disetujui/ditolak).");
      }

      if (spbRecord.approvedByPm) {
        throw new Error("SPB sudah disetujui oleh PM.");
      }

      const updatedSpb = await tx.sPB.update({
        where: { id: spbId },
        data: {
          approvedByPm: true,
          approvedByPmAt: new Date(),
          menyetujuiName: pmName,
          status: "PENDING_APPROVAL",
        },
      });

      return updatedSpb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-direksi");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error approving SPB by PM:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyetujui SPB.") };
  }
}

export async function approveSpbByDireksi(spbId: string) {
  try {
    await requireRole(["Direktur", "Direksi", "Superadmin", "Admin"]);
    const session = await auth();
    const direksiName = session?.user?.name || "Direksi Approver";

    const result = await prisma.$transaction(async (tx) => {
      const spbRecord = await tx.sPB.findUnique({
        where: { id: spbId },
      });

      if (!spbRecord) {
        throw new Error("SPB tidak ditemukan.");
      }

      if (spbRecord.status === "APPROVED" || spbRecord.status === "REJECTED") {
        throw new Error("SPB sudah selesai diproses (disetujui/ditolak).");
      }

      if (spbRecord.approvedByDireksi) {
        throw new Error("SPB sudah disetujui oleh Direksi.");
      }

      if (!spbRecord.approvedByPpic || !spbRecord.approvedByPm) {
        throw new Error(
          "SPB harus disetujui oleh PPIC dan PM terlebih dahulu sebelum disetujui Direksi.",
        );
      }

      const updatedSpb = await tx.sPB.update({
        where: { id: spbId },
        data: {
          approvedByDireksi: true,
          approvedByDireksiAt: new Date(),
          status: "APPROVED",
        },
      });

      const projectRecord = await tx.project.findUnique({
        where: { id: spbRecord.projectId },
      });
      if (projectRecord) {
        const lastHistory = await tx.projectHistory.findFirst({
          where: { projectId: spbRecord.projectId, exitDate: null },
          orderBy: { entryDate: "desc" },
        });

        if (lastHistory) {
          await tx.projectHistory.update({
            where: { id: lastHistory.id },
            data: { exitDate: new Date() },
          });
        }

        await tx.projectHistory.create({
          data: {
            projectId: spbRecord.projectId,
            division: "INVENTORY",
            status: "WAITING_INVENTORY",
            entryDate: new Date(),
            notes: `Project handed over to Inventory (SPB Approved by Direksi: ${spbRecord.spbNumber})`,
            updatedBy: direksiName,
          },
        });

        await tx.project.update({
          where: { id: spbRecord.projectId },
          data: {
            status: "WAITING_INVENTORY",
            ppicStatus: "APPROVED_BY_PPIC",
            spbCompletedAt: new Date(),
            poCompletedAt: new Date(),
            warehouseStatus: "PENDING",
            purchasingStatus: "WAITING_PO",
          },
        });
      }

      return updatedSpb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-direksi");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error approving SPB by Direksi:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyetujui SPB.") };
  }
}

export async function getPendingSPBForDireksi() {
  try {
    await requireRole(["Direktur", "Direksi", "Superadmin", "Admin"]);
    const pendingSpbs = await prisma.sPB.findMany({
      where: {
        status: "PENDING_APPROVAL",
        approvedByPpic: true,
        approvedByPm: true,
        approvedByDireksi: false,
      },
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        items: {
          include: {
            material: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: JSON.parse(JSON.stringify(pendingSpbs)) };
  } catch (error: any) {
    console.error("Error getPendingSPBForDireksi:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data SPB Direksi."),
      data: [],
    };
  }
}

export async function rejectSpb(spbId: string, reason: string) {
  try {
    await requireRole([
      "PPIC",
      "PM",
      "Direktur",
      "Direksi",
      "Superadmin",
      "Admin",
    ]);
    if (!reason || reason.trim() === "") {
      return { success: false, error: "Alasan penolakan harus diisi." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const spbRecord = await tx.sPB.findUnique({
        where: { id: spbId },
        include: { items: true },
      });

      if (!spbRecord) {
        throw new Error("SPB tidak ditemukan.");
      }

      if (spbRecord.status === "APPROVED" || spbRecord.status === "REJECTED") {
        throw new Error("SPB sudah selesai diproses (disetujui/ditolak).");
      }

      for (const item of spbRecord.items) {
        if (item.source === "WAREHOUSE" && item.materialId) {
          const material = await tx.item.findUnique({
            where: { id: item.materialId },
            select: { reservedStock: true },
          });
          if (material) {
            await tx.item.update({
              where: { id: item.materialId },
              data: {
                reservedStock: Math.max(0, (material.reservedStock || 0) - item.qty),
              },
            });
          }
        }
      }

      const updatedSpb = await tx.sPB.update({
        where: { id: spbId },
        data: {
          status: "REJECTED",
          rejectedReason: reason,
          rejectedAt: new Date(),
        },
      });

      return updatedSpb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-direksi");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error rejecting SPB:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menolak SPB.") };
  }
}

export async function getApprovalCounts() {
  try {
    await requireAuth();

    // Query pending vendor selections using Raw SQL (SPB Project + SPB Gudang)
    const engVendorCountRes: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM spb_items 
      WHERE ("vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
             OR ("selectedSupplierName" IS NOT NULL AND "vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE')))
        AND ("approvalEngineering" = 'NONE' OR "approvalEngineering" = 'PENDING' OR "approvalEngineering" IS NULL)
    `;

    // PM Vendor Count: SPB Project only, after PPIC approved
    const pmVendorCountRes: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM spb_items 
      WHERE ("vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
             OR ("selectedSupplierName" IS NOT NULL AND "vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE')))
        AND "approvalPpic" = 'APPROVED'
        AND ("approvalPm" = 'NONE' OR "approvalPm" = 'PENDING' OR "approvalPm" IS NULL)
    `;

    // PPIC Vendor Count: SPB Project + SPB Gudang
    const ppicProjectVendorCountRes: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM spb_items 
      WHERE ("vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
             OR ("selectedSupplierName" IS NOT NULL AND "vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE')))
        AND ("approvalPpic" = 'NONE' OR "approvalPpic" = 'PENDING' OR "approvalPpic" IS NULL)
    `;
    let ppicGudangVendorCountRes: any[] = [{ count: 0 }];
    try {
      ppicGudangVendorCountRes = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM spb_gudang_items 
        WHERE "source" = 'TRADING'
          AND ("vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
               OR ("selectedSupplierName" IS NOT NULL AND "vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE')))
          AND ("approvalPpic" = 'NONE' OR "approvalPpic" = 'PENDING' OR "approvalPpic" IS NULL)
      `;
    } catch (e) {}

    // Direksi Vendor Count: SPB Project (setelah PPIC AND PM approved) + SPB Gudang (setelah PPIC approved)
    const direksiProjectVendorCountRes: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM spb_items 
      WHERE ("vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
             OR ("selectedSupplierName" IS NOT NULL AND "vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE')))
        AND "approvalPpic" = 'APPROVED'
        AND "approvalPm" = 'APPROVED'
        AND ("approvalDireksi" = 'NONE' OR "approvalDireksi" = 'PENDING' OR "approvalDireksi" IS NULL)
    `;
    let direksiGudangVendorCountRes: any[] = [{ count: 0 }];
    try {
      direksiGudangVendorCountRes = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM spb_gudang_items 
        WHERE "source" = 'TRADING'
          AND ("vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
               OR ("selectedSupplierName" IS NOT NULL AND "vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE')))
          AND "approvalPpic" = 'APPROVED'
          AND ("approvalDireksi" = 'NONE' OR "approvalDireksi" = 'PENDING' OR "approvalDireksi" IS NULL)
      `;
    } catch (e) {}

    const engVendorCount = engVendorCountRes[0]?.count || 0;
    const pmVendorCount = pmVendorCountRes[0]?.count || 0;
    const ppicVendorCount = (ppicProjectVendorCountRes[0]?.count || 0) + (ppicGudangVendorCountRes[0]?.count || 0);
    const direksiVendorCount = (direksiProjectVendorCountRes[0]?.count || 0) + (direksiGudangVendorCountRes[0]?.count || 0);

    const [
      ppicSpb,
      ppicBoq,
      ppicSpj,
      ppicMemo,
      ppicSub,
      ppicSpbGudang,
      pmSpb,
      pmBoq,
      pmSpj,
      pmSub,
      engSub,
      direksiSpb,
      direksiSpbGudang,
      ppicPackages,
    ] = await Promise.all([
      prisma.sPB.count({
        where: {
          status: "PENDING_APPROVAL",
          approvedByPpic: false,
        },
      }),
      prisma.boQ.count({
        where: {
          boqStatus: "PENDING_APPROVAL",
          boqApprovedByPpic: false,
        },
      }),
      prisma.sPJ.count({
        where: {
          status: "PENDING_APPROVAL",
          approvedByPpic: false,
        },
      }),
      prisma.goodsReleaseMemo.count({
        where: {
          status: "PENDING",
        },
      }),
      prisma.sPBItem.count({
        where: {
          hasSubstitution: true,
          substitutionStatus: "PENDING_PPIC",
        },
      }),
      (prisma as any).spbGudang
        ? (prisma as any).spbGudang.count({
            where: {
              status: "PENDING_PPIC",
            },
          })
        : Promise.resolve(0),
      prisma.sPB.count({
        where: {
          status: "PENDING_APPROVAL",
          approvedByPpic: true,
          approvedByPm: false,
        },
      }),
      prisma.boQ.count({
        where: {
          boqStatus: "PENDING_APPROVAL",
          boqApprovedByPpic: true,
          boqApprovedByPm: false,
        },
      }),
      prisma.sPJ.count({
        where: {
          status: "PENDING_APPROVAL",
          approvedByPpic: true,
          approvedByPm: false,
        },
      }),
      prisma.sPBItem.count({
        where: {
          hasSubstitution: true,
          substitutionStatus: "PENDING_PM",
        },
      }),
      prisma.sPBItem.count({
        where: {
          hasSubstitution: true,
          OR: [
            { substitutionStatus: "PENDING_ENGINEERING" },
            { substitutionStatus: "" },
          ],
        },
      }),
      prisma.sPB.count({
        where: {
          status: "PENDING_APPROVAL",
          approvedByPpic: true,
          approvedByPm: true,
          approvedByDireksi: false,
        },
      }),
      (prisma as any).spbGudang
        ? (prisma as any).spbGudang.count({
            where: {
              status: "PENDING_DIREKSI",
            },
          })
        : Promise.resolve(0),
      prisma.shipmentPackage.count({
        where: {
          ppicStatus: "WAITING_APPROVAL",
        },
      }),
    ]);

    return {
      success: true,
      ppic: {
        spb: ppicSpb,
        boq: ppicBoq,
        spj: ppicSpj,
        memo: ppicMemo,
        substitutions: ppicSub,
        spbGudang: ppicSpbGudang || 0,
        vendorSelections: ppicVendorCount,
        packages: ppicPackages || 0,
        total:
          ppicSpb +
          ppicBoq +
          ppicSpj +
          ppicMemo +
          ppicSub +
          (ppicSpbGudang || 0) +
          ppicVendorCount +
          (ppicPackages || 0),
      },
      pm: {
        spb: pmSpb,
        boq: pmBoq,
        spj: pmSpj,
        substitutions: pmSub,
        vendorSelections: pmVendorCount,
        total: pmSpb + pmBoq + pmSpj + pmSub + pmVendorCount,
      },
      engineering: {
        substitutions: engSub,
        vendorSelections: 0,
        total: engSub,
      },
      direksi: {
        spb: direksiSpb,
        vendorSelections: direksiVendorCount,
        spbGudang: direksiSpbGudang || 0,
        total: direksiSpb + direksiVendorCount + (direksiSpbGudang || 0),
      },
    };
  } catch (error) {
    console.error("Error fetching approval counts:", error);
    return {
      success: false,
      ppic: { spb: 0, boq: 0, spj: 0, packages: 0, total: 0 },
      pm: { spb: 0, boq: 0, spj: 0, total: 0 },
      engineering: { substitutions: 0, vendorSelections: 0, total: 0 },
      direksi: { vendorSelections: 0, total: 0 },
    };
  }
}

/**
 * Syncs approved SPB items to Masterplan mechanical items
 */
export async function syncSpbToMasterplan(projectId: string) {
  try {
    const approvedSpbs = await prisma.sPB.findMany({
      where: { projectId, status: "APPROVED" },
      include: { items: true },
    });

    const spbItemMap = new Map<string, number>();
    for (const spb of approvedSpbs) {
      for (const item of spb.items) {
        const key = item.name.trim().toLowerCase();
        spbItemMap.set(key, (spbItemMap.get(key) || 0) + item.qty);
      }
    }

    const conveyorUnits = await prisma.conveyorUnit.findMany({
      where: { projectId },
      include: { mechanicalItems: true },
    });

    for (const unit of conveyorUnits) {
      for (const item of unit.mechanicalItems) {
        const key = item.name.trim().toLowerCase();
        const approvedQty = spbItemMap.get(key) || 0;
        if (approvedQty > 0) {
          const itemQty = Math.max(1, item.qty || 1);
          const newProcQty = Math.min(itemQty, approvedQty);
          const newPoQty = Math.min(itemQty, approvedQty);
          const isProcDone = newProcQty >= itemQty;
          const isPoDone = newPoQty >= itemQty;

          const merged = {
            ...item,
            procurementQty: newProcQty,
            poQty: newPoQty,
            procurementDone: isProcDone,
            poDone: isPoDone,
          };
          const newProgress = calcMechanicalItemProgress(merged);

          await prisma.mechanicalItem.update({
            where: { id: item.id },
            data: {
              procurementQty: newProcQty,
              poQty: newPoQty,
              procurementDone: isProcDone,
              poDone: isPoDone,
              progressPercent: newProgress,
            },
          });
        }
      }
    }
    revalidatePath("/trackers/production");
    revalidatePath("/trackers/ppic");
    return { success: true };
  } catch (err) {
    console.error("Error syncing SPB to Masterplan:", err);
    return { success: false, error: "Gagal auto-sync SPB ke Masterplan." };
  }
}

export async function resubmitSpb(spbId: string) {
  try {
    await requireRole(["PPIC", "Engineering", "Superadmin", "Admin"]);
    if (!spbId) return { success: false, error: "SPB ID required" };

    const session = await auth();
    const uBy = session?.user?.name || "User Pengaju";

    const result = await prisma.$transaction(async (tx) => {
      const spb = await tx.sPB.findUnique({
        where: { id: spbId },
        include: { items: true },
      });

      if (!spb) throw new Error("SPB tidak ditemukan.");

      const updatedSpb = await tx.sPB.update({
        where: { id: spbId },
        data: {
          status: "PENDING_APPROVAL",
          approvedByPpic: false,
          approvedByPm: false,
          rejectedReason: null,
          rejectedAt: null,
        },
      });

      await tx.sPBItem.updateMany({
        where: {
          spbId: spbId,
          status: "REJECTED",
        },
        data: {
          status: "PENDING",
        },
      });

      return updatedSpb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/production");

    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error resubmitting SPB:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengajukan kembali SPB.") };
  }
}

export interface UpdateSubstitutionInput {
  spbItemId: string;
  stage: "ENGINEERING" | "PPIC" | "PM" | string;
  action: "APPROVE" | "REJECT" | string;
}

export async function updateSPBItemSubstitution({
  spbItemId,
  stage,
  action,
}: UpdateSubstitutionInput) {
  try {
    if (!spbItemId || !stage || !action) {
      return {
        success: false,
        status: 400,
        error: "Parameter spbItemId, stage, dan action wajib diisi",
      };
    }

    const normStage = (stage || "").toUpperCase();
    const normAction = (action || "").toUpperCase();

    const validStages = ["ENGINEERING", "PPIC", "PM"];
    const validActions = ["APPROVE", "REJECT"];

    if (!validStages.includes(normStage)) {
      return {
        success: false,
        status: 400,
        error: "Stage tidak valid. Gunakan 'ENGINEERING', 'PPIC', atau 'PM'",
      };
    }

    if (!validActions.includes(normAction)) {
      return {
        success: false,
        status: 400,
        error: "Action tidak valid. Gunakan 'APPROVE' atau 'REJECT'",
      };
    }

    const item = await prisma.sPBItem.findUnique({
      where: { id: spbItemId },
      include: { spb: true },
    });

    if (!item || !item.hasSubstitution) {
      return {
        success: false,
        status: 404,
        error: "Pengajuan substitusi tidak ditemukan pada item ini",
      };
    }

    let updateData: any = {};
    let newSubstitutionStatus = item.substitutionStatus;

    if (normStage === "ENGINEERING") {
      if (normAction === "APPROVE") {
        updateData.approvalEngineering = "APPROVED";
        updateData.approvalPpic = "PENDING";
        newSubstitutionStatus = "PENDING_PPIC";
      } else {
        updateData.approvalEngineering = "REJECTED";
        newSubstitutionStatus = "REJECTED";
      }
    } else if (normStage === "PPIC") {
      if (item.approvalEngineering !== "APPROVED") {
        return {
          success: false,
          status: 400,
          error: "Approval Engineering belum disetujui",
        };
      }
      if (normAction === "APPROVE") {
        updateData.approvalPpic = "APPROVED";
        updateData.approvalPm = "PENDING";
        newSubstitutionStatus = "PENDING_PM";
      } else {
        updateData.approvalPpic = "REJECTED";
        newSubstitutionStatus = "REJECTED";
      }
    } else if (normStage === "PM") {
      if (item.approvalPpic !== "APPROVED") {
        return {
          success: false,
          status: 400,
          error: "Approval PPIC belum disetujui",
        };
      }
      if (normAction === "APPROVE") {
        updateData.approvalPm = "APPROVED";
        newSubstitutionStatus = "APPROVED";

        // Final deal item replacement
        if (item.substitutedName) {
          updateData.name = item.substitutedName;
        }
        if (item.substitutedTypeMerk) {
          updateData.typeMerk = item.substitutedTypeMerk;
        }
        if (item.substitutedMaterialId) {
          updateData.materialId = item.substitutedMaterialId;
        }
      } else {
        updateData.approvalPm = "REJECTED";
        newSubstitutionStatus = "REJECTED";
      }
    }

    updateData.substitutionStatus = newSubstitutionStatus;

    const updatedItem = await prisma.sPBItem.update({
      where: { id: spbItemId },
      data: updateData,
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");

    try {
      const session = await auth();
      const uBy = session?.user?.name || "User";
      await createNotification({
        title: `Persetujuan Substitusi SPB (${normStage})`,
        message: `${uBy} melakukan ${normAction} substitusi barang '${item.name}' pada SPB ${item.spb.spbNumber}.`,
        type: normAction === "APPROVE" ? "SUCCESS" : "WARNING",
        module: "DEFAULT",
        targetUrl: "/trackers/ppic",
      });
    } catch (e) {
      console.error("Failed notification for substitution update", e);
    }

    return {
      success: true,
      status: 200,
      message: `Status approval ${normStage} berhasil diperbarui (${normAction})`,
      spbItem: JSON.parse(JSON.stringify(updatedItem)),
    };
  } catch (error: any) {
    console.error("Error updating substitution status:", error);
    return {
      success: false,
      status: 500,
      error: sanitizeErrorMessage(error, "Gagal memperbarui status approval substitusi."),
    };
  }
}

export async function getPendingSPBSubstitutions(stage?: "ENGINEERING" | "PPIC" | "PM" | "ALL") {
  try {
    let whereClause: any = {
      hasSubstitution: true,
    };

    if (stage === "ENGINEERING") {
      whereClause.substitutionStatus = "PENDING_ENGINEERING";
    } else if (stage === "PPIC") {
      whereClause.substitutionStatus = "PENDING_PPIC";
    } else if (stage === "PM") {
      whereClause.substitutionStatus = "PENDING_PM";
    }

    const items = await prisma.sPBItem.findMany({
      where: whereClause,
      include: {
        material: true,
        spb: {
          include: {
            project: {
              include: {
                customer: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const substitutedMaterialIds = items
      .map((i: any) => i.substitutedMaterialId)
      .filter(Boolean) as string[];

    if (substitutedMaterialIds.length > 0) {
      const subMaterials = await prisma.item.findMany({
        where: { id: { in: substitutedMaterialIds } },
      });
      const subMatMap = new Map(subMaterials.map((m) => [m.id, m]));
      items.forEach((item: any) => {
        if (item.substitutedMaterialId && subMatMap.has(item.substitutedMaterialId)) {
          item.substitutedMaterial = subMatMap.get(item.substitutedMaterialId);
        }
      });
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(items)),
    };
  } catch (error: any) {
    console.error("Error fetching pending SPB substitutions:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data pengajuan substitusi."),
      data: [],
    };
  }
}

export async function getPendingSPBVendorSelection(stage: "PPIC" | "ENGINEERING" | "PM" | "DIREKSI" | "ALL") {
  try {
    // 1. Ambil data mentah spb_items (SPB Project)
    const rawProjectItems: any[] = await prisma.$queryRaw`
      SELECT i.*, 'PROJECT' as "itemType"
      FROM spb_items i
      WHERE i."vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
         OR (i."selectedSupplierName" IS NOT NULL AND i."vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE'))
    `;

    // 2. Ambil data mentah spb_gudang_items (SPB Gudang) - hanya untuk PPIC & DIREKSI (PM tidak mengelola SPB Gudang)
    let rawGudangItems: any[] = [];
    if (stage !== "PM" && stage !== "ENGINEERING") {
      try {
        rawGudangItems = await prisma.$queryRaw`
          SELECT gi.*, 'GUDANG' as "itemType"
          FROM spb_gudang_items gi
          WHERE gi."source" = 'TRADING'
            AND (
              gi."vendorSelectionStatus" IN ('SUBMITTED', 'PENDING_PPIC', 'PENDING_PM', 'PENDING_DIREKSI', 'PENDING_APPROVAL', 'PENDING')
              OR (gi."selectedSupplierName" IS NOT NULL AND gi."vendorSelectionStatus" NOT IN ('APPROVED', 'REJECTED', 'NONE'))
            )
        `;
      } catch (e) {
        console.error("Error fetching raw spb_gudang_items for vendor selection:", e);
      }
    }

    // 3. Filter berdasarkan tahap (stage): PPIC (Stage 1) -> PM (Stage 2) -> DIREKSI (Stage 3)
    const filterByStage = (items: any[]) => {
      return items.filter((item: any) => {
        const appPpic = item.approvalPpic || "NONE";
        const appPm = item.approvalPm || "NONE";
        const appDireksi = item.approvalDireksi || "NONE";
        const isGudang = item.itemType === "GUDANG";

        if (stage === "PPIC") {
          return appPpic === "NONE" || appPpic === "PENDING";
        } else if (stage === "PM") {
          if (isGudang) return false;
          return (
            appPpic === "APPROVED" &&
            (appPm === "NONE" || appPm === "PENDING")
          );
        } else if (stage === "DIREKSI") {
          if (isGudang) {
            // SPB Gudang: butuh persetujuan PPIC
            return (
              appPpic === "APPROVED" &&
              (appDireksi === "NONE" || appDireksi === "PENDING")
            );
          } else {
            // SPB Project: butuh persetujuan PPIC dan PM (PPIC > PM > Direksi)
            return (
              appPpic === "APPROVED" &&
              appPm === "APPROVED" &&
              (appDireksi === "NONE" || appDireksi === "PENDING")
            );
          }
        }
        return true;
      });
    };

    const filteredProjectItems = filterByStage(rawProjectItems);
    const filteredGudangItems = filterByStage(rawGudangItems);

    if (filteredProjectItems.length === 0 && filteredGudangItems.length === 0) {
      return { success: true, data: [] };
    }

    // 4. Populate relasi untuk SPB Project
    const spbIds = Array.from(new Set(filteredProjectItems.map((it) => it.spbId).filter(Boolean)));
    let spbMap = new Map();
    if (spbIds.length > 0) {
      const spbs = await prisma.sPB.findMany({
        where: { id: { in: spbIds } },
        include: {
          project: {
            include: {
              customer: true,
            },
          },
        },
      });
      spbMap = new Map(spbs.map((s) => [s.id, s]));
    }

    // 5. Populate relasi untuk SPB Gudang
    const gudangSpbIds = Array.from(new Set(filteredGudangItems.map((it) => it.spbGudangId).filter(Boolean)));
    let gudangSpbMap = new Map();
    if (gudangSpbIds.length > 0) {
      const gudangSpbs = await (prisma as any).spbGudang.findMany({
        where: { id: { in: gudangSpbIds } },
        include: {
          project: {
            include: {
              customer: true,
            },
          },
        },
      });
      gudangSpbMap = new Map(gudangSpbs.map((g: any) => [g.id, g]));
    }

    const populatedProjectItems = filteredProjectItems.map((item) => ({
      ...item,
      itemType: "PROJECT",
      spb: spbMap.get(item.spbId) || null,
    }));

    const populatedGudangItems = filteredGudangItems.map((item) => {
      const parentGudang = gudangSpbMap.get(item.spbGudangId);
      return {
        ...item,
        itemType: "GUDANG",
        spbId: item.spbGudangId,
        spb: parentGudang
          ? {
              id: parentGudang.id,
              spbNumber: parentGudang.spbNumber,
              spbType: "GUDANG",
              makerName: parentGudang.makerName,
              createdAt: parentGudang.createdAt,
              project: parentGudang.project || {
                projectName: "Gudang Utama (Stok & Trading)",
                projectNumber: parentGudang.spbNumber,
                customer: null,
              },
            }
          : {
              spbNumber: "SPB Gudang",
              spbType: "GUDANG",
              project: {
                projectName: "Gudang Utama (Stok & Trading)",
                projectNumber: "-",
                customer: null,
              },
            },
      };
    });

    const allVendorItems = [...populatedProjectItems, ...populatedGudangItems];

    return {
      success: true,
      data: JSON.parse(JSON.stringify(allVendorItems)),
    };
  } catch (error: any) {
    console.error("Error fetching pending SPB vendor selections:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data pengajuan vendor."),
      data: [],
    };
  }
}

export interface RequestSubstitutionInput {
  spbItemId: string;
  substitutedName: string;
  substitutedTypeMerk?: string;
  substitutedMaterialId?: string;
  substitutionReason: string;
  requestedBy?: string;
}

export async function requestSPBItemSubstitution({
  spbItemId,
  substitutedName,
  substitutedTypeMerk,
  substitutedMaterialId,
  substitutionReason,
  requestedBy,
}: RequestSubstitutionInput) {
  try {
    if (!spbItemId || !substitutedName || !substitutionReason) {
      return {
        success: false,
        error: "Item SPB, nama barang pengganti, dan alasan substitusi wajib diisi",
      };
    }

    const item = await prisma.sPBItem.findUnique({
      where: { id: spbItemId },
      include: { spb: true },
    });

    if (!item) {
      return { success: false, error: "Item SPB tidak ditemukan" };
    }

    const updatedItem = await prisma.sPBItem.update({
      where: { id: spbItemId },
      data: {
        hasSubstitution: true,
        substitutedName,
        substitutedTypeMerk: substitutedTypeMerk || null,
        substitutedMaterialId: substitutedMaterialId || null,
        substitutionReason,
        substitutionStatus: "PENDING_ENGINEERING",
        approvalEngineering: "PENDING",
        approvalPpic: "PENDING",
        approvalPm: "PENDING",
      },
    });

    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");

    try {
      await createNotification({
        title: "Permintaan Substitusi Barang SPB Baru",
        message: `${requestedBy || "Pengguna"} mengajukan substitusi barang '${item.name}' menjadi '${substitutedName}' pada SPB ${item.spb.spbNumber}. Membutuhkan persetujuan Engineering.`,
        type: "INFO",
        module: "DEFAULT",
        targetUrl: "/trackers/engineering",
      });
    } catch (e) {
      console.error("Notification error:", e);
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedItem)),
      message: "Permintaan substitusi barang berhasil dikirim ke Engineering!",
    };
  } catch (error: any) {
    console.error("Error requesting SPB item substitution:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengajukan substitusi barang."),
    };
  }
}

export async function recommendSpbItemByEngineering(
  spbItemId: string,
  recommendedSupplierId: string,
  note?: string
) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin"]);

    const rawItems: any[] = await prisma.$queryRaw`
      SELECT id, "candidateSuppliers" FROM spb_items WHERE id = ${spbItemId}
    `;

    const item = rawItems[0];
    if (!item) {
      return { success: false, error: "Item SPB tidak ditemukan" };
    }

    let candidates = item.candidateSuppliers || [];
    if (typeof candidates === "string") {
      try {
        candidates = JSON.parse(candidates);
      } catch (e) {
        candidates = [];
      }
    }

    if (Array.isArray(candidates)) {
      candidates = candidates.map((cand: any) => {
        const isTarget = cand.supplierId === recommendedSupplierId;
        return {
          ...cand,
          recommendedByEng: isTarget,
          engNote: isTarget ? note?.trim() || null : cand.engNote,
        };
      });
    }

    const candidatesJson = JSON.stringify(candidates);

    await prisma.$executeRaw`
      UPDATE spb_items
      SET 
        "approvalEngineering" = 'APPROVED',
        "candidateSuppliers" = ${candidatesJson}::jsonb,
        "updatedAt" = NOW()
      WHERE id = ${spbItemId}
    `;

    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/spb-approval-engineering");
    revalidatePath("/trackers/ppic");

    return { success: true };
  } catch (error: any) {
    console.error("Error recommendSpbItemByEngineering:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memberikan rekomendasi Engineering."),
    };
  }
}

export async function recommendSpbItemByPm(
  spbItemId: string,
  recommendedSupplierId: string,
  note?: string
) {
  try {
    await requireRole(["Project Manager", "Superadmin", "Admin"]);

    const rawItems: any[] = await prisma.$queryRaw`
      SELECT id, "candidateSuppliers" FROM spb_items WHERE id = ${spbItemId}
    `;

    const item = rawItems[0];
    if (!item) {
      return { success: false, error: "Item SPB tidak ditemukan" };
    }

    let candidates = item.candidateSuppliers || [];
    if (typeof candidates === "string") {
      try {
        candidates = JSON.parse(candidates);
      } catch (e) {
        candidates = [];
      }
    }

    if (Array.isArray(candidates)) {
      candidates = candidates.map((cand: any) => {
        const isTarget = cand.supplierId === recommendedSupplierId;
        return {
          ...cand,
          recommendedByPm: isTarget,
          pmNote: isTarget ? note?.trim() || null : cand.pmNote,
        };
      });
    }

    const candidatesJson = JSON.stringify(candidates);

    await prisma.$executeRaw`
      UPDATE spb_items
      SET 
        "approvalPm" = 'APPROVED',
        "candidateSuppliers" = ${candidatesJson}::jsonb,
        "updatedAt" = NOW()
      WHERE id = ${spbItemId}
    `;

    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/spb-approval-direksi");
    revalidatePath("/trackers/ppic");

    return { success: true };
  } catch (error: any) {
    console.error("Error recommendSpbItemByPm:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memberikan rekomendasi PM."),
    };
  }
}

/**
 * ----------------------------------------------------
 * SPB GUDANG ACTIONS (PPIC & DIREKSI APPROVAL)
 * ----------------------------------------------------
 */

export async function getPendingSPBGudangForPpic() {
  try {
    const list = await (prisma as any).spbGudang.findMany({
      where: {
        status: "PENDING_PPIC",
      },
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(list)),
    };
  } catch (error: any) {
    console.error("Error getPendingSPBGudangForPpic:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil SPB Gudang PPIC."), data: [] };
  }
}

export async function getPendingSPBGudangForDireksi() {
  try {
    const list = await (prisma as any).spbGudang.findMany({
      where: {
        status: "PENDING_DIREKSI",
      },
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(list)),
    };
  } catch (error: any) {
    console.error("Error getPendingSPBGudangForDireksi:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil SPB Gudang Direksi."), data: [] };
  }
}

export async function approveSPBGudangByPpic(spbId: string, note?: string) {
  try {
    await requireRole(["PPIC", "Superadmin", "Admin"]);

    const spb = await (prisma as any).spbGudang.findUnique({
      where: { id: spbId },
      include: { items: true },
    });

    if (!spb) {
      return { success: false, error: "Data SPB Gudang tidak ditemukan" };
    }

    const now = new Date();
    await (prisma as any).spbGudang.update({
      where: { id: spbId },
      data: {
        status: "PENDING_DIREKSI",
        approvedByPpic: true,
        approvedByPpicAt: now,
      },
    });

    for (const item of spb.items || []) {
      await (prisma as any).spbGudangItem.update({
        where: { id: item.id },
        data: {
          status: "PENDING_DIREKSI",
          approvalPpic: "APPROVED",
        },
      });
    }

    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-direksi");

    return {
      success: true,
      message: `SPB Gudang ${spb.spbNumber} berhasil disetujui PPIC dan diteruskan ke Direksi!`,
    };
  } catch (error: any) {
    console.error("Error approveSPBGudangByPpic:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyetujui SPB Gudang PPIC.") };
  }
}

export async function approveSPBGudangByDireksi(spbId: string, note?: string) {
  try {
    await requireRole(["Direksi", "Superadmin", "Admin"]);

    const spb = await (prisma as any).spbGudang.findUnique({
      where: { id: spbId },
      include: { items: true },
    });

    if (!spb) {
      return { success: false, error: "Data SPB Gudang tidak ditemukan" };
    }

    const now = new Date();

    // 1. Update status SPB Gudang ke APPROVED
    await (prisma as any).spbGudang.update({
      where: { id: spbId },
      data: {
        status: "APPROVED",
        approvedByDireksi: true,
        approvedByDireksiAt: now,
      },
    });

    // 2. Auto-routing items berdasarkan source & pastikan approvalPpic dan approvalDireksi ter-set APPROVED
    for (const item of spb.items || []) {
      const src = (item.source || "").toUpperCase();
      const targetItemStatus = src === "TRADING" ? "PO_PENDING" : "APPROVED_WAREHOUSE";

      await (prisma as any).spbGudangItem.update({
        where: { id: item.id },
        data: {
          status: targetItemStatus,
          approvalPpic: "APPROVED",
          approvalDireksi: "APPROVED",
        },
      });
    }

    revalidatePath("/trackers/spb-approval-direksi");
    revalidatePath("/purchasing/spb");
    revalidatePath("/permintaan-stok");

    return {
      success: true,
      message: `SPB Gudang ${spb.spbNumber} telah disetujui Direksi (Final) dan item berhasil di-routing!`,
    };
  } catch (error: any) {
    console.error("Error approveSPBGudangByDireksi:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyetujui SPB Gudang Direksi.") };
  }
}

export async function rejectSPBGudang(spbId: string, stage: "PPIC" | "DIREKSI", rejectReason: string) {
  try {
    await requireRole(["PPIC", "Direksi", "Superadmin", "Admin"]);

    if (!rejectReason || !rejectReason.trim()) {
      return { success: false, error: "Alasan penolakan (Reject) wajib diisi" };
    }

    const spb = await (prisma as any).spbGudang.findUnique({
      where: { id: spbId },
      include: { items: true },
    });

    if (!spb) {
      return { success: false, error: "Data SPB Gudang tidak ditemukan" };
    }

    const now = new Date();
    await (prisma as any).spbGudang.update({
      where: { id: spbId },
      data: {
        status: "REJECTED",
        rejectedReason: rejectReason.trim(),
        rejectedAt: now,
      },
    });

    for (const item of spb.items || []) {
      await (prisma as any).spbGudangItem.update({
        where: { id: item.id },
        data: {
          status: "REJECTED",
          approvalPpic: stage === "PPIC" ? "REJECTED" : (item.approvalPpic || "APPROVED"),
          approvalDireksi: stage === "DIREKSI" ? "REJECTED" : (item.approvalDireksi || "NONE"),
        },
      });
    }

    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-direksi");

    return {
      success: true,
      message: `SPB Gudang ${spb.spbNumber} berhasil ditolak (${stage}).`,
    };
  } catch (error: any) {
    console.error("Error rejectSPBGudang:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menolak SPB Gudang.") };
  }
}

/**
 * ----------------------------------------------------
 * VENDOR APPROVAL ACTIONS (PPIC, PM, & DIREKSI APPROVE / REJECT)
 * Unified for SPB Project (spb_items) & SPB Gudang (spb_gudang_items)
 * ----------------------------------------------------
 */

export async function approveVendorSelection(
  itemId: string,
  itemType: "PROJECT" | "GUDANG" = "PROJECT",
  stage: "PPIC" | "PM" | "DIREKSI" = "DIREKSI",
  note?: string
) {
  try {
    if (stage === "PPIC") {
      await requireRole(["PPIC", "Superadmin", "Admin"]);
      if (itemType === "GUDANG") {
        await prisma.$executeRaw`
          UPDATE spb_gudang_items
          SET 
            "approvalPpic" = 'APPROVED',
            "vendorSelectionStatus" = 'PENDING_DIREKSI',
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE spb_items
          SET 
            "approvalPpic" = 'APPROVED',
            "vendorSelectionStatus" = 'PENDING_PM',
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      }
    } else if (stage === "PM") {
      await requireRole(["Project Manager", "Superadmin", "Admin"]);
      await prisma.$executeRaw`
        UPDATE spb_items
        SET 
          "approvalPm" = 'APPROVED',
          "vendorSelectionStatus" = 'PENDING_DIREKSI',
          "updatedAt" = NOW()
        WHERE id = ${itemId}
      `;
    } else {
      // DIREKSI (Final Stage)
      await requireRole(["Direksi", "Superadmin", "Admin"]);
      if (itemType === "GUDANG") {
        await prisma.$executeRaw`
          UPDATE spb_gudang_items
          SET 
            "approvalPpic" = 'APPROVED',
            "approvalDireksi" = 'APPROVED',
            "vendorSelectionStatus" = 'APPROVED',
            "status" = 'PO_PENDING',
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE spb_items
          SET 
            "approvalDireksi" = 'APPROVED',
            "vendorSelectionStatus" = 'APPROVED',
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      }
    }

    // Auto-sync masterplan procurement progress if linked to project
    try {
      if (itemType === "PROJECT") {
        const rawProj: any[] = await prisma.$queryRaw`
          SELECT s."projectId" 
          FROM spb_items i 
          JOIN spb s ON i."spbId" = s.id 
          WHERE i.id = ${itemId}
        `;
        if (rawProj.length > 0 && rawProj[0]?.projectId) {
          const { syncProcurementMasterplanProgress } = await import("@/app/actions/masterplan");
          await syncProcurementMasterplanProgress(rawProj[0].projectId);
        }
      }
    } catch (syncErr) {
      console.error("Error auto-syncing masterplan procurement in approveVendorSelection:", syncErr);
    }

    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-direksi");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/production");

    return {
      success: true,
      message: `Persetujuan Vendor (${stage}) berhasil disimpan!`,
    };
  } catch (error: any) {
    console.error("Error approveVendorSelection:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyetujui Vendor."),
    };
  }
}

export async function rejectVendorSelection(
  itemId: string,
  itemType: "PROJECT" | "GUDANG" = "PROJECT",
  stage: "PPIC" | "PM" | "DIREKSI" = "DIREKSI",
  rejectReason: string
) {
  try {
    if (stage === "PPIC") {
      await requireRole(["PPIC", "Superadmin", "Admin"]);
    } else if (stage === "PM") {
      await requireRole(["Project Manager", "Superadmin", "Admin"]);
    } else {
      await requireRole(["Direksi", "Superadmin", "Admin"]);
    }

    if (!rejectReason || !rejectReason.trim()) {
      return { success: false, error: "Alasan penolakan vendor wajib diisi" };
    }

    if (itemType === "GUDANG") {
      if (stage === "PPIC") {
        await prisma.$executeRaw`
          UPDATE spb_gudang_items
          SET 
            "approvalPpic" = 'REJECTED',
            "vendorSelectionStatus" = 'REJECTED',
            "vendorSelectionNote" = ${rejectReason.trim()},
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE spb_gudang_items
          SET 
            "approvalDireksi" = 'REJECTED',
            "vendorSelectionStatus" = 'REJECTED',
            "vendorSelectionNote" = ${rejectReason.trim()},
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      }
    } else {
      if (stage === "PPIC") {
        await prisma.$executeRaw`
          UPDATE spb_items
          SET 
            "approvalPpic" = 'REJECTED',
            "vendorSelectionStatus" = 'REJECTED',
            "vendorSelectionNote" = ${rejectReason.trim()},
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      } else if (stage === "PM") {
        await prisma.$executeRaw`
          UPDATE spb_items
          SET 
            "approvalPm" = 'REJECTED',
            "vendorSelectionStatus" = 'REJECTED',
            "vendorSelectionNote" = ${rejectReason.trim()},
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE spb_items
          SET 
            "approvalDireksi" = 'REJECTED',
            "vendorSelectionStatus" = 'REJECTED',
            "vendorSelectionNote" = ${rejectReason.trim()},
            "updatedAt" = NOW()
          WHERE id = ${itemId}
        `;
      }
    }

    // Auto-sync masterplan procurement progress if linked to project
    try {
      if (itemType === "PROJECT") {
        const rawProj: any[] = await prisma.$queryRaw`
          SELECT s."projectId" 
          FROM spb_items i 
          JOIN spb s ON i."spbId" = s.id 
          WHERE i.id = ${itemId}
        `;
        if (rawProj.length > 0 && rawProj[0]?.projectId) {
          const { syncProcurementMasterplanProgress } = await import("@/app/actions/masterplan");
          await syncProcurementMasterplanProgress(rawProj[0].projectId);
        }
      }
    } catch (syncErr) {
      console.error("Error auto-syncing masterplan procurement in rejectVendorSelection:", syncErr);
    }

    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-direksi");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/production");

    return {
      success: true,
      message: `Pengajuan Vendor berhasil ditolak (${stage}).`,
    };
  } catch (error: any) {
    console.error("Error rejectVendorSelection:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menolak Vendor."),
    };
  }
}

// Backwards-compatible convenience wrappers
export async function approveVendorSelectionByPm(spbItemId: string, note?: string) {
  return approveVendorSelection(spbItemId, "PROJECT", "PM", note);
}

export async function rejectVendorSelectionByPm(spbItemId: string, rejectReason: string) {
  return rejectVendorSelection(spbItemId, "PROJECT", "PM", rejectReason);
}

export async function approveVendorSelectionByDireksi(
  spbItemId: string,
  arg2?: "PROJECT" | "GUDANG" | string,
  arg3?: "PROJECT" | "GUDANG" | string
) {
  const itemType: "PROJECT" | "GUDANG" =
    arg2 === "GUDANG" || arg3 === "GUDANG" ? "GUDANG" : "PROJECT";
  const note =
    typeof arg2 === "string" && arg2 !== "PROJECT" && arg2 !== "GUDANG"
      ? arg2
      : typeof arg3 === "string" && arg3 !== "PROJECT" && arg3 !== "GUDANG"
      ? arg3
      : undefined;
  return approveVendorSelection(spbItemId, itemType, "DIREKSI", note);
}

export async function rejectVendorSelectionByDireksi(
  spbItemId: string,
  rejectReason: string,
  itemType: "PROJECT" | "GUDANG" = "PROJECT"
) {
  return rejectVendorSelection(spbItemId, itemType, "DIREKSI", rejectReason);
}

export async function approveVendorSelectionByPpic(
  spbItemId: string,
  arg2?: "PROJECT" | "GUDANG" | string,
  arg3?: "PROJECT" | "GUDANG" | string
) {
  const itemType: "PROJECT" | "GUDANG" =
    arg2 === "GUDANG" || arg3 === "GUDANG" ? "GUDANG" : "PROJECT";
  const note =
    typeof arg2 === "string" && arg2 !== "PROJECT" && arg2 !== "GUDANG"
      ? arg2
      : typeof arg3 === "string" && arg3 !== "PROJECT" && arg3 !== "GUDANG"
      ? arg3
      : undefined;
  return approveVendorSelection(spbItemId, itemType, "PPIC", note);
}

export async function rejectVendorSelectionByPpic(
  spbItemId: string,
  rejectReason: string,
  itemType: "PROJECT" | "GUDANG" = "PROJECT"
) {
  return rejectVendorSelection(spbItemId, itemType, "PPIC", rejectReason);
}

export async function batchApproveVendorSelection(
  items: Array<{ id: string; itemType?: "PROJECT" | "GUDANG" }>,
  stage: "PPIC" | "PM" | "DIREKSI" = "DIREKSI"
) {
  try {
    if (!items || items.length === 0) {
      return { success: false, error: "Tidak ada item untuk disetujui." };
    }

    if (stage === "PPIC") {
      await requireRole(["PPIC", "Superadmin", "Admin"]);
    } else if (stage === "PM") {
      await requireRole(["Project Manager", "Superadmin", "Admin"]);
    } else {
      await requireRole(["Direksi", "Superadmin", "Admin"]);
    }

    const gudangItemIds = items
      .filter((it) => it.itemType === "GUDANG")
      .map((it) => it.id);
    const projectItemIds = items
      .filter((it) => it.itemType !== "GUDANG")
      .map((it) => it.id);

    await prisma.$transaction(async (tx) => {
      if (stage === "PPIC") {
        if (gudangItemIds.length > 0) {
          await tx.spbGudangItem.updateMany({
            where: { id: { in: gudangItemIds } },
            data: {
              approvalPpic: "APPROVED",
              vendorSelectionStatus: "PENDING_DIREKSI",
              updatedAt: new Date(),
            },
          });
        }
        if (projectItemIds.length > 0) {
          await tx.sPBItem.updateMany({
            where: { id: { in: projectItemIds } },
            data: {
              approvalPpic: "APPROVED",
              vendorSelectionStatus: "PENDING_PM",
              updatedAt: new Date(),
            },
          });
        }
      } else if (stage === "PM") {
        if (projectItemIds.length > 0) {
          await tx.sPBItem.updateMany({
            where: { id: { in: projectItemIds } },
            data: {
              approvalPm: "APPROVED",
              vendorSelectionStatus: "PENDING_DIREKSI",
              updatedAt: new Date(),
            },
          });
        }
      } else {
        // DIREKSI
        if (gudangItemIds.length > 0) {
          await tx.spbGudangItem.updateMany({
            where: { id: { in: gudangItemIds } },
            data: {
              approvalPpic: "APPROVED",
              approvalDireksi: "APPROVED",
              vendorSelectionStatus: "APPROVED",
              status: "PO_PENDING",
              updatedAt: new Date(),
            },
          });
        }
        if (projectItemIds.length > 0) {
          await tx.sPBItem.updateMany({
            where: { id: { in: projectItemIds } },
            data: {
              approvalDireksi: "APPROVED",
              vendorSelectionStatus: "APPROVED",
              updatedAt: new Date(),
            },
          });
        }
      }
    });

    // Auto-sync masterplan procurement progress for affected projects
    if (projectItemIds.length > 0) {
      try {
        const rawProjs = await prisma.sPBItem.findMany({
          where: { id: { in: projectItemIds } },
          select: {
            spb: {
              select: { projectId: true },
            },
          },
        });
        const uniqueProjectIds = Array.from(
          new Set(
            rawProjs
              .map((item) => item.spb?.projectId)
              .filter((id): id is string => Boolean(id))
          )
        );
        if (uniqueProjectIds.length > 0) {
          const { syncProcurementMasterplanProgress } = await import(
            "@/app/actions/masterplan"
          );
          for (const projId of uniqueProjectIds) {
            await syncProcurementMasterplanProgress(projId);
          }
        }
      } catch (syncErr) {
        console.error(
          "Error auto-syncing masterplan procurement in batchApproveVendorSelection:",
          syncErr
        );
      }
    }

    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-direksi");
    revalidatePath("/trackers/spb-approval-pm");
    revalidatePath("/trackers/production");

    return {
      success: true,
      message: `Semua pilihan vendor (${items.length} barang) berhasil disetujui (${stage})!`,
    };
  } catch (error: any) {
    console.error("Error batchApproveVendorSelection:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyetujui semua vendor."),
    };
  }
}

export async function batchApproveVendorSelectionByPpic(
  items: Array<{ id: string; itemType?: "PROJECT" | "GUDANG" }>
) {
  return batchApproveVendorSelection(items, "PPIC");
}

export async function batchApproveVendorSelectionByPm(
  items: Array<{ id: string; itemType?: "PROJECT" | "GUDANG" }>
) {
  return batchApproveVendorSelection(items, "PM");
}

export async function batchApproveVendorSelectionByDireksi(
  items: Array<{ id: string; itemType?: "PROJECT" | "GUDANG" }>
) {
  return batchApproveVendorSelection(items, "DIREKSI");
}



