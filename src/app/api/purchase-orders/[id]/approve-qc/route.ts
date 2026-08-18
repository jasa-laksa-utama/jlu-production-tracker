import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * POST /api/purchase-orders/[id]/approve-qc
 * Endpoint persetujuan / validasi QC per-item untuk Purchase Order.
 * Menghasilkan JSON payload lengkap yang dapat dikonsumsi oleh Tim Inventory.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await params;
    const body = await req.json();
    const { qcApprovedBy, items } = body;

    if (!poId) {
      return NextResponse.json(
        { success: false, error: "ID Purchase Order wajib diisi" },
        { status: 400 }
      );
    }

    const existingPO = await (prisma.purchaseOrder as any).findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!existingPO) {
      return NextResponse.json(
        { success: false, error: "Record PurchaseOrder tidak ditemukan" },
        { status: 404 }
      );
    }

    const now = new Date();
    const inspector = qcApprovedBy || "QC Inspector";

    // 1. Update items if passed in body
    if (items && Array.isArray(items) && items.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const itemInput of items) {
          if (itemInput.itemId) {
            await (tx.purchaseOrderItem as any).update({
              where: { id: itemInput.itemId },
              data: {
                qcStatus: itemInput.status || "PASSED",
                qtyPassed: Number(itemInput.qtyPassed) || 0,
                qtyFailed: Number(itemInput.qtyFailed) || 0,
                qcNotes: itemInput.qcNotes?.trim() || null,
                qcDefectReason: itemInput.qcDefectReason?.trim() || null,
                qcApprovedAt: now,
                qcApprovedBy: inspector,
              },
            });
          }
        }
      });
    }

    // 2. Fetch updated items to calculate global status
    const updatedItems = await (prisma.purchaseOrderItem as any).findMany({
      where: { purchaseOrderId: poId },
    });

    const totalCount = updatedItems.length;
    const passedCount = updatedItems.filter((i: any) => i.qcStatus === "PASSED").length;
    const failedCount = updatedItems.filter((i: any) => i.qcStatus === "FAILED").length;
    const pendingCount = totalCount - (passedCount + failedCount);

    let globalQCStatus = "APPROVED";
    if (passedCount === totalCount) {
      globalQCStatus = "APPROVED";
    } else if (failedCount === totalCount) {
      globalQCStatus = "REJECTED";
    } else if (
      (passedCount > 0 || failedCount > 0) &&
      (pendingCount > 0 || (passedCount > 0 && failedCount > 0))
    ) {
      globalQCStatus = "PARTIAL";
    } else {
      globalQCStatus = "PENDING_INSPECTION";
    }

    // 3. Update PO Header
    const updatedPO = await (prisma.purchaseOrder as any).update({
      where: { id: poId },
      data: {
        qcStatus: globalQCStatus,
        qcApprovedAt: now,
        qcApprovedBy: inspector,
      },
    });

    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    // Format response payload for Inventory Integration
    const inventoryPayload = {
      poId: updatedPO.id,
      nomorPO: updatedPO.nomorPO,
      globalQCStatus: globalQCStatus,
      qcApprovedBy: inspector,
      qcApprovedAt: now.toISOString(),
      items: updatedItems.map((item: any) => ({
        itemId: item.id,
        namaBarang: item.namaBarang,
        qcStatus: item.qcStatus,
        qtyReceived: item.qty,
        qtyPassed: item.qtyPassed,
        qtyFailed: item.qtyFailed,
        qcNotes: item.qcNotes,
        qcDefectReason: item.qcDefectReason,
        qcAttachments: item.qcAttachments || [],
      })),
    };

    return NextResponse.json({
      success: true,
      message: `Status QC Purchase Order ${existingPO.nomorPO} berhasil diperbarui (Status Global: ${globalQCStatus}).`,
      data: inventoryPayload,
    });
  } catch (error: any) {
    console.error("Error POST /api/purchase-orders/[id]/approve-qc:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memperbarui status QC PO" },
      { status: 500 }
    );
  }
}
