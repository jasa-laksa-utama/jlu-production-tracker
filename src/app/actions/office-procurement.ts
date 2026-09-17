"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export interface OfficeBoQItemInput {
  id?: string;
  itemId?: string | null;
  itemCode?: string | null;
  name: string;
  category?: string;
  qty: number;
  unit: string;
  estimatedPrice: number;
  notes?: string;
}

export interface OfficeMasterItem {
  id: string;
  code: string;
  name: string;
  typeMerk: string | null;
  category: string;
  unitPrice: number;
  currentStock: number;
  unit: string;
  location?: string | null;
}

export interface OfficeUnit {
  id: string;
  name: string;
}

export interface OfficeBoQInput {
  boqNumber: string;
  title: string;
  department: string;
  makerName?: string;
  notes?: string;
  items: OfficeBoQItemInput[];
}

export interface OfficeSPBItemInput {
  name: string;
  spec?: string;
  category?: string;
  qty: number;
  unit: string;
  estimatedPrice?: number;
  notes?: string;
}

export interface OfficeSPBInput {
  spbNumber: string;
  purpose: string;
  department: string;
  officeBoqId?: string | null;
  requiredDate?: string | null;
  makerName?: string;
  notes?: string;
  items: OfficeSPBItemInput[];
}

/**
 * Mengambil master barang kantor dari tabel items dengan kategori 'B' atau 'C'.
 * Kategori 'A' adalah barang produksi/fabrikasi dan dikecualikan dari BOQ kantor.
 */
export async function getOfficeMasterItems() {
  try {
    await requireAuth();

    const items = await prisma.item.findMany({
      where: {
        category: { in: ["B", "C"] },
      },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      success: true,
      data: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name || "Tanpa Nama",
        typeMerk: item.typeMerk,
        category: item.category,
        unitPrice: Number(item.unitPrice || 0),
        currentStock: Number(item.currentStock || 0),
        unit: item.unit?.name || "pcs",
        location: item.location?.name || null,
      })) as OfficeMasterItem[],
    };
  } catch (error: any) {
    console.error("getOfficeMasterItems error:", error);
    return {
      success: false,
      data: [] as OfficeMasterItem[],
      error: sanitizeErrorMessage(error, "Gagal memuat master data barang kantor."),
    };
  }
}

/**
 * Mengambil daftar seluruh master satuan (Unit) dari tabel units.
 */
export async function getOfficeUnits() {
  try {
    await requireAuth();

    const units = await prisma.unit.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return {
      success: true,
      data: units.map((u) => ({
        id: u.id,
        name: u.name,
      })) as OfficeUnit[],
    };
  } catch (error: any) {
    console.error("getOfficeUnits error:", error);
    return {
      success: false,
      data: [] as OfficeUnit[],
      error: sanitizeErrorMessage(error, "Gagal memuat daftar satuan."),
    };
  }
}

/**
 * Mengambil ringkasan metrik dan daftar seluruh BOQ & SPB Umum Kantor.
 */
export async function getOfficeProcurementData() {
  try {
    await requireAuth();

    const [boqs, spbs] = await Promise.all([
      prisma.officeBoQ.findMany({
        include: {
          items: true,
          spbs: {
            select: {
              id: true,
              spbNumber: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.officeSPB.findMany({
        include: {
          items: true,
          officeBoq: {
            select: {
              id: true,
              boqNumber: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Format serialized items and metrics
    const serializedBoqs = boqs.map((b) => ({
      ...b,
      totalEstimate: Number(b.totalEstimate || 0),
      items: b.items.map((it) => ({
        ...it,
        estimatedPrice: Number(it.estimatedPrice || 0),
        subtotal: Number(it.subtotal || 0),
      })),
    }));

    const serializedSpbs = spbs.map((s) => ({
      ...s,
      totalEstimate: Number(s.totalEstimate || 0),
      items: s.items.map((it) => ({
        ...it,
        estimatedPrice: Number(it.estimatedPrice || 0),
        subtotal: Number(it.subtotal || 0),
      })),
    }));

    // Hitung metrik analitik sederhana (C-1, C-2, No AI Slop)
    const totalBoqs = serializedBoqs.length;
    const pendingSpbs = serializedSpbs.filter(
      (s) => s.status === "PENDING_APPROVAL",
    ).length;
    const approvedSpbs = serializedSpbs.filter(
      (s) => s.status === "APPROVED" || s.status === "COMPLETED",
    ).length;
    const totalSpendEstimate = serializedSpbs
      .filter((s) => s.status !== "REJECTED")
      .reduce((sum, s) => sum + s.totalEstimate, 0);

    return {
      success: true,
      metrics: {
        totalBoqs,
        pendingSpbs,
        approvedSpbs,
        totalSpendEstimate,
      },
      boqs: serializedBoqs,
      spbs: serializedSpbs,
    };
  } catch (error: any) {
    console.error("getOfficeProcurementData error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memuat data pengadaan kantor."),
      metrics: {
        totalBoqs: 0,
        pendingSpbs: 0,
        approvedSpbs: 0,
        totalSpendEstimate: 0,
      },
      boqs: [],
      spbs: [],
    };
  }
}

/**
 * Menghasilkan nomor BOQ Umum baru otomatis: BOQ-KTR-YYMM-XXX
 */
export async function generateOfficeBoQNumber() {
  try {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `BOQ-KTR-${yy}${mm}`;

    const count = await prisma.officeBoQ.count({
      where: {
        boqNumber: {
          startsWith: prefix,
        },
      },
    });

    const nextIndex = String(count + 1).padStart(3, "0");
    return `${prefix}-${nextIndex}`;
  } catch {
    return `BOQ-KTR-${Date.now()}`;
  }
}

/**
 * Menghasilkan nomor SPB Umum baru otomatis: SPB-KTR-YYMM-XXX
 */
export async function generateOfficeSPBNumber() {
  try {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `SPB-KTR-${yy}${mm}`;

    const count = await prisma.officeSPB.count({
      where: {
        spbNumber: {
          startsWith: prefix,
        },
      },
    });

    const nextIndex = String(count + 1).padStart(3, "0");
    return `${prefix}-${nextIndex}`;
  } catch {
    return `SPB-KTR-${Date.now()}`;
  }
}

/**
 * Membuat BOQ Umum Kantor Baru beserta daftar itemnya.
 */
export async function createOfficeBoQ(data: OfficeBoQInput) {
  try {
    const user = await requireAuth();

    if (!data.boqNumber || !data.title) {
      throw new Error("Nomor BOQ dan judul kebutuhan wajib diisi.");
    }

    if (!data.items || data.items.length === 0) {
      throw new Error("Minimal harus ada 1 item barang dalam BOQ Umum.");
    }

    // Hitung subtotal dan total anggaran
    let totalEstimate = 0;
    const itemsData = data.items.map((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.estimatedPrice) || 0;
      const subtotal = qty * price;
      totalEstimate += subtotal;

      return {
        itemId: it.itemId || null,
        itemCode: it.itemCode || null,
        name: it.name.trim(),
        category: it.category || "ATK",
        qty,
        unit: it.unit || "pcs",
        estimatedPrice: price,
        subtotal,
        notes: it.notes?.trim() || null,
      };
    });

    const newBoq = await prisma.officeBoQ.create({
      data: {
        boqNumber: data.boqNumber.trim(),
        title: data.title.trim(),
        department: data.department || "GENERAL",
        makerName: data.makerName || user.name || "Admin Kantor",
        notes: data.notes?.trim() || null,
        totalEstimate,
        status: "DRAFT",
        items: {
          create: itemsData,
        },
      },
    });

    const serializedBoq = {
      id: newBoq.id,
      boqNumber: newBoq.boqNumber,
      title: newBoq.title,
      totalEstimate: Number(newBoq.totalEstimate || 0),
    };

    revalidatePath("/office-procurement");
    return { success: true, data: serializedBoq, message: "BOQ Umum berhasil dibuat." };
  } catch (error: any) {
    console.error("createOfficeBoQ error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal membuat BOQ Umum kantor."),
    };
  }
}

/**
 * Memperbarui BOQ Umum Kantor beserta daftar itemnya.
 */
export async function updateOfficeBoQ(id: string, data: OfficeBoQInput) {
  try {
    await requireAuth();

    if (!id) throw new Error("ID BOQ tidak valid.");

    let totalEstimate = 0;
    const itemsData = data.items.map((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.estimatedPrice) || 0;
      const subtotal = qty * price;
      totalEstimate += subtotal;

      return {
        itemId: it.itemId || null,
        itemCode: it.itemCode || null,
        name: it.name.trim(),
        category: it.category || "ATK",
        qty,
        unit: it.unit || "pcs",
        estimatedPrice: price,
        subtotal,
        notes: it.notes?.trim() || null,
      };
    });

    await prisma.$transaction(async (tx) => {
      // Hapus item lama
      await tx.officeBoQItem.deleteMany({
        where: { officeBoqId: id },
      });

      // Update header dan buat item baru
      await tx.officeBoQ.update({
        where: { id },
        data: {
          title: data.title.trim(),
          department: data.department || "GENERAL",
          notes: data.notes?.trim() || null,
          totalEstimate,
          items: {
            create: itemsData,
          },
        },
      });
    });

    revalidatePath("/office-procurement");
    return { success: true, message: "BOQ Umum berhasil diperbarui." };
  } catch (error: any) {
    console.error("updateOfficeBoQ error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memperbarui BOQ Umum kantor."),
    };
  }
}

/**
 * Menghapus BOQ Umum Kantor.
 */
export async function deleteOfficeBoQ(id: string) {
  try {
    await requireAuth();

    if (!id) throw new Error("ID BOQ tidak valid.");

    await prisma.officeBoQ.delete({
      where: { id },
    });

    revalidatePath("/office-procurement");
    return { success: true, message: "BOQ Umum berhasil dihapus." };
  } catch (error: any) {
    console.error("deleteOfficeBoQ error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menghapus BOQ Umum."),
    };
  }
}

/**
 * Membuat SPB Umum Kantor Baru.
 */
export async function createOfficeSPB(data: OfficeSPBInput) {
  try {
    const user = await requireAuth();

    if (!data.spbNumber || !data.purpose) {
      throw new Error("Nomor SPB dan keperluan pengadaan wajib diisi.");
    }

    if (!data.items || data.items.length === 0) {
      throw new Error("Minimal harus ada 1 item barang yang diajukan.");
    }

    let totalEstimate = 0;
    const itemsData = data.items.map((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.estimatedPrice) || 0;
      const subtotal = qty * price;
      totalEstimate += subtotal;

      return {
        name: it.name.trim(),
        spec: it.spec?.trim() || null,
        category: it.category || "ATK",
        qty,
        unit: it.unit || "pcs",
        estimatedPrice: price,
        subtotal,
        notes: it.notes?.trim() || null,
      };
    });

    const newSpb = await prisma.officeSPB.create({
      data: {
        spbNumber: data.spbNumber.trim(),
        purpose: data.purpose.trim(),
        department: data.department || "GENERAL",
        officeBoqId: data.officeBoqId || null,
        requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
        makerName: data.makerName || user.name || "Admin Kantor",
        totalEstimate,
        notes: data.notes?.trim() || null,
        status: "PENDING_APPROVAL",
        items: {
          create: itemsData,
        },
      },
    });

    const serializedSpb = {
      id: newSpb.id,
      spbNumber: newSpb.spbNumber,
      purpose: newSpb.purpose,
      totalEstimate: Number(newSpb.totalEstimate || 0),
    };

    revalidatePath("/office-procurement");
    return { success: true, data: serializedSpb, message: "Pengajuan SPB Umum berhasil dikirim." };
  } catch (error: any) {
    console.error("createOfficeSPB error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal membuat pengajuan SPB Umum kantor."),
    };
  }
}

/**
 * Memperbarui SPB Umum Kantor.
 */
export async function updateOfficeSPB(id: string, data: OfficeSPBInput) {
  try {
    await requireAuth();

    if (!id) throw new Error("ID SPB tidak valid.");

    let totalEstimate = 0;
    const itemsData = data.items.map((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.estimatedPrice) || 0;
      const subtotal = qty * price;
      totalEstimate += subtotal;

      return {
        name: it.name.trim(),
        spec: it.spec?.trim() || null,
        category: it.category || "ATK",
        qty,
        unit: it.unit || "pcs",
        estimatedPrice: price,
        subtotal,
        notes: it.notes?.trim() || null,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.officeSPBItem.deleteMany({
        where: { officeSpbId: id },
      });

      await tx.officeSPB.update({
        where: { id },
        data: {
          purpose: data.purpose.trim(),
          department: data.department || "GENERAL",
          officeBoqId: data.officeBoqId || null,
          requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
          totalEstimate,
          notes: data.notes?.trim() || null,
          items: {
            create: itemsData,
          },
        },
      });
    });

    revalidatePath("/office-procurement");
    return { success: true, message: "SPB Umum berhasil diperbarui." };
  } catch (error: any) {
    console.error("updateOfficeSPB error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memperbarui SPB Umum."),
    };
  }
}

/**
 * Menghapus SPB Umum Kantor.
 */
export async function deleteOfficeSPB(id: string) {
  try {
    await requireAuth();

    if (!id) throw new Error("ID SPB tidak valid.");

    await prisma.officeSPB.delete({
      where: { id },
    });

    revalidatePath("/office-procurement");
    return { success: true, message: "SPB Umum berhasil dihapus." };
  } catch (error: any) {
    console.error("deleteOfficeSPB error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menghapus SPB Umum."),
    };
  }
}

/**
 * Menyetujui SPB Umum Kantor (Approve).
 */
export async function approveOfficeSPB(id: string) {
  try {
    const user = await requireAuth();

    if (!id) throw new Error("ID SPB tidak valid.");

    await prisma.officeSPB.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: user.name || "Manajemen",
        approvedAt: new Date(),
        rejectedReason: null,
        rejectedAt: null,
      },
    });

    revalidatePath("/office-procurement");
    return { success: true, message: "SPB Umum berhasil disetujui." };
  } catch (error: any) {
    console.error("approveOfficeSPB error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyetujui SPB Umum."),
    };
  }
}

/**
 * Menolak SPB Umum Kantor (Reject).
 */
export async function rejectOfficeSPB(id: string, reason: string) {
  try {
    await requireAuth();

    if (!id) throw new Error("ID SPB tidak valid.");
    if (!reason || !reason.trim()) {
      throw new Error("Alasan penolakan wajib dicantumkan.");
    }

    await prisma.officeSPB.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedReason: reason.trim(),
        rejectedAt: new Date(),
      },
    });

    revalidatePath("/office-procurement");
    return { success: true, message: "SPB Umum telah ditolak." };
  } catch (error: any) {
    console.error("rejectOfficeSPB error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menolak SPB Umum."),
    };
  }
}

/**
 * Menyelesaikan SPB Umum Kantor (Barang Selesai Dibeli / Diterima).
 */
export async function completeOfficeSPB(id: string) {
  try {
    await requireAuth();

    if (!id) throw new Error("ID SPB tidak valid.");

    await prisma.officeSPB.update({
      where: { id },
      data: {
        status: "COMPLETED",
      },
    });

    revalidatePath("/office-procurement");
    return { success: true, message: "SPB Umum telah ditandai selesai." };
  } catch (error: any) {
    console.error("completeOfficeSPB error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyelesaikan SPB Umum."),
    };
  }
}
