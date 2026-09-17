import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sanitizeErrorMessage } from "@/lib/error-handler";

/**
 * POST /api/purchase-order-receipts/[id]/approve-qc
 * Endpoint persetujuan / validasi QC untuk record PurchaseOrderReceipt (tabel purchase_order_receipts).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;
    const body = await req.json();
    const { status, notes, qcApprovedBy, qcExternalId, reportUrl, items } = body;

    if (!receiptId || !status) {
      return NextResponse.json(
        { success: false, error: "ID Receipt dan status QC wajib diisi" },
        { status: 400 }
      );
    }

    const existingReceipt = await prisma.purchaseOrderReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!existingReceipt) {
      return NextResponse.json(
        { success: false, error: "Record PurchaseOrderReceipt tidak ditemukan" },
        { status: 404 }
      );
    }

    const updatedReceipt = await prisma.$transaction(async (tx) => {
      // 1. Update status QC Header Receipt
      const receipt = await tx.purchaseOrderReceipt.update({
        where: { id: receiptId },
        data: {
          qcStatus: status,
          qcExternalId: qcExternalId || null,
          qcApprovedBy: qcApprovedBy || "QC Inspector",
          qcApprovedAt: new Date(),
          qcNotes: notes || null,
          qcReportUrl: reportUrl || null,
        },
      });

      // 2. Update status & kuantitas QC per Item Receipt
      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (item.receiptItemId) {
            await tx.purchaseOrderReceiptItem.update({
              where: { id: item.receiptItemId },
              data: {
                qcStatus: item.status || (item.qtyPassed > 0 ? "PASSED" : "FAILED"),
                qtyPassed: Number(item.qtyPassed) || 0,
                qtyFailed: Number(item.qtyFailed) || 0,
                qcDefectReason: item.qcDefectReason || null,
              },
            });
          }
        }
      }

      return receipt;
    });

    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    return NextResponse.json({
      success: true,
      message: `Persetujuan QC untuk Receipt ${receiptId} berhasil disimpan (${status}).`,
      data: updatedReceipt,
    });
  } catch (error: any) {
    console.error(`Error POST /api/purchase-order-receipts/[id]/approve-qc:`, error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Gagal memproses persetujuan QC penerimaan") },
      { status: 500 }
    );
  }
}
