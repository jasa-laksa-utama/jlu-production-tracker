"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";
import { auth } from "@/auth";

export interface GoodsMemoItemInput {
  itemId?: string;
  itemCode?: string;
  spbItemId?: string;
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

    // Validate that items match Approved SPBs and have been processed by Purchasing/Warehouse
    if (input.projectId) {
      const allProjectSpbs = await prisma.sPB.findMany({
        where: {
          projectId: input.projectId,
        },
        include: { items: true },
      });

      const allSpbGudangs = await prisma.spbGudang.findMany({
        where: {
          projectId: input.projectId,
        },
        include: { items: true },
      });

      if ((!allProjectSpbs || allProjectSpbs.length === 0) && (!allSpbGudangs || allSpbGudangs.length === 0)) {
        return {
          success: false,
          error: "Proyek ini belum memiliki Surat Permintaan Barang (SPB). Pengeluaran barang hanya dapat dilakukan berdasarkan barang pada SPB yang telah disetujui dan selesai diproses.",
        };
      }

      // Fetch existing non-rejected Goods Release Memos to calculate remaining quotas
      const existingMemos = await prisma.goodsReleaseMemo.findMany({
        where: {
          projectId: input.projectId,
          status: { not: "REJECTED" },
        },
        include: { items: true },
      });

      const memoQtyByName = new Map<string, number>();
      for (const memo of existingMemos) {
        for (const it of memo.items) {
          const k = it.itemName.trim().toLowerCase();
          memoQtyByName.set(k, (memoQtyByName.get(k) || 0) + (it.qtyRequested || 0));
        }
      }

      for (const item of input.items) {
        const itemKey = item.itemName.trim().toLowerCase();

        // Check matching items in regular SPBs
        const matchingSpbItems = allProjectSpbs.flatMap((s) =>
          s.items
            .filter((i) => i.name.trim().toLowerCase() === itemKey)
            .map((i) => ({ ...i, spb: s }))
        );

        // Check matching items in SpbGudangs
        const matchingGudangItems = allSpbGudangs.flatMap((g) =>
          g.items
            .filter((i) => i.name.trim().toLowerCase() === itemKey)
            .map((i) => ({ ...i, spbGudang: g }))
        );

        if (matchingSpbItems.length === 0 && matchingGudangItems.length === 0) {
          return {
            success: false,
            error: `Barang "${item.itemName}" tidak ditemukan pada SPB proyek ini. Pengeluaran barang harus sesuai item yang terdaftar di SPB.`,
          };
        }

        let isSpbApproved = false;
        let isProcurementProcessed = false;
        let rejectionDetail = "";
        let totalApprovedQuota = 0;

        // Check regular SPBs
        for (const spbItem of matchingSpbItems) {
          const s = spbItem.spb;
          const isApproved =
            s.status === "APPROVED" ||
            (s.approvedByPpic && s.approvedByPm && s.approvedByDireksi);

          if (!isApproved) {
            rejectionDetail = `SPB (${s.spbNumber}) belum disetujui penuh oleh Direksi/PM/PPIC.`;
            continue;
          }
          isSpbApproved = true;

          const isTrading = (spbItem.source || "").toUpperCase() === "TRADING";
          const statusUpper = (spbItem.status || "PENDING").toUpperCase();

          if (isTrading) {
            const isPhysicallyReceived =
              statusUpper === "RECEIVED" ||
              statusUpper === "COMPLETED" ||
              statusUpper === "FULFILLED" ||
              statusUpper === "QC_PASSED" ||
              statusUpper === "APPROVED";

            if (!isPhysicallyReceived) {
              if (statusUpper === "IN_QC" || statusUpper === "DELIVERED" || statusUpper === "PENDING_INSPECTION") {
                rejectionDetail = `Barang Trading "${item.itemName}" pada SPB ${s.spbNumber} telah tiba di gudang namun masih dalam proses inspeksi Quality Control (QC).`;
              } else if (statusUpper === "PO_PROCESSING" || statusUpper === "ORDERED" || statusUpper === "IN_TRANSIT" || statusUpper === "SHIPPED") {
                rejectionDetail = `Barang Trading "${item.itemName}" pada SPB ${s.spbNumber} masih dalam perjalanan pengiriman (belum sampai di gudang).`;
              } else if (statusUpper === "PO_PENDING" || statusUpper === "PO_CREATED" || statusUpper === "WAITING_PO" || statusUpper === "PENDING_PO") {
                rejectionDetail = `PO untuk barang Trading "${item.itemName}" pada SPB ${s.spbNumber} masih diproses penerbitan dan belum dipesan ke vendor.`;
              } else {
                rejectionDetail = `Barang Trading "${item.itemName}" pada SPB ${s.spbNumber} belum diproses oleh tim Purchasing (PO belum dibuat).`;
              }
              continue;
            }

            isProcurementProcessed = true;
            totalApprovedQuota += spbItem.qty;
          } else {
            // WAREHOUSE item
            const isWarehouseApproved =
              statusUpper === "APPROVED_WAREHOUSE" ||
              statusUpper === "APPROVED" ||
              statusUpper === "READY" ||
              statusUpper === "FULFILLED" ||
              statusUpper === "ISSUED" ||
              statusUpper === "PARTIALLY_ISSUED" ||
              statusUpper === "COMPLETED";

            if (!isWarehouseApproved) {
              if (statusUpper === "PREPARING") {
                rejectionDetail = `Item gudang "${item.itemName}" pada SPB ${s.spbNumber} masih dalam tahap persiapan gudang dan belum disetujui untuk dikeluarkan.`;
              } else if (statusUpper === "REJECTED" || statusUpper === "CANCELLED" || statusUpper === "DITOLAK") {
                rejectionDetail = `Item gudang "${item.itemName}" pada SPB ${s.spbNumber} berstatus Ditolak.`;
              } else {
                rejectionDetail = `Item gudang "${item.itemName}" pada SPB ${s.spbNumber} belum disetujui untuk dikeluarkan oleh tim Purchasing/Gudang di sistem terpisah.`;
              }
              continue;
            }

            isProcurementProcessed = true;
            totalApprovedQuota += spbItem.qty;
          }
        }

        // Check SpbGudang items if not yet satisfied
        for (const gItem of matchingGudangItems) {
          const g = gItem.spbGudang;
          const isGudangApproved =
            g.status === "APPROVED" ||
            (g.approvedByPpic && g.approvedByDireksi);

          const gStatusUpper = (gItem.status || "PENDING").toUpperCase();
          const isGItemApproved =
            gStatusUpper === "APPROVED_WAREHOUSE" ||
            gStatusUpper === "APPROVED" ||
            gStatusUpper === "READY" ||
            gStatusUpper === "FULFILLED" ||
            gStatusUpper === "ISSUED" ||
            gStatusUpper === "PARTIALLY_ISSUED" ||
            gStatusUpper === "COMPLETED";

          if (isGudangApproved && isGItemApproved) {
            isSpbApproved = true;
            isProcurementProcessed = true;
            totalApprovedQuota += gItem.qty;
          } else if (!isGudangApproved) {
            rejectionDetail = `SPB Gudang (${g.spbNumber}) belum disetujui penuh oleh Direksi/PPIC.`;
          } else if (!isGItemApproved) {
            if (gStatusUpper === "PREPARING") {
              rejectionDetail = `Item gudang "${item.itemName}" pada SPB Gudang ${g.spbNumber} masih disiapkan dan belum disetujui dikeluarkan.`;
            } else if (gStatusUpper === "REJECTED" || gStatusUpper === "CANCELLED" || gStatusUpper === "DITOLAK") {
              rejectionDetail = `Item gudang "${item.itemName}" pada SPB Gudang ${g.spbNumber} berstatus Ditolak.`;
            } else {
              rejectionDetail = `Item gudang "${item.itemName}" pada SPB Gudang ${g.spbNumber} belum disetujui untuk dikeluarkan oleh tim Purchasing/Gudang di sistem terpisah.`;
            }
          }
        }

        if (!isSpbApproved) {
          return {
            success: false,
            error: `Barang "${item.itemName}" belum dapat diajukan memo karena: ${rejectionDetail || "SPB belum melewati persetujuan."}`,
          };
        }

        if (!isProcurementProcessed) {
          return {
            success: false,
            error: `Barang "${item.itemName}" belum dapat diajukan memo karena: ${rejectionDetail || "Belum selesai diproses oleh tim Purchasing / Gudang."}`,
          };
        }

        // Check remaining quota
        const alreadyRequested = memoQtyByName.get(itemKey) || 0;
        const remainingQuota = Math.max(0, totalApprovedQuota - alreadyRequested);
        if (item.qtyRequested > remainingQuota) {
          return {
            success: false,
            error: `Jumlah permintaan "${item.itemName}" (${item.qtyRequested} ${item.unit}) melebihi sisa kuota SPB yang dapat dikeluarkan (${remainingQuota} ${item.unit}).`,
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

    // Pre-resolve itemCode and itemId from inventory if not provided
    const allInventoryItems = await prisma.item.findMany({
      select: { id: true, code: true, name: true },
    });
    const itemCodeByName = new Map<string, string>();
    const itemIdByName = new Map<string, string>();
    const itemCodeById = new Map<string, string>();
    for (const it of allInventoryItems) {
      itemCodeById.set(it.id, it.code);
      if (it.name) {
        const nKey = it.name.trim().toLowerCase();
        itemCodeByName.set(nKey, it.code);
        itemIdByName.set(nKey, it.id);
      }
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
            create: input.items.map((item) => {
              const nameKey = item.itemName.trim().toLowerCase();
              const resolvedCode =
                item.itemCode ||
                (item.itemId ? itemCodeById.get(item.itemId) : null) ||
                itemCodeByName.get(nameKey) ||
                null;
              const resolvedItemId =
                item.itemId ||
                itemIdByName.get(nameKey) ||
                null;

              return {
                itemId: resolvedItemId,
                itemCode: resolvedCode,
                spbItemId: item.spbItemId || null,
                itemName: item.itemName.trim(),
                itemType: item.itemType || "CONSUMABLE",
                qtyRequested: item.qtyRequested,
                qtyIssued: item.qtyRequested,
                qtyReturned: 0,
                unit: item.unit || "PCS",
                notes: item.notes || null,
              };
            }),
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
    return { success: true, data: JSON.parse(JSON.stringify(memo)) };
  } catch (error: any) {
    console.error("[createGoodsReleaseMemo] Error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat Memo Pengeluaran Barang.") };
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
            spbItem: {
              include: {
                material: true,
              },
            },
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

    const serializedMemos = memos.map((memo) => ({
      ...memo,
      items: memo.items.map((it) => {
        const resolvedItemCode =
          it.itemCode ||
          it.item?.code ||
          it.spbItem?.material?.code ||
          null;

        return {
          ...it,
          itemCode: resolvedItemCode,
          item: it.item
            ? {
                ...it.item,
                unitPrice: it.item.unitPrice ? Number(it.item.unitPrice) : null,
              }
            : null,
        };
      }),
    }));

    return JSON.parse(JSON.stringify(serializedMemos));
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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mencatat pengembalian barang.") };
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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menyetujui memo.") };
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
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menolak memo.") };
  }
}

/**
 * Gets list of items from SPBs for a specific project with detailed procurement and warehouse readiness statuses.
 * Items can only be requested in a Goods Release Memo if they exist in an approved SPB and have been fully processed.
 */
export async function getApprovedSpbItemsForProject(projectId?: string) {
  try {
    await requireAuth();
    if (!projectId) return [];

    // Fetch all SPBs for this project to provide complete status visibility
    const spbs = await prisma.sPB.findMany({
      where: {
        projectId,
        status: { not: "REJECTED" },
      },
      include: {
        items: {
          include: {
            material: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also fetch SpbGudang for this project if any
    const spbGudangs = await prisma.spbGudang.findMany({
      where: {
        projectId,
        status: { not: "REJECTED" },
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if ((!spbs || spbs.length === 0) && (!spbGudangs || spbGudangs.length === 0)) {
      return [];
    }

    // Fetch existing non-rejected Goods Release Memos for this project to calculate already requested quantities
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
        if (memoItem.spbItemId) {
          const spbItemKey = `spbitem_${memoItem.spbItemId}`;
          memoQtyMap.set(spbItemKey, (memoQtyMap.get(spbItemKey) || 0) + (memoItem.qtyRequested || 0));
        }
      }
    }

    const allInventoryItems = await prisma.item.findMany({
      select: { id: true, code: true, name: true },
    });
    const itemCodeByName = new Map<string, string>();
    const itemIdByCode = new Map<string, string>();
    const itemCodeById = new Map<string, string>();
    for (const it of allInventoryItems) {
      itemCodeById.set(it.id, it.code);
      itemIdByCode.set(it.code, it.id);
      if (it.name) {
        itemCodeByName.set(it.name.trim().toLowerCase(), it.code);
      }
    }

    const itemsList: Array<{
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
      spbStatus: string;
      isSpbFullyApproved: boolean;
      procurementStatus: string;
      procurementBadgeColor: string;
      isReadyToRequest: boolean;
      readinessReason?: string;
      totalApprovedQty: number;
      qtyAlreadyRequested: number;
      qtyRemainingToRequest: number;
    }> = [];

    // Process Regular SPBs
    for (const spb of spbs) {
      const isSpbFullyApproved =
        spb.status === "APPROVED" ||
        (spb.approvedByPpic && spb.approvedByPm && spb.approvedByDireksi);

      let spbApprovalNote = "";
      if (!spb.approvedByPpic) {
        spbApprovalNote = "Menunggu Approval PPIC";
      } else if (!spb.approvedByPm) {
        spbApprovalNote = "Menunggu Approval PM";
      } else if (!spb.approvedByDireksi && spb.status !== "APPROVED") {
        spbApprovalNote = "Menunggu Approval Direksi";
      }

      for (const item of spb.items) {
        const statusUpper = (item.status || "PENDING").toUpperCase();
        const vendorStatusUpper = (item.vendorSelectionStatus || "NONE").toUpperCase();

        if (statusUpper === "REJECTED" || statusUpper === "CANCELLED") {
          continue;
        }

        const isTrading = (item.source || "").toUpperCase() === "TRADING";

        // Calculate requested quantities
        const nameKey = item.name.trim().toLowerCase();
        const requestedByName = memoQtyMap.get(nameKey) || 0;
        const requestedById = item.materialId ? (memoQtyMap.get(`id_${item.materialId}`) || 0) : 0;
        const requestedBySpbItem = memoQtyMap.get(`spbitem_${item.id}`) || 0;
        const qtyAlreadyRequested = Math.max(requestedBySpbItem, Math.min(item.qty, Math.max(requestedByName, requestedById)));
        const qtyRemainingToRequest = Math.max(0, item.qty - qtyAlreadyRequested);

        // Determine informative procurement status & readiness
        let procurementStatus = "";
        let procurementBadgeColor = "zinc";
        let isReadyToRequest = false;
        let readinessReason: string | undefined = undefined;

        if (!isSpbFullyApproved) {
          procurementStatus = `SPB ${spbApprovalNote || "Belum Disetujui"}`;
          procurementBadgeColor = "amber";
          isReadyToRequest = false;
          readinessReason = `SPB (${spb.spbNumber}) belum disetujui penuh (${spbApprovalNote || "Pending"}). Memo belum dapat dibuat.`;
        } else if (qtyRemainingToRequest <= 0) {
          procurementStatus = "Barang Sudah Dikeluarkan (Kuota Habis)";
          procurementBadgeColor = "zinc";
          isReadyToRequest = false;
          readinessReason = `Seluruh kuota barang pada SPB ini (${item.qty} ${item.unit}) sudah dibuatkan memo pengeluaran barang.`;
        } else if (isTrading) {
          // TRADING ITEMS LIFECYCLE
          const isReceivedInWarehouse =
            statusUpper === "RECEIVED" ||
            statusUpper === "COMPLETED" ||
            statusUpper === "FULFILLED" ||
            statusUpper === "QC_PASSED" ||
            statusUpper === "APPROVED";

          if (isReceivedInWarehouse) {
            procurementStatus = "Barang Siap di Gudang";
            procurementBadgeColor = "emerald";
            isReadyToRequest = true;
          } else if (statusUpper === "IN_QC" || statusUpper === "DELIVERED" || statusUpper === "PENDING_INSPECTION" || statusUpper === "PARTIAL") {
            procurementStatus = "Barang Tiba (Sedang QC)";
            procurementBadgeColor = "yellow";
            isReadyToRequest = false;
            readinessReason = "Barang telah tiba di gudang namun masih dalam proses inspeksi QC.";
          } else if (statusUpper === "PO_PROCESSING" || statusUpper === "ORDERED" || statusUpper === "IN_TRANSIT" || statusUpper === "SHIPPED") {
            procurementStatus = "Barang Dalam Perjalanan (Belum Sampai)";
            procurementBadgeColor = "purple";
            isReadyToRequest = false;
            readinessReason = "PO telah diterbitkan dan barang sedang dalam perjalanan ekspedisi ke gudang.";
          } else if (statusUpper === "PO_PENDING" || statusUpper === "PO_CREATED" || statusUpper === "WAITING_PO" || statusUpper === "PENDING_PO" || vendorStatusUpper === "APPROVED") {
            procurementStatus = "PO Sedang Diproses";
            procurementBadgeColor = "blue";
            isReadyToRequest = false;
            readinessReason = "Vendor telah disetujui, penerbitan PO sedang diproses oleh Purchasing.";
          } else if (vendorStatusUpper === "SUBMITTED" || vendorStatusUpper === "PENDING_PPIC" || vendorStatusUpper === "PENDING_PM" || vendorStatusUpper === "PENDING_DIREKSI") {
            procurementStatus = "PO Belum Diproses (Menunggu Approval Vendor)";
            procurementBadgeColor = "orange";
            isReadyToRequest = false;
            readinessReason = "Pemilihan rekomendasi vendor masih menunggu persetujuan PPIC/PM/Direksi.";
          } else {
            procurementStatus = "PO Belum Dibuat";
            procurementBadgeColor = "zinc";
            isReadyToRequest = false;
            readinessReason = "Barang Trading ini belum diproses oleh tim Purchasing (PO belum dibuat).";
          }
        } else {
          // WAREHOUSE (GUDANG) ITEMS LIFECYCLE
          const isWarehouseApproved =
            statusUpper === "APPROVED_WAREHOUSE" ||
            statusUpper === "APPROVED" ||
            statusUpper === "READY" ||
            statusUpper === "FULFILLED" ||
            statusUpper === "ISSUED" ||
            statusUpper === "PARTIALLY_ISSUED" ||
            statusUpper === "COMPLETED";

          if (isWarehouseApproved) {
            procurementStatus = "Disetujui Dikeluarkan (Stok Gudang Siap)";
            procurementBadgeColor = "emerald";
            isReadyToRequest = true;
          } else if (statusUpper === "PREPARING") {
            procurementStatus = "Sedang Disiapkan Gudang";
            procurementBadgeColor = "indigo";
            isReadyToRequest = false;
            readinessReason = "Barang sedang disiapkan oleh petugas gudang (belum disetujui untuk dikeluarkan).";
          } else if (statusUpper === "REJECTED" || statusUpper === "DITOLAK" || statusUpper === "CANCELLED") {
            procurementStatus = "Ditolak Gudang";
            procurementBadgeColor = "red";
            isReadyToRequest = false;
            readinessReason = "Item gudang ini berstatus ditolak.";
          } else {
            procurementStatus = "Belum Disetujui Dikeluarkan (Gudang)";
            procurementBadgeColor = "amber";
            isReadyToRequest = false;
            readinessReason = "Barang SPB di gudang belum disetujui untuk dikeluarkan oleh tim Purchasing/Gudang di sistem terpisah.";
          }
        }

        const resolvedCode =
          item.material?.code ||
          (item.materialId ? itemCodeById.get(item.materialId) : null) ||
          itemCodeByName.get(item.name.trim().toLowerCase()) ||
          null;
        const resolvedMaterialId =
          item.materialId ||
          (resolvedCode ? itemIdByCode.get(resolvedCode) : null) ||
          null;

        itemsList.push({
          id: item.id,
          spbNumber: spb.spbNumber,
          spbId: spb.id,
          itemName: item.name,
          materialId: resolvedMaterialId,
          itemCode: resolvedCode,
          typeMerk: item.typeMerk || item.material?.typeMerk || null,
          unit: (item.unit || "PCS").toUpperCase(),
          source: item.source || "WAREHOUSE",
          itemStatus: item.status || "PENDING",
          spbStatus: spb.status,
          isSpbFullyApproved,
          procurementStatus,
          procurementBadgeColor,
          isReadyToRequest,
          readinessReason,
          totalApprovedQty: item.qty,
          qtyAlreadyRequested,
          qtyRemainingToRequest,
        });
      }
    }

    // Process SpbGudangs
    for (const sg of spbGudangs) {
      const isSpbFullyApproved =
        sg.status === "APPROVED" ||
        (sg.approvedByPpic && sg.approvedByDireksi);

      let sgApprovalNote = "";
      if (!sg.approvedByPpic) {
        sgApprovalNote = "Menunggu Approval PPIC";
      } else if (!sg.approvedByDireksi && sg.status !== "APPROVED") {
        sgApprovalNote = "Menunggu Approval Direksi";
      }

      for (const item of sg.items) {
        const statusUpper = (item.status || "PENDING").toUpperCase();
        if (statusUpper === "REJECTED" || statusUpper === "CANCELLED") {
          continue;
        }

        const nameKey = item.name.trim().toLowerCase();
        const requestedByName = memoQtyMap.get(nameKey) || 0;
        const requestedById = item.materialId ? (memoQtyMap.get(`id_${item.materialId}`) || 0) : 0;
        const qtyAlreadyRequested = Math.min(item.qty, Math.max(requestedByName, requestedById));
        const qtyRemainingToRequest = Math.max(0, item.qty - qtyAlreadyRequested);

        let procurementStatus = "";
        let procurementBadgeColor = "zinc";
        let isReadyToRequest = false;
        let readinessReason: string | undefined = undefined;

        if (!isSpbFullyApproved) {
          procurementStatus = `SPB Gudang ${sgApprovalNote || "Belum Disetujui"}`;
          procurementBadgeColor = "amber";
          isReadyToRequest = false;
          readinessReason = `SPB Gudang (${sg.spbNumber}) belum disetujui penuh (${sgApprovalNote || "Pending"}).`;
        } else if (qtyRemainingToRequest <= 0) {
          procurementStatus = "Barang Sudah Dikeluarkan (Kuota Habis)";
          procurementBadgeColor = "zinc";
          isReadyToRequest = false;
          readinessReason = `Seluruh kuota barang pada SPB Gudang ini sudah dibuatkan memo pengeluaran barang.`;
        } else {
          const isWarehouseApproved =
            statusUpper === "APPROVED_WAREHOUSE" ||
            statusUpper === "APPROVED" ||
            statusUpper === "READY" ||
            statusUpper === "FULFILLED" ||
            statusUpper === "ISSUED" ||
            statusUpper === "PARTIALLY_ISSUED" ||
            statusUpper === "COMPLETED";

          if (isWarehouseApproved) {
            procurementStatus = "Disetujui Dikeluarkan (Stok Gudang Siap)";
            procurementBadgeColor = "emerald";
            isReadyToRequest = true;
          } else if (statusUpper === "PREPARING") {
            procurementStatus = "Sedang Disiapkan Gudang";
            procurementBadgeColor = "indigo";
            isReadyToRequest = false;
            readinessReason = "Barang sedang disiapkan oleh petugas gudang (belum disetujui untuk dikeluarkan).";
          } else if (statusUpper === "REJECTED" || statusUpper === "DITOLAK" || statusUpper === "CANCELLED") {
            procurementStatus = "Ditolak Gudang";
            procurementBadgeColor = "red";
            isReadyToRequest = false;
            readinessReason = "Item gudang ini berstatus ditolak.";
          } else {
            procurementStatus = "Belum Disetujui Dikeluarkan (Gudang)";
            procurementBadgeColor = "amber";
            isReadyToRequest = false;
            readinessReason = "Barang SPB di gudang belum disetujui untuk dikeluarkan oleh tim Purchasing/Gudang di sistem terpisah.";
          }
        }

        const resolvedCode =
          item.item?.code ||
          (item.materialId ? itemCodeById.get(item.materialId) : null) ||
          itemCodeByName.get(item.name.trim().toLowerCase()) ||
          null;
        const resolvedMaterialId =
          item.materialId ||
          (resolvedCode ? itemIdByCode.get(resolvedCode) : null) ||
          null;

        itemsList.push({
          id: item.id,
          spbNumber: sg.spbNumber,
          spbId: sg.id,
          itemName: item.name,
          materialId: resolvedMaterialId,
          itemCode: resolvedCode,
          typeMerk: item.typeMerk || item.item?.typeMerk || null,
          unit: (item.unit || "PCS").toUpperCase(),
          source: "WAREHOUSE",
          itemStatus: item.status || "PENDING",
          spbStatus: sg.status,
          isSpbFullyApproved,
          procurementStatus,
          procurementBadgeColor,
          isReadyToRequest,
          readinessReason,
          totalApprovedQty: item.qty,
          qtyAlreadyRequested,
          qtyRemainingToRequest,
        });
      }
    }

    return JSON.parse(JSON.stringify(itemsList));
  } catch (error) {
    console.error("[getApprovedSpbItemsForProject] Error:", error);
    return [];
  }
}
