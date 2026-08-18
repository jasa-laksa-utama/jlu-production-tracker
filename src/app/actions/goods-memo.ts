"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { auth } from "@/auth";

export interface GoodsMemoItemInput {
  itemId?: string;
  itemCode?: string;
  itemName: string;
  typeMerk?: string;
  itemType: "CONSUMABLE" | "NON_CONSUMABLE"; // CONSUMABLE = Sekali Pakai, NON_CONSUMABLE = Alat / Equipment
  qtyRequested: number;
  unit: string;
  notes?: string;
}

export interface CreateGoodsMemoInput {
  projectId?: string;
  requesterName: string;
  division?: string;
  notes?: string;
  items: GoodsMemoItemInput[];
}

export interface RecordReturnInput {
  memoId: string;
  returnedBy: string;
  notes?: string;
  items: Array<{
    memoItemId: string;
    qtyReturned: number;
    condition: "SURPLUS" | "RETURNED_TOOL" | "DAMAGED";
    notes?: string;
  }>;
}

/**
 * Creates a new Goods Release Memo (Request Memo Pengeluaran Barang).
 * Simulates syncing to external inventory system.
 */
export async function createGoodsReleaseMemo(input: CreateGoodsMemoInput) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || input.requesterName || "Pengguna";

    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Minimal 1 barang harus diinput ke dalam memo" };
    }

    // Validate Team Leader authorization if requester is in Production role
    const userRoles = session?.user?.roles || [];
    const isProductionOnly =
      userRoles.some((r) => r.toLowerCase().includes("production") || r.toLowerCase().includes("produksi")) &&
      !userRoles.some((r) =>
        ["superadmin", "admin", "ppic", "project manager", "pm", "founder"].includes(r.toLowerCase()),
      );

    if (isProductionOnly && input.projectId) {
      const projectWithLeader = await prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          masterplan: {
            include: {
              divisionLeaders: true,
            },
          },
          productionSetup: true,
          productionStages: true,
        },
      });

      if (projectWithLeader) {
        const userNameLower = (session?.user?.name || "").trim().toLowerCase();
        const userId = session?.user?.id;

        const masterplanLeaders =
          projectWithLeader.masterplan?.divisionLeaders?.map((dl) => dl.leaderName.trim().toLowerCase()) || [];
        const masterplanUserIds =
          projectWithLeader.masterplan?.divisionLeaders?.map((dl) => dl.leaderUserId).filter(Boolean) || [];
        const setupLeader = projectWithLeader.productionSetup?.leader?.trim().toLowerCase();
        const stageLeaders =
          projectWithLeader.productionStages?.map((ps) => ps.assignedLeader?.trim().toLowerCase()).filter(Boolean) || [];

        const isLeader =
          (userId && masterplanUserIds.includes(userId)) ||
          masterplanLeaders.includes(userNameLower) ||
          (setupLeader && setupLeader === userNameLower) ||
          stageLeaders.includes(userNameLower);

        if (!isLeader) {
          return {
            success: false,
            error: `Anda (${session?.user?.name || "User"}) tidak terdaftar sebagai Team Leader proyek ini di Masterplan / Setup Produksi. Request Memo Pengeluaran Barang hanya dapat dilakukan oleh Team Leader.`,
          };
        }
      }
    }

    // Validate that items match Approved SPBs for this project
    if (input.projectId) {
      const approvedSpbs = await prisma.sPB.findMany({
        where: {
          projectId: input.projectId,
          approvedByPpic: true,
          approvedByPm: true,
          status: { not: "REJECTED" },
        },
        include: { items: true },
      });

      if (!approvedSpbs || approvedSpbs.length === 0) {
        return {
          success: false,
          error: "Proyek ini belum memiliki Surat Permintaan Barang (SPB) yang disetujui. Pengeluaran barang hanya dapat dilakukan berdasarkan barang pada SPB disetujui.",
        };
      }

      const approvedItemNames = new Set(
        approvedSpbs.flatMap((s) => s.items.map((i) => i.name.trim().toLowerCase()))
      );

      for (const item of input.items) {
        if (!approvedItemNames.has(item.itemName.trim().toLowerCase())) {
          return {
            success: false,
            error: `Barang "${item.itemName}" tidak sesuai dengan SPB proyek yang telah disetujui. Silakan pilih barang dari SPB disetujui.`,
          };
        }
      }
    }

    // Auto generate Memo Number: MEMO/{Nomor Project}/001
    let projectIdentifier = "GENERAL";
    let countForScope = 0;

    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { projectNumber: true, projectName: true },
      });
      if (project) {
        projectIdentifier = project.projectNumber || project.projectName;
      }
      countForScope = await prisma.goodsReleaseMemo.count({
        where: { projectId: input.projectId },
      });
    } else {
      countForScope = await prisma.goodsReleaseMemo.count();
    }

    const sequenceStr = String(countForScope + 1).padStart(3, "0");
    const memoNumber = `MEMO/${projectIdentifier}/${sequenceStr}`;

    const memo = await prisma.$transaction(async (tx) => {
      const createdMemo = await tx.goodsReleaseMemo.create({
        data: {
          memoNumber,
          projectId: input.projectId || null,
          requesterName: userBy,
          division: input.division || "PRODUKSI",
          notes: input.notes || null,
          status: "PENDING",
          syncInventoryStatus: "PENDING",
          externalSyncAt: null,
          items: {
            create: input.items.map((item) => ({
              itemId: item.itemId || null,
              itemCode: item.itemCode || null,
              itemName: item.itemName.trim(),
              itemType: item.itemType || "CONSUMABLE",
              qtyRequested: item.qtyRequested,
              qtyIssued: item.qtyRequested,
              qtyReturned: 0,
              unit: item.unit || "PCS",
              notes: item.notes || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Add log to Project History if attached to project
      if (input.projectId) {
        await tx.projectHistory.create({
          data: {
            projectId: input.projectId,
            division: input.division || "PRODUKSI",
            status: "IN_PROGRESS",
            action: "REQUEST_GOODS_MEMO",
            notes: `Memo Pengeluaran Barang ${memoNumber} diajukan oleh ${userBy} (${input.items.length} item) dan menunggu persetujuan PPIC.`,
            updatedBy: userBy,
          },
        });
      }

      return createdMemo;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    return { success: true, data: memo };
  } catch (error: any) {
    console.error("[createGoodsReleaseMemo] Error:", error);
    return { success: false, error: error.message || "Gagal membuat Memo Pengeluaran Barang" };
  }
}

/**
 * Gets list of Goods Release Memos.
 */
export async function getGoodsReleaseMemos(projectId?: string) {
  try {
    await requireAuth();

    const memos = await prisma.goodsReleaseMemo.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
          },
        },
        items: {
          include: {
            item: true,
          },
        },
        returns: {
          include: {
            items: {
              include: {
                memoItem: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return memos;
  } catch (error) {
    console.error("[getGoodsReleaseMemos] Error:", error);
    return [];
  }
}

/**
 * Records surplus / tool return for a Goods Release Memo.
 */
export async function recordGoodsReturn(input: RecordReturnInput) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || input.returnedBy || "Pengguna";

    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Minimal 1 barang harus dikembalikan" };
    }

    const memo = await prisma.goodsReleaseMemo.findUnique({
      where: { id: input.memoId },
      include: { items: true },
    });

    if (!memo) {
      return { success: false, error: "Memo Pengeluaran Barang tidak ditemukan" };
    }

    // Generate Return Number
    const datePrefix = new Date().toISOString().slice(0, 7).replace("-", "");
    const returnCount = await prisma.goodsReturnRecord.count();
    const returnNumber = `RET-${datePrefix}-${String(returnCount + 1).padStart(3, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create GoodsReturnRecord (Flag Request to Warehouse System)
      const returnRecord = await tx.goodsReturnRecord.create({
        data: {
          memoId: input.memoId,
          returnNumber,
          returnedBy: userBy,
          notes: input.notes || null,
          syncInventoryStatus: "PENDING_WAREHOUSE_ACC",
          warehouseStatus: "PENDING_ACC",
          items: {
            create: input.items.map((it) => ({
              memoItemId: it.memoItemId,
              qtyReturned: it.qtyReturned,
              condition: it.condition,
              notes: it.notes || null,
            })),
          },
        },
      });

      // 2. Update qtyReturned on memo items
      for (const it of input.items) {
        await tx.goodsReleaseMemoItem.update({
          where: { id: it.memoItemId },
          data: {
            qtyReturned: {
              increment: it.qtyReturned,
            },
          },
        });
      }

      // 3. Check overall memo return status
      const updatedMemoItems = await tx.goodsReleaseMemoItem.findMany({
        where: { memoId: input.memoId },
      });

      const allReturned = updatedMemoItems.every(
        (item) => item.qtyReturned >= item.qtyIssued
      );
      const anyReturned = updatedMemoItems.some((item) => item.qtyReturned > 0);

      const newStatus = allReturned
        ? "COMPLETED"
        : anyReturned
          ? "PARTIALLY_RETURNED"
          : memo.status;

      await tx.goodsReleaseMemo.update({
        where: { id: input.memoId },
        data: {
          status: newStatus,
          syncInventoryStatus: "SENT_TO_INVENTORY",
          externalSyncAt: new Date(),
        },
      });

      // Log to Project History if attached to project
      if (memo.projectId) {
        await tx.projectHistory.create({
          data: {
            projectId: memo.projectId,
            division: memo.division,
            status: "IN_PROGRESS",
            action: "RETURN_GOODS_MEMO",
            notes: `Pengembalian Sisa/Alat ${returnNumber} untuk Memo ${memo.memoNumber} diserahkan oleh ${userBy} dan dikirim ke sistem inventory.`,
            updatedBy: userBy,
          },
        });
      }

      return returnRecord;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("[recordGoodsReturn] Error:", error);
    return { success: false, error: error.message || "Gagal mencatat pengembalian barang" };
  }
}

/**
 * Approves a Goods Release Memo (Menyetujui Memo Gudang).
 */
export async function approveGoodsReleaseMemo(memoId: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "PPIC";

    const memo = await prisma.goodsReleaseMemo.findUnique({
      where: { id: memoId },
    });
    if (!memo) {
      return { success: false, error: "Memo Pengeluaran Barang tidak ditemukan" };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.goodsReleaseMemo.update({
        where: { id: memoId },
        data: {
          status: "APPROVED",
          approvedBy: userBy,
          approvedAt: new Date(),
          syncInventoryStatus: "SENT_TO_INVENTORY",
          externalSyncAt: new Date(),
        },
      });

      if (memo.projectId) {
        await tx.projectHistory.create({
          data: {
            projectId: memo.projectId,
            division: memo.division,
            status: "IN_PROGRESS",
            action: "APPROVE_GOODS_MEMO",
            notes: `Memo Pengeluaran Barang ${memo.memoNumber} telah DISETUJUI oleh PPIC (${userBy}) dan dikirim ke sistem Gudang.`,
            updatedBy: userBy,
          },
        });
      }
      return res;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/production");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("[approveGoodsReleaseMemo] Error:", error);
    return { success: false, error: error.message || "Gagal menyetujui memo" };
  }
}

/**
 * Rejects a Goods Release Memo (Menolak Memo Gudang oleh PPIC).
 */
export async function rejectGoodsReleaseMemo(memoId: string, reason: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "PPIC";

    if (!reason || !reason.trim()) {
      return { success: false, error: "Alasan penolakan wajib diisi" };
    }

    const memo = await prisma.goodsReleaseMemo.findUnique({
      where: { id: memoId },
    });
    if (!memo) {
      return { success: false, error: "Memo Pengeluaran Barang tidak ditemukan" };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.goodsReleaseMemo.update({
        where: { id: memoId },
        data: {
          status: "REJECTED",
          rejectedReason: reason.trim(),
          rejectedAt: new Date(),
        },
      });

      if (memo.projectId) {
        await tx.projectHistory.create({
          data: {
            projectId: memo.projectId,
            division: memo.division,
            status: "IN_PROGRESS",
            action: "REJECT_GOODS_MEMO",
            notes: `Memo Pengeluaran Barang ${memo.memoNumber} DITOLAK oleh PPIC (${userBy}). Alasan: ${reason.trim()}`,
            updatedBy: userBy,
          },
        });
      }
      return res;
    });

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/production");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("[rejectGoodsReleaseMemo] Error:", error);
    return { success: false, error: error.message || "Gagal menolak memo" };
  }
}

/**
 * Gets list of items from APPROVED SPBs for a specific project.
 * Items can only be requested in a Goods Release Memo if they exist in an approved SPB.
 */
export async function getApprovedSpbItemsForProject(projectId?: string) {
  try {
    await requireAuth();
    if (!projectId) return [];

    const spbs = await prisma.sPB.findMany({
      where: {
        projectId,
        approvedByPpic: true,
        approvedByPm: true,
        status: { not: "REJECTED" },
      },
      include: {
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!spbs || spbs.length === 0) return [];

    // Fetch existing Goods Release Memos for this project to calculate already requested quantities
    const existingMemos = await prisma.goodsReleaseMemo.findMany({
      where: {
        projectId,
        status: { not: "REJECTED" },
      },
      include: {
        items: true,
      },
    });

    const memoQtyMap = new Map<string, number>();
    for (const memo of existingMemos) {
      for (const memoItem of memo.items) {
        const nameKey = memoItem.itemName.trim().toLowerCase();
        memoQtyMap.set(nameKey, (memoQtyMap.get(nameKey) || 0) + (memoItem.qtyRequested || 0));
        if (memoItem.itemId) {
          const idKey = `id_${memoItem.itemId}`;
          memoQtyMap.set(idKey, (memoQtyMap.get(idKey) || 0) + (memoItem.qtyRequested || 0));
        }
      }
    }

    const spbItemsMap = new Map<string, {
      id: string;
      spbNumber: string;
      spbId: string;
      itemName: string;
      materialId?: string | null;
      itemCode?: string | null;
      typeMerk?: string | null;
      unit: string;
      source: string;
      itemStatus: string;
      isReadyToRequest: boolean;
      totalApprovedQty: number;
      qtyAlreadyRequested: number;
      qtyRemainingToRequest: number;
    }>();

    for (const spb of spbs) {
      for (const item of spb.items) {
        const statusUpper = (item.status || "PENDING").toUpperCase();

        // Exclude only explicitly rejected or cancelled items
        if (statusUpper === "REJECTED" || statusUpper === "CANCELLED") {
          continue;
        }

        const isTrading = (item.source || "").toUpperCase() === "TRADING";
        const isUnreadyTrading =
          isTrading &&
          (statusUpper === "PO_PENDING" ||
            statusUpper === "PO_CREATED" ||
            statusUpper === "PENDING" ||
            statusUpper === "WAITING_PO" ||
            statusUpper === "PENDING_PO");
        const isReadyToRequest = !isUnreadyTrading;

        const nameKey = item.name.trim().toLowerCase();

        const existing = spbItemsMap.get(nameKey);
        if (existing) {
          existing.totalApprovedQty += item.qty;
          if (isReadyToRequest) existing.isReadyToRequest = true;
        } else {
          spbItemsMap.set(nameKey, {
            id: item.id,
            spbNumber: spb.spbNumber,
            spbId: spb.id,
            itemName: item.name,
            materialId: item.materialId || null,
            itemCode: item.material?.code || null,
            typeMerk: item.typeMerk || item.material?.typeMerk || null,
            unit: (item.unit || "PCS").toUpperCase(),
            source: item.source || "WAREHOUSE",
            itemStatus: item.status || "PENDING",
            isReadyToRequest,
            totalApprovedQty: item.qty,
            qtyAlreadyRequested: 0,
            qtyRemainingToRequest: item.qty,
          });
        }
      }
    }

    for (const [nameKey, itemData] of spbItemsMap.entries()) {
      const requestedByName = memoQtyMap.get(nameKey) || 0;
      const requestedById = itemData.materialId ? (memoQtyMap.get(`id_${itemData.materialId}`) || 0) : 0;
      const requestedInMemos = Math.max(requestedByName, requestedById);

      itemData.qtyAlreadyRequested = requestedInMemos;
      itemData.qtyRemainingToRequest = Math.max(0, itemData.totalApprovedQty - requestedInMemos);
    }

    return Array.from(spbItemsMap.values());
  } catch (error) {
    console.error("[getApprovedSpbItemsForProject] Error:", error);
    return [];
  }
}
