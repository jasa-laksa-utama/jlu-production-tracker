import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ppicStatus = searchParams.get("ppicStatus") || "WAITING_APPROVAL";
    const projectId = searchParams.get("projectId");

    const whereClause: any = {
      status: "READY_TO_SHIP",
    };

    if (ppicStatus !== "ALL") {
      whereClause.ppicStatus = ppicStatus;
    }

    if (projectId) {
      whereClause.projectId = projectId;
    }

    const packages = await prisma.shipmentPackage.findMany({
      where: whereClause,
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        project_components: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      total: packages.length,
      packages,
    });
  } catch (error: any) {
    console.error("Error in GET /api/shipping/packages/ppic-approval:", error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil data paket untuk persetujuan PPIC") },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { packageIds, action, notes, validatorName } = body;

    if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Parameter packageIds (array) wajib disertakan." },
        { status: 400 }
      );
    }

    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Action harus bernilai 'APPROVE' atau 'REJECT'." },
        { status: 400 }
      );
    }

    if (action === "REJECT" && (!notes || !notes.trim())) {
      return NextResponse.json(
        { success: false, error: "Catatan penolakan (notes) wajib diisi saat REJECT." },
        { status: 400 }
      );
    }

    // Try to get validator name from body, otherwise fallback to session
    let effectiveValidator = validatorName;
    if (!effectiveValidator) {
      const session = await auth();
      effectiveValidator = session?.user?.name || "PPIC Approver (Sistem A)";
    }

    const now = new Date();
    const isApprove = action === "APPROVE";

    const result = await prisma.shipmentPackage.updateMany({
      where: {
        id: { in: packageIds },
      },
      data: {
        ppicStatus: isApprove ? "APPROVED" : "REJECTED",
        ppicApprovedAt: now,
        ppicApprovedBy: effectiveValidator,
        ppicNotes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      action,
      message: isApprove
        ? `Berhasil menyetujui ${result.count} paket. Surat Jalan dapat diterbitkan.`
        : `Berhasil menolak ${result.count} paket. Pengiriman diblokir hingga diperbaiki.`,
      updatedCount: result.count,
    });
  } catch (error: any) {
    console.error("Error in PUT /api/shipping/packages/ppic-approval:", error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Gagal memproses persetujuan paket PPIC") },
      { status: 500 }
    );
  }
}
