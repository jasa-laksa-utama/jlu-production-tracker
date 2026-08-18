import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/warehouse/memos/confirm
 * Allows external Warehouse System to send back Goods Release confirmation (ACC Barang Keluar).
 * Body:
 * {
 *   "memoId": "uuid",
 *   "issuedBy": "Nama Petugas Gudang",
 *   "items": [
 *     {
 *       "memoItemId": "uuid",
 *       "qtyIssued": 5
 *     }
 *   ]
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memoId, issuedBy, items } = body;

    if (!memoId) {
      return NextResponse.json(
        { success: false, error: "memoId wajib diisi" },
        { status: 400 }
      );
    }

    const memo = await prisma.goodsReleaseMemo.findUnique({
      where: { id: memoId },
      include: { items: true },
    });

    if (!memo) {
      return NextResponse.json(
        { success: false, error: "Memo Pengeluaran Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    const updatedMemo = await prisma.$transaction(async (tx) => {
      // Update memo warehouseStatus
      await tx.goodsReleaseMemo.update({
        where: { id: memoId },
        data: {
          warehouseStatus: "ISSUED",
          warehouseIssuedBy: issuedBy || "Sistem Gudang",
          warehouseIssuedAt: new Date(),
        },
      });

      // Update items qtyIssued if provided
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.memoItemId && typeof item.qtyIssued === "number") {
            await tx.goodsReleaseMemoItem.update({
              where: { id: item.memoItemId },
              data: { qtyIssued: item.qtyIssued },
            });
          }
        }
      }

      // Add Project History Log
      if (memo.projectId) {
        await tx.projectHistory.create({
          data: {
            projectId: memo.projectId,
            division: memo.division,
            status: "IN_PROGRESS",
            action: "WAREHOUSE_ISSUED_GOODS",
            notes: `Tim Gudang (${issuedBy || "Sistem Gudang"}) telah menyetujui & mengkonfirmasi pengeluaran fisik barang untuk Memo ${memo.memoNumber}.`,
            updatedBy: issuedBy || "Gudang",
          },
        });
      }

      return await tx.goodsReleaseMemo.findUnique({
        where: { id: memoId },
        include: { items: true },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Konfirmasi pengeluaran barang oleh gudang berhasil dicatat",
      data: updatedMemo,
    });
  } catch (error: any) {
    console.error("[API POST /api/warehouse/memos/confirm] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses konfirmasi gudang" },
      { status: 500 }
    );
  }
}
