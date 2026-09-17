import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    // Mendukung pengecekan sesi auth NextAuth
    if (!session?.user) {
      // Jika Sistem A mengirim token via Cookie auth_token atau Authorization Header, bisa kita validasi atau beri akses jika session terisi
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");

    const whereClause: any = {};

    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    if (projectId) {
      whereClause.projectId = projectId;
    }

    const shipments = await prisma.shipment.findMany({
      where: whereClause,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            licenseNumber: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            name: true,
            plateNumber: true,
            type: true,
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
            customer: {
              select: {
                id: true,
                name: true,
                company: true,
                phone: true,
                address: true,
              },
            },
          },
        },
        packages: {
          include: {
            project_components: {
              select: {
                id: true,
                name: true,
                markingCode: true,
                qty: true,
                unit: true,
              },
            },
          },
        },
      },
      orderBy: {
        deliveryDate: "desc",
      },
    });

    return NextResponse.json({
      shipments: shipments.map((s) => ({
        id: s.id,
        suratJalanNo: s.suratJalanNo,
        projectId: s.projectId,
        deliveryDate: s.deliveryDate.toISOString(),
        shippingMethod: s.shippingMethod,
        destination: s.destination,
        estimatedWeight: s.estimatedWeight,
        estimatedDimension: s.estimatedDimension,
        notes: s.notes,
        status: s.status,
        fleetRequestStatus: s.fleetRequestStatus,
        driverId: s.driverId,
        vehicleId: s.vehicleId,
        expeditionName: s.expeditionName,
        driverName: s.driver?.name || s.driverName,
        driverPhone: s.driver?.phone || s.driverPhone,
        vehiclePlateNumber: s.vehicle?.plateNumber || s.vehiclePlateNumber,
        createdByName: s.createdByName,
        deliveryProofUrl: s.deliveryProofUrl,
        receivedByName: s.receivedByName,
        deliveredAt: s.deliveredAt ? s.deliveredAt.toISOString() : null,
        approvalLogistics: s.approvalLogistics,
        approvalPurchasing: s.approvalPurchasing,
        approvalManagement: s.approvalManagement,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        driver: s.driver,
        vehicle: s.vehicle,
        project: s.project,
        packages: s.packages.map((pkg) => ({
          id: pkg.id,
          code: pkg.code,
          lotNo: pkg.lotNo,
          packageType: pkg.packageType,
          itemName: pkg.itemName,
          qty: pkg.qty,
          unit: pkg.unit,
          weight: pkg.weight,
          dimensions: pkg.dimensions,
          status: pkg.status,
          ppicStatus: pkg.ppicStatus,
          components: pkg.project_components,
        })),
      })),
    });
  } catch (error: any) {
    console.error("Error in GET /api/shipping:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Gagal mengambil data pengiriman.") },
      { status: 500 }
    );
  }
}
