import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/error-handler";

/**
 * GET /api/warehouse/spb-items
 * Allows external Purchasing / Warehouse System to fetch SPB warehouse items
 * that require release approval / preparation.
 *
 * Query Parameters:
 *  - status: "PENDING" | "APPROVED_WAREHOUSE" | "PREPARING" | "REJECTED" | "ALL" (default: "PENDING")
 *  - projectId: optional UUID
 *  - limit: number (default: 50)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "PENDING";
    const projectIdParam = searchParams.get("projectId") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const itemWhere: any = {
      source: "WAREHOUSE",
    };
    if (statusParam !== "ALL") {
      itemWhere.status = statusParam;
    }

    const spbWhere: any = {
      status: "APPROVED",
    };
    if (projectIdParam) {
      spbWhere.projectId = projectIdParam;
    }

    // 1. Fetch from regular SPBs (source: WAREHOUSE)
    const spbs = await prisma.sPB.findMany({
      where: spbWhere,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
          },
        },
        items: {
          where: itemWhere,
        },
      },
    });

    // 2. Fetch from SpbGudangs
    const sgWhere: any = {
      status: "APPROVED",
    };
    if (projectIdParam) {
      sgWhere.projectId = projectIdParam;
    }

    const spbGudangs = await prisma.spbGudang.findMany({
      where: sgWhere,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectNumber: true,
          },
        },
        items: {
          where: itemWhere,
        },
      },
    });

    const formattedItems: any[] = [];

    for (const spb of spbs) {
      for (const item of spb.items) {
        formattedItems.push({
          spbItemId: item.id,
          spbType: "PROJECT_SPB",
          spbNumber: spb.spbNumber,
          projectId: spb.projectId,
          projectNumber: spb.project?.projectNumber || "GENERAL",
          projectName: spb.project?.projectName || "General Project",
          itemName: item.name,
          typeMerk: item.typeMerk,
          qty: item.qty,
          qtyIssued: item.qtyIssued,
          unit: item.unit,
          source: item.source,
          status: item.status,
          createdAt: item.createdAt,
        });
      }
    }

    for (const sg of spbGudangs) {
      for (const item of sg.items) {
        formattedItems.push({
          spbItemId: item.id,
          spbType: "SPB_GUDANG",
          spbNumber: sg.spbNumber,
          projectId: sg.projectId,
          projectNumber: sg.project?.projectNumber || "GENERAL",
          projectName: sg.project?.projectName || "General Project",
          itemName: item.name,
          typeMerk: item.typeMerk,
          qty: item.qty,
          unit: item.unit,
          source: item.source,
          status: item.status,
          createdAt: item.createdAt,
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: formattedItems.length,
      data: formattedItems,
    });
  } catch (error: any) {
    console.error("[API GET /api/warehouse/spb-items] Error:", error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil data item SPB gudang") },
      { status: 500 }
    );
  }
}
