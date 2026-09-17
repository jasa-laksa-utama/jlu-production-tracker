import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/error-handler";

interface ConfirmReturnBody {
  returnNumber: string;
  action: "APPROVE" | "REJECT";
  approvedBy: string;
  notes?: string;
}

/**
 * POST /api/warehouse/returns/confirm
 * Allows external Warehouse System to approve/reject a return request.
 */
export async function POST(request: Request) {
  try {
    const body: ConfirmReturnBody = await request.json();
    const { returnNumber, action, approvedBy, notes } = body;

    if (!returnNumber || !action || !approvedBy) {
      return NextResponse.json(
        {
          success: false,
          error: "Mandatory fields missing: returnNumber, action (APPROVE|REJECT), approvedBy",
        },
        { status: 400 }
      );
    }

    const returnRecord = await prisma.goodsReturnRecord.findUnique({
      where: { returnNumber },
      include: {
        items: true,
        memo: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!returnRecord) {
      return NextResponse.json(
        { success: false, error: `Return record with returnNumber "${returnNumber}" not found` },
        { status: 404 }
      );
    }

    if (returnRecord.warehouseStatus !== "PENDING_ACC") {
      return NextResponse.json(
        {
          success: false,
          error: `Return record "${returnNumber}" is already processed (Status: ${returnRecord.warehouseStatus})`,
        },
        { status: 400 }
      );
    }

    const updatedRecord = await prisma.$transaction(async (tx) => {
      const isApproved = action === "APPROVE";
      const newWarehouseStatus = isApproved ? "APPROVED" : "REJECTED";
      const newSyncStatus = isApproved ? "ACC_BY_WAREHOUSE" : "REJECTED_BY_WAREHOUSE";

      // 1. Update GoodsReturnRecord status
      const record = await tx.goodsReturnRecord.update({
        where: { returnNumber },
        data: {
          warehouseStatus: newWarehouseStatus,
          syncInventoryStatus: newSyncStatus,
          warehouseApprovedBy: approvedBy,
          warehouseApprovedAt: new Date(),
          warehouseNotes: notes || null,
        },
      });

      if (isApproved) {
        // 2. Update qtyReturned on memo items
        for (const item of returnRecord.items) {
          await tx.goodsReleaseMemoItem.update({
            where: { id: item.memoItemId },
            data: {
              qtyReturned: {
                increment: item.qtyReturned,
              },
            },
          });
        }

        // 3. Recalculate overall memo status
        const updatedMemoItems = await tx.goodsReleaseMemoItem.findMany({
          where: { memoId: returnRecord.memoId },
        });

        const allReturned = updatedMemoItems.every(
          (item) => item.qtyReturned >= item.qtyIssued
        );
        const anyReturned = updatedMemoItems.some((item) => item.qtyReturned > 0);

        const newMemoStatus = allReturned
          ? "COMPLETED"
          : anyReturned
            ? "PARTIALLY_RETURNED"
            : returnRecord.memo.status;

        await tx.goodsReleaseMemo.update({
          where: { id: returnRecord.memoId },
          data: {
            status: newMemoStatus,
            syncInventoryStatus: "ACC_BY_WAREHOUSE",
            externalSyncAt: new Date(),
          },
        });
      } else {
        // If rejected
        await tx.goodsReleaseMemo.update({
          where: { id: returnRecord.memoId },
          data: {
            syncInventoryStatus: "REJECTED_BY_WAREHOUSE",
            externalSyncAt: new Date(),
          },
        });
      }

      // 4. Log to Project History if linked to a project
      if (returnRecord.memo.projectId) {
        await tx.projectHistory.create({
          data: {
            projectId: returnRecord.memo.projectId,
            division: returnRecord.memo.division,
            status: "IN_PROGRESS",
            action: isApproved ? "GOODS_RETURN_APPROVED" : "GOODS_RETURN_REJECTED",
            notes: isApproved
              ? `Pengembalian barang ${returnNumber} telah DI-ACC oleh Gudang (${approvedBy}).${notes ? ` Catatan: ${notes}` : ""}`
              : `Pengembalian barang ${returnNumber} DITOLAK oleh Gudang (${approvedBy}).${notes ? ` Alasan: ${notes}` : ""}`,
            updatedBy: approvedBy,
          },
        });
      }

      return record;
    });

    return NextResponse.json({
      success: true,
      message: `Return request ${returnNumber} successfully ${action === "APPROVE" ? "APPROVED" : "REJECTED"} by warehouse`,
      data: {
        returnNumber: updatedRecord.returnNumber,
        warehouseStatus: updatedRecord.warehouseStatus,
        warehouseApprovedBy: updatedRecord.warehouseApprovedBy,
        warehouseApprovedAt: updatedRecord.warehouseApprovedAt,
      },
    });
  } catch (error: any) {
    console.error("[API POST /api/warehouse/returns/confirm] Error:", error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Gagal memproses konfirmasi retur") },
      { status: 500 }
    );
  }
}
