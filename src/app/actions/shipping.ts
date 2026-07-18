"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function getProjectShipments(projectId: string) {
  try {
    await requireAuth();
    if (!projectId) return [];

    const shipments = await prisma.shipment.findMany({
      where: { projectId },
      include: {
        driver: true,
        vehicle: true,
        packages: true,
      },
      orderBy: {
        deliveryDate: "desc",
      },
    });

    return shipments.map((s) => ({
      id: s.id,
      suratJalanNo: s.suratJalanNo || "-",
      deliveryDate: s.deliveryDate.toISOString(),
      shippingMethod: s.shippingMethod,
      destination: s.destination,
      status: s.status,
      fleetRequestStatus: s.fleetRequestStatus || "NOT_REQUESTED",
      notes: s.notes || "",
      driverName: s.driver?.name || "-",
      vehicleName: s.vehicle?.name || "-",
      vehiclePlate: s.vehicle?.plateNumber || "-",
      packages: s.packages.map((pkg) => ({
        id: pkg.id,
        code: pkg.code,
        itemName: pkg.itemName,
        qty: pkg.qty,
        unit: pkg.unit,
        status: pkg.status,
        lotNo: pkg.lotNo,
        weight: pkg.weight,
        dimensions: pkg.dimensions,
      })),
    }));
  } catch (error) {
    console.error("Error fetching project shipments:", error);
    return [];
  }
}

export async function getAllShipments() {
  try {
    await requireAuth();
    const shipments = await prisma.shipment.findMany({
      include: {
        project: true,
        driver: true,
        vehicle: true,
        packages: true,
      },
      orderBy: {
        deliveryDate: "desc",
      },
    });

    return {
      success: true,
      data: shipments.map((s) => ({
        id: s.id,
        suratJalanNo: s.suratJalanNo || "-",
        deliveryDate: s.deliveryDate.toISOString(),
        shippingMethod: s.shippingMethod,
        destination: s.destination,
        status: s.status,
        fleetRequestStatus: s.fleetRequestStatus || "NOT_REQUESTED",
        notes: s.notes || "",
        projectId: s.projectId,
        projectNumber: s.project?.projectNumber || "-",
        projectName: s.project?.projectName || "-",
        driverName: s.driver?.name || "-",
        vehicleName: s.vehicle?.name || "-",
        vehiclePlate: s.vehicle?.plateNumber || "-",
        packages: s.packages.map((pkg) => ({
          id: pkg.id,
          code: pkg.code,
          itemName: pkg.itemName,
          qty: pkg.qty,
          unit: pkg.unit,
          status: pkg.status,
          lotNo: pkg.lotNo,
          weight: pkg.weight,
          dimensions: pkg.dimensions,
        })),
      })),
    };
  } catch (error: any) {
    console.error("Error fetching all shipments:", error);
    return { error: error.message || "Gagal mengambil data pengiriman." };
  }
}

