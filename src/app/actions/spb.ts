"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";
import { requireAuth, requireRole } from "@/lib/auth-guard";

export interface CreateSPBItemInput {
  name: string;
  qty: number;
  source: string; // WAREHOUSE or TRADING
  unit: string;
  note?: string;
  materialId?: string;
  typeMerk?: string;
}

export async function createSPB(projectId: string, items: CreateSPBItemInput[], customSpbNumber?: string) {
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
    return { success: false, error: error?.message || "Failed to create SPB" };
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

      if (spb.status !== "PENDING_APPROVAL") {
        throw new Error("SPB yang sudah diproses tidak dapat dihapus.");
      }

      // Revert reservedStock for old WAREHOUSE items
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

      // Delete the SPB record (cascade delete handles spb_items)
      await tx.sPB.delete({
        where: { id: spbId },
      });

      return spb;
    });

    revalidatePath("/trackers/ppic");

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
    return { success: false, error: error?.message || "Failed to delete SPB" };
  }
}

export async function updateSPB(spbId: string, items: CreateSPBItemInput[], customSpbNumber?: string) {
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
    return { success: false, error: error?.message || "Failed to update SPB" };
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

      // If at least 1 item is finished and the project is currently in the INVENTORY division,
      // trigger "Inventory Accepted" (which automatically updates currentDivision to PRODUCTION)
      if (hasCompletedItem && project.currentDivision === "INVENTORY") {
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
            currentDivision: "PRODUCTION",
            currentStatus: "INVENTORY_ACCEPTED",
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
    return { success: false, error: error.message || "Failed to update SPB item status" };
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

      const isFullyApproved = spbRecord.approvedByPm;

      const updatedSpb = await tx.sPB.update({
        where: { id: spbId },
        data: {
          approvedByPpic: true,
          approvedByPpicAt: new Date(),
          mengetahuiName: userName,
          status: isFullyApproved ? "APPROVED" : "PENDING_APPROVAL",
        },
      });

      if (isFullyApproved) {
        const projectRecord = await tx.project.findUnique({
          where: { id: spbRecord.projectId },
        });
        if (projectRecord && projectRecord.currentDivision === "PPIC") {
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
              notes: `Project handed over to Inventory (SPB Approved: ${spbRecord.spbNumber})`,
              updatedBy: userName,
            },
          });

          await tx.project.update({
            where: { id: spbRecord.projectId },
            data: {
              status: "WAITING_INVENTORY",
              currentDivision: "INVENTORY",
              currentStatus: "WAITING_INVENTORY",
              ppicStatus: "APPROVED_BY_PPIC",
              ppicCompletedAt: new Date(),
              warehouseStatus: "PENDING",
              purchasingStatus: "WAITING_PO",
            },
          });
        }
      }

      return updatedSpb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error approving SPB by PPIC:", error);
    return { success: false, error: error.message || "Gagal menyetujui SPB." };
  }
}

export async function approveSpbByPm(spbId: string, pmNameInput?: string) {
  try {
    await requireRole(["PM", "Superadmin", "Admin"]);
    const session = await auth();
    // Resolve PM Name directly from session to prevent parameter spoofing (C2)
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

      const isFullyApproved = spbRecord.approvedByPpic;

      const updatedSpb = await tx.sPB.update({
        where: { id: spbId },
        data: {
          approvedByPm: true,
          approvedByPmAt: new Date(),
          menyetujuiName: pmName,
          status: isFullyApproved ? "APPROVED" : "PENDING_APPROVAL",
        },
      });

      if (isFullyApproved) {
        const projectRecord = await tx.project.findUnique({
          where: { id: spbRecord.projectId },
        });
        if (projectRecord && projectRecord.currentDivision === "PPIC") {
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
              notes: `Project handed over to Inventory (SPB Approved: ${spbRecord.spbNumber})`,
              updatedBy: pmName,
            },
          });

          await tx.project.update({
            where: { id: spbRecord.projectId },
            data: {
              status: "WAITING_INVENTORY",
              currentDivision: "INVENTORY",
              currentStatus: "WAITING_INVENTORY",
              ppicStatus: "APPROVED_BY_PPIC",
              ppicCompletedAt: new Date(),
              warehouseStatus: "PENDING",
              purchasingStatus: "WAITING_PO",
            },
          });
        }
      }

      return updatedSpb;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/spb-approval-pm");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error approving SPB by PM:", error);
    return { success: false, error: error.message || "Gagal menyetujui SPB." };
  }
}

export async function rejectSpb(spbId: string, reason: string) {
  try {
    await requireRole(["PPIC", "PM", "Superadmin", "Admin"]);
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
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error rejecting SPB:", error);
    return { success: false, error: error.message || "Gagal menolak SPB." };
  }
}

export async function getApprovalCounts() {
  try {
    await requireAuth();
    const [ppicSpb, ppicBoq, pmSpb, pmBoq] = await Promise.all([
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
    ]);

    return {
      success: true,
      ppic: {
        spb: ppicSpb,
        boq: ppicBoq,
        total: ppicSpb + ppicBoq,
      },
      pm: {
        spb: pmSpb,
        boq: pmBoq,
        total: pmSpb + pmBoq,
      },
    };
  } catch (error) {
    console.error("Error fetching approval counts:", error);
    return {
      success: false,
      ppic: { spb: 0, boq: 0, total: 0 },
      pm: { spb: 0, boq: 0, total: 0 },
    };
  }
}

