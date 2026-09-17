import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spbItemId, supplierId, supplierName, price, note } = body;

    if (!spbItemId || !supplierName || price === undefined) {
      return NextResponse.json(
        { error: "Parameter spbItemId, supplierName, dan price wajib diisi." },
        { status: 400 }
      );
    }

    // 1. Coba cari di spb_items (SPB Project)
    const existingProjectItem: any[] = await prisma.$queryRaw`
      SELECT id, "candidateSuppliers" FROM spb_items WHERE id = ${spbItemId}
    `;

    if (existingProjectItem.length > 0) {
      let candidates = existingProjectItem[0].candidateSuppliers;
      let updatedCandidatesJson = null;
      if (typeof candidates === "string") {
        try {
          candidates = JSON.parse(candidates);
        } catch (e) {
          candidates = [];
        }
      }
      if (Array.isArray(candidates)) {
        candidates = candidates.map((cand: any) => {
          const isTarget = cand.supplierId === supplierId || cand.supplierName === supplierName;
          return {
            ...cand,
            selectedByDireksi: isTarget,
            direksiNote: isTarget ? note?.trim() || null : cand.direksiNote,
          };
        });
        updatedCandidatesJson = JSON.stringify(candidates);
      }

      if (updatedCandidatesJson) {
        await prisma.$executeRaw`
          UPDATE spb_items
          SET 
            "vendorSelectionStatus" = 'SUBMITTED',
            "approvalPpic" = 'NONE',
            "approvalDireksi" = 'NONE',
            "selectedSupplierId" = ${supplierId || null},
            "selectedSupplierName" = ${supplierName},
            "selectedCatalogPrice" = ${price},
            "vendorSelectionNote" = ${note?.trim() || null},
            "candidateSuppliers" = ${updatedCandidatesJson}::jsonb,
            "updatedAt" = NOW()
          WHERE id = ${spbItemId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE spb_items
          SET 
            "vendorSelectionStatus" = 'SUBMITTED',
            "approvalPpic" = 'NONE',
            "approvalDireksi" = 'NONE',
            "selectedSupplierId" = ${supplierId || null},
            "selectedSupplierName" = ${supplierName},
            "selectedCatalogPrice" = ${price},
            "vendorSelectionNote" = ${note?.trim() || null},
            "updatedAt" = NOW()
          WHERE id = ${spbItemId}
        `;
      }

      // Ambil projectId untuk sinkronisasi progress procurement di Masterplan
      try {
        const rawProj: any[] = await prisma.$queryRaw`
          SELECT s."projectId" 
          FROM spb_items i
          JOIN spbs s ON i."spbId" = s.id
          WHERE i.id = ${spbItemId}
        `;
        if (rawProj.length > 0 && rawProj[0].projectId) {
          const { syncProcurementMasterplanProgress } = await import("@/app/actions/masterplan");
          await syncProcurementMasterplanProgress(rawProj[0].projectId);
        }
      } catch (e) {
        console.error("Error trigger syncProcurementMasterplanProgress:", e);
      }

      return NextResponse.json({
        message: `Vendor (${supplierName}) & Harga berhasil diajukan untuk SPB Project!`,
      });
    }

    // 2. Jika tidak ada di spb_items, cari di spb_gudang_items (SPB Gudang)
    const existingGudangItem: any[] = await prisma.$queryRaw`
      SELECT id, "candidateSuppliers" FROM spb_gudang_items WHERE id = ${spbItemId}
    `;

    if (existingGudangItem.length > 0) {
      let candidates = existingGudangItem[0].candidateSuppliers;
      let updatedCandidatesJson = null;
      if (typeof candidates === "string") {
        try {
          candidates = JSON.parse(candidates);
        } catch (e) {
          candidates = [];
        }
      }
      if (Array.isArray(candidates)) {
        candidates = candidates.map((cand: any) => {
          const isTarget = cand.supplierId === supplierId || cand.supplierName === supplierName;
          return {
            ...cand,
            selectedByDireksi: isTarget,
            direksiNote: isTarget ? note?.trim() || null : cand.direksiNote,
          };
        });
        updatedCandidatesJson = JSON.stringify(candidates);
      }

      if (updatedCandidatesJson) {
        await prisma.$executeRaw`
          UPDATE spb_gudang_items
          SET 
            "vendorSelectionStatus" = 'SUBMITTED',
            "approvalPpic" = 'NONE',
            "approvalDireksi" = 'NONE',
            "selectedSupplierId" = ${supplierId || null},
            "selectedSupplierName" = ${supplierName},
            "selectedCatalogPrice" = ${price},
            "vendorSelectionNote" = ${note?.trim() || null},
            "candidateSuppliers" = ${updatedCandidatesJson}::jsonb,
            "updatedAt" = NOW()
          WHERE id = ${spbItemId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE spb_gudang_items
          SET 
            "vendorSelectionStatus" = 'SUBMITTED',
            "approvalPpic" = 'NONE',
            "approvalDireksi" = 'NONE',
            "selectedSupplierId" = ${supplierId || null},
            "selectedSupplierName" = ${supplierName},
            "selectedCatalogPrice" = ${price},
            "vendorSelectionNote" = ${note?.trim() || null},
            "updatedAt" = NOW()
          WHERE id = ${spbItemId}
        `;
      }

      return NextResponse.json({
        message: `Vendor (${supplierName}) & Harga berhasil diajukan untuk SPB Gudang!`,
      });
    }

    return NextResponse.json(
      { error: `Item SPB dengan ID "${spbItemId}" tidak ditemukan.` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("Error select-supplier API:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Terjadi kesalahan saat memilih supplier.") },
      { status: 500 }
    );
  }
}
