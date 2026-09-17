import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/error-handler";
import { revalidatePath } from "next/cache";

/**
 * POST /api/warehouse/spb-items/confirm
 * Endpoint for external Purchasing / Warehouse system to approve or update
 * release status of SPB Warehouse items (Barang SPB Gudang).
 *
 * Body:
 * {
 *   "spbItemId": "uuid",
 *   "action": "APPROVE" | "REJECT" | "PREPARING",
 *   "approvedBy": "Tim Purchasing / Gudang",
 *   "notes": "Catatan persetujuan pengeluaran"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spbItemId, action = "APPROVE", approvedBy = "Tim Purchasing Gudang", notes } = body;

    if (!spbItemId) {
      return NextResponse.json(
        { success: false, error: "Parameter spbItemId wajib diisi." },
        { status: 400 }
      );
    }

    const upperAction = String(action).toUpperCase();
    let targetStatus = "APPROVED_WAREHOUSE";
    if (upperAction === "REJECT" || upperAction === "REJECTED") {
      targetStatus = "REJECTED";
    } else if (upperAction === "PREPARING") {
      targetStatus = "PREPARING";
    }

    // 1. Check in regular SPB items (spb_items)
    const spbItem = await prisma.sPBItem.findUnique({
      where: { id: spbItemId },
      include: {
        spb: {
          include: {
            project: {
              select: {
                id: true,
                projectNumber: true,
                projectName: true,
              },
            },
          },
        },
      },
    });

    if (spbItem) {
      const updated = await prisma.$transaction(async (tx) => {
        const itemRes = await tx.sPBItem.update({
          where: { id: spbItemId },
          data: {
            status: targetStatus,
          },
        });

        if (spbItem.spb?.projectId) {
          const actionText =
            targetStatus === "APPROVED_WAREHOUSE"
              ? "DISETUJUI untuk dikeluarkan dari gudang"
              : targetStatus === "PREPARING"
                ? "sedang DISIAPKAN oleh petugas gudang"
                : "DITOLAK pengeluarannya dari gudang";

          await tx.projectHistory.create({
            data: {
              projectId: spbItem.spb.projectId,
              division: "INVENTORY",
              status: "IN_PROGRESS",
              action: "WAREHOUSE_ACC_SPB_ITEM",
              notes: `Barang SPB "${spbItem.name}" (${spbItem.qty} ${spbItem.unit}) pada SPB ${spbItem.spb.spbNumber} telah ${actionText} oleh ${approvedBy}.${notes ? ` Catatan: ${notes}` : ""}`,
              updatedBy: approvedBy,
            },
          });
        }

        return itemRes;
      });

      revalidatePath("/trackers/ppic");
      revalidatePath("/trackers/production");

      return NextResponse.json({
        success: true,
        message: `Status barang "${spbItem.name}" berhasil diperbarui menjadi ${targetStatus}.`,
        data: updated,
      });
    }

    // 2. Check in SpbGudang items (spb_gudang_items)
    const spbGudangItem = await prisma.spbGudangItem.findUnique({
      where: { id: spbItemId },
      include: {
        spbGudang: {
          include: {
            project: {
              select: {
                id: true,
                projectNumber: true,
                projectName: true,
              },
            },
          },
        },
      },
    });

    if (spbGudangItem) {
      const updated = await prisma.$transaction(async (tx) => {
        const itemRes = await tx.spbGudangItem.update({
          where: { id: spbItemId },
          data: {
            status: targetStatus,
          },
        });

        if (spbGudangItem.spbGudang?.projectId) {
          const actionText =
            targetStatus === "APPROVED_WAREHOUSE"
              ? "DISETUJUI untuk dikeluarkan dari gudang"
              : targetStatus === "PREPARING"
                ? "sedang DISIAPKAN oleh petugas gudang"
                : "DITOLAK pengeluarannya dari gudang";

          await tx.projectHistory.create({
            data: {
              projectId: spbGudangItem.spbGudang.projectId,
              division: "INVENTORY",
              status: "IN_PROGRESS",
              action: "WAREHOUSE_ACC_SPB_ITEM",
              notes: `Barang SPB Gudang "${spbGudangItem.name}" (${spbGudangItem.qty} ${spbGudangItem.unit}) pada SPB ${spbGudangItem.spbGudang.spbNumber} telah ${actionText} oleh ${approvedBy}.${notes ? ` Catatan: ${notes}` : ""}`,
              updatedBy: approvedBy,
            },
          });
        }

        return itemRes;
      });

      revalidatePath("/trackers/ppic");
      revalidatePath("/trackers/production");

      return NextResponse.json({
        success: true,
        message: `Status barang SPB Gudang "${spbGudangItem.name}" berhasil diperbarui menjadi ${targetStatus}.`,
        data: updated,
      });
    }

    return NextResponse.json(
      { success: false, error: `Item SPB dengan ID "${spbItemId}" tidak ditemukan.` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[API POST /api/warehouse/spb-items/confirm] Error:", error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Gagal memproses persetujuan pengeluaran barang.") },
      { status: 500 }
    );
  }
}
