import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/purchase-order-receipts
 * Mengambil daftar penerimaan barang PO (purchase_order_receipts) untuk validasi QC.
 * Parameter query: ?qcStatus=PENDING | APPROVED | REJECTED | PARTIAL | ALL
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qcStatus = searchParams.get("qcStatus") || "ALL";

    const where: any = {};
    if (qcStatus && qcStatus !== "ALL") {
      where.qcStatus = qcStatus;
    }

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        purchaseOrder: {
          select: { id: true, nomorPO: true, kepada: true, projek: true },
        },
        items: {
          include: {
            purchaseOrderItem: {
              select: { id: true, namaBarang: true, qty: true, satuan: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: receipts,
    });
  } catch (error: any) {
    console.error("Error GET /api/purchase-order-receipts:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal mengambil data penerimaan PO" },
      { status: 500 }
    );
  }
}
