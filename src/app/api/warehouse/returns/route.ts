import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/warehouse/returns
 * Allows external Warehouse System to fetch return requests.
 * Query Parameters:
 *  - status: "PENDING_ACC" | "APPROVED" | "REJECTED" | "ALL" (default: "PENDING_ACC")
 *  - limit: number (default: 50)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "PENDING_ACC";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const whereClause: any = {};
    if (statusParam !== "ALL") {
      whereClause.warehouseStatus = statusParam;
    }

    const returnRecords = await prisma.goodsReturnRecord.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        memo: {
          select: {
            id: true,
            memoNumber: true,
            projectId: true,
            requesterName: true,
            division: true,
            project: {
              select: {
                id: true,
                projectName: true,
                projectNumber: true,
              },
            },
          },
        },
        items: {
          include: {
            memoItem: {
              select: {
                id: true,
                itemName: true,
                itemCode: true,
                itemType: true,
                unit: true,
                qtyRequested: true,
                qtyIssued: true,
                qtyReturned: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: returnRecords.length,
      data: returnRecords.map((rec) => ({
        returnId: rec.id,
        returnNumber: rec.returnNumber,
        memoNumber: rec.memo.memoNumber,
        projectNumber: rec.memo.project?.projectNumber || "GENERAL",
        projectName: rec.memo.project?.projectName || "General Project",
        division: rec.memo.division,
        returnedBy: rec.returnedBy,
        returnDate: rec.returnDate,
        warehouseStatus: rec.warehouseStatus,
        syncInventoryStatus: rec.syncInventoryStatus,
        notes: rec.notes,
        items: rec.items.map((item) => ({
          memoItemId: item.memoItemId,
          itemCode: item.memoItem.itemCode,
          itemName: item.memoItem.itemName,
          itemType: item.memoItem.itemType,
          qtyReturned: item.qtyReturned,
          unit: item.memoItem.unit,
          condition: item.condition,
          notes: item.notes,
        })),
        createdAt: rec.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[API GET /api/warehouse/returns] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch return requests" },
      { status: 500 }
    );
  }
}
