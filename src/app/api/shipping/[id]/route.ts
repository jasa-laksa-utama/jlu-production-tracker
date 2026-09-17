import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID Pengiriman wajib disertakan." },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        driver: true,
        vehicle: true,
        project: {
          include: {
            customer: true,
          },
        },
        packages: {
          include: {
            project_components: true,
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Pengiriman tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      shipment: {
        id: shipment.id,
        suratJalanNo: shipment.suratJalanNo,
        projectId: shipment.projectId,
        deliveryDate: shipment.deliveryDate.toISOString(),
        shippingMethod: shipment.shippingMethod,
        destination: shipment.destination,
        estimatedWeight: shipment.estimatedWeight,
        estimatedDimension: shipment.estimatedDimension,
        notes: shipment.notes,
        status: shipment.status,
        fleetRequestStatus: shipment.fleetRequestStatus,
        driverId: shipment.driverId,
        vehicleId: shipment.vehicleId,
        expeditionName: shipment.expeditionName,
        driverName: shipment.driver?.name || shipment.driverName,
        driverPhone: shipment.driver?.phone || shipment.driverPhone,
        vehiclePlateNumber: shipment.vehicle?.plateNumber || shipment.vehiclePlateNumber,
        createdByName: shipment.createdByName,
        deliveryProofUrl: shipment.deliveryProofUrl,
        receivedByName: shipment.receivedByName,
        deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.toISOString() : null,
        approvalLogistics: shipment.approvalLogistics,
        approvalPurchasing: shipment.approvalPurchasing,
        approvalManagement: shipment.approvalManagement,
        createdAt: shipment.createdAt.toISOString(),
        updatedAt: shipment.updatedAt.toISOString(),
        driver: shipment.driver,
        vehicle: shipment.vehicle,
        project: shipment.project,
        packages: shipment.packages.map((pkg) => ({
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
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/shipping/[id]:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Gagal mengambil data detail pengiriman.") },
      { status: 500 }
    );
  }
}
