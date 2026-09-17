"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { sanitizeErrorMessage } from "@/lib/error-handler";

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
    return { error: sanitizeErrorMessage(error, "Gagal mengambil data pengiriman.") };
  }
}

export async function getShipmentPackagesForPpic(ppicStatus?: string) {
  try {
    await requireAuth();
    const whereClause: any = {};
    if (ppicStatus && ppicStatus !== "ALL") {
      whereClause.ppicStatus = ppicStatus;
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

    return {
      success: true,
      data: JSON.parse(JSON.stringify(packages)),
    };
  } catch (error: any) {
    console.error("Error fetching shipment packages for PPIC:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil data paket koli."),
      data: [],
    };
  }
}

export async function approveShipmentPackageByPpic(
  packageIds: string[],
  notes?: string
) {
  try {
    const user = await requireAuth();
    if (!packageIds || packageIds.length === 0) {
      return { success: false, error: "Pilih minimal 1 paket untuk disetujui." };
    }

    const validatorName = user.name || "PPIC Approver";
    const now = new Date();

    const result = await prisma.shipmentPackage.updateMany({
      where: {
        id: { in: packageIds },
      },
      data: {
        ppicStatus: "APPROVED",
        ppicApprovedAt: now,
        ppicApprovedBy: validatorName,
        ppicNotes: notes || null,
      },
    });

    const packages = await prisma.shipmentPackage.findMany({
      where: { id: { in: packageIds } },
      select: { projectId: true },
    });
    const uniqueProjectIds = Array.from(new Set(packages.map((p) => p.projectId)));

    const { recalculateProjectShippingProgress } = await import("@/lib/shipping-progress-calculator");
    for (const pId of uniqueProjectIds) {
      await recalculateProjectShippingProgress(pId).catch(console.error);
    }

    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Berhasil menyetujui ${result.count} paket koli. Surat Jalan kini dapat diterbitkan.`,
      updatedCount: result.count,
    };
  } catch (error: any) {
    console.error("Error approving shipment packages:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyetujui paket koli."),
    };
  }
}

export async function rejectShipmentPackageByPpic(
  packageIds: string[],
  reason: string
) {
  try {
    const user = await requireAuth();
    if (!packageIds || packageIds.length === 0) {
      return { success: false, error: "Pilih minimal 1 paket untuk ditolak." };
    }
    if (!reason || !reason.trim()) {
      return { success: false, error: "Alasan penolakan (Reject) wajib diisi." };
    }

    const validatorName = user.name || "PPIC Approver";
    const now = new Date();

    const result = await prisma.shipmentPackage.updateMany({
      where: {
        id: { in: packageIds },
      },
      data: {
        ppicStatus: "REJECTED",
        ppicNotes: reason.trim(),
        ppicApprovedAt: now,
        ppicApprovedBy: validatorName,
      },
    });

    const packages = await prisma.shipmentPackage.findMany({
      where: { id: { in: packageIds } },
      select: { projectId: true },
    });
    const uniqueProjectIds = Array.from(new Set(packages.map((p) => p.projectId)));

    const { recalculateProjectShippingProgress } = await import("@/lib/shipping-progress-calculator");
    for (const pId of uniqueProjectIds) {
      await recalculateProjectShippingProgress(pId).catch(console.error);
    }

    revalidatePath("/trackers/spb-approval-ppic");
    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Berhasil menolak ${result.count} paket koli. Logistik harus merevisi muatan.`,
      updatedCount: result.count,
    };
  } catch (error: any) {
    console.error("Error rejecting shipment packages:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menolak paket koli."),
    };
  }
}

/**
 * Memperbarui status Surat Jalan / Shipment (READY_TO_SHIP -> IN_DELIVERY -> DELIVERED / RETUR)
 * dan otomatis mengupdate koli serta menghitung ulang progress shipping unit di Masterplan.
 */
export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: "READY_TO_SHIP" | "IN_DELIVERY" | "DELIVERED" | "RETUR",
  metadata?: {
    receivedByName?: string;
    deliveryProofUrl?: string;
    notes?: string;
  }
) {
  try {
    await requireAuth();

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { packages: true },
    });

    if (!shipment) {
      return { success: false, error: "Data pengiriman (Surat Jalan) tidak ditemukan." };
    }

    const updateData: any = {
      status: newStatus,
    };

    if (newStatus === "DELIVERED") {
      updateData.deliveredAt = new Date();
      if (metadata?.receivedByName) updateData.receivedByName = metadata.receivedByName;
      if (metadata?.deliveryProofUrl) updateData.deliveryProofUrl = metadata.deliveryProofUrl;
    }

    if (metadata?.notes) {
      updateData.notes = metadata.notes;
    }

    // 1. Update Shipment record
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: updateData,
    });

    // 2. Sinkronkan status seluruh paket koli di dalam shipment ini
    await prisma.shipmentPackage.updateMany({
      where: { shipmentId },
      data: { status: newStatus },
    });

    // 3. Hitung ulang progres shipping proyek & unit conveyor di Masterplan
    const { recalculateProjectShippingProgress } = await import(
      "@/lib/shipping-progress-calculator"
    );
    const summary = await recalculateProjectShippingProgress(shipment.projectId);

    revalidatePath("/trackers/ppic");
    revalidatePath("/trackers/production");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Status pengiriman berhasil diubah menjadi ${newStatus}.`,
      data: summary,
    };
  } catch (error: any) {
    console.error("Error updating shipment status:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memperbarui status pengiriman."),
    };
  }
}

/**
 * Mengambil data breakdown shipping per unit conveyor untuk dialog/monitoring Masterplan.
 */
export async function getProjectShippingBreakdownAction(projectId: string) {
  try {
    await requireAuth();
    const { recalculateProjectShippingProgress } = await import(
      "@/lib/shipping-progress-calculator"
    );
    // Sinkronkan ke MasterplanPhase dan kembalikan breakdown terkini
    const breakdown = await recalculateProjectShippingProgress(projectId);

    revalidatePath("/trackers/production");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(breakdown)),
    };
  } catch (error: any) {
    console.error("Error getProjectShippingBreakdownAction:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal mengambil rincian progress shipping unit."),
      data: null,
    };
  }
}


