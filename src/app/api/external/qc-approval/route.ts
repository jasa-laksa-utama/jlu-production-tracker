import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * POST /api/external/qc-approval
 * Endpoint integrasi sistem QC Eksternal callback.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const expectedSecret = process.env.QC_EXTERNAL_API_SECRET || "jlu-qc-secret-key";

    if (process.env.NODE_ENV === "production" && token !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access token" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      receiptId,
      qcExternalId,
      qcApprovedBy,
      qcApprovedAt,
      status,
      notes,
      reportUrl,
      items,
    } = body;

    if (!receiptId || !status) {
      return NextResponse.json(
        { success: false, error: "receiptId and status are required" },
        { status: 400 }
      );
    }

    const existingReceipt = await prisma.purchaseOrderReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!existingReceipt) {
      return NextResponse.json(
        { success: false, error: "PurchaseOrderReceipt not found" },
        { status: 404 }
      );
    }

    const updatedReceipt = await prisma.$transaction(async (tx) => {
      // 1. Update Header Receipt
      const receipt = await tx.purchaseOrderReceipt.update({
        where: { id: receiptId },
        data: {
          qcStatus: status,
          qcExternalId: qcExternalId || null,
          qcApprovedBy: qcApprovedBy || "QC Inspector Eksternal",
          qcApprovedAt: qcApprovedAt ? new Date(qcApprovedAt) : new Date(),
          qcNotes: notes || null,
          qcReportUrl: reportUrl || null,
        },
      });

      // 2. Update Items if provided
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
      message: "Hasil validasi QC eksternal berhasil diperbarui",
      data: updatedReceipt,
    });
  } catch (error: any) {
    console.error("Error POST /api/external/qc-approval:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
