import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/error-handler";

/**
 * GET /api/warehouse/memos
 * Allows external Warehouse System to fetch approved Goods Release Memos.
 * Query Parameters:
 *  - status: "APPROVED" | "PENDING" | "REJECTED" | "ALL" (default: "APPROVED")
 *  - syncStatus: "SENT_TO_INVENTORY" | "PENDING" | "ALL" (default: "SENT_TO_INVENTORY")
 *  - limit: number (default: 50)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "APPROVED";
    const syncStatusParam = searchParams.get("syncStatus") || "SENT_TO_INVENTORY";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const whereClause: any = {};
    if (statusParam !== "ALL") {
      whereClause.status = statusParam;
    }
    if (syncStatusParam !== "ALL") {
      whereClause.syncInventoryStatus = syncStatusParam;
    }

    const memos = await prisma.goodsReleaseMemo.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
          },
        },
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: memos.length,
      data: memos.map((memo) => ({
        memoId: memo.id,
        memoNumber: memo.memoNumber,
        projectId: memo.projectId,
        projectNumber: memo.project?.projectNumber || "GENERAL",
        projectName: memo.project?.projectName || "General Project",
        requesterName: memo.requesterName,
        division: memo.division,
        notes: memo.notes,
        status: memo.status,
        approvedByPpic: memo.approvedBy,
        approvedAtPpic: memo.approvedAt,
        syncInventoryStatus: memo.syncInventoryStatus,
        externalSyncAt: memo.externalSyncAt,
        items: memo.items.map((item) => ({
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemType: item.itemType,
          qtyRequested: item.qtyRequested,
          qtyIssued: item.qtyIssued,
          unit: item.unit,
          notes: item.notes,
        })),
        createdAt: memo.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[API GET /api/warehouse/memos] Error:", error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil data memo pengeluaran barang") },
      { status: 500 }
    );
  }
}
