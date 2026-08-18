import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const hasSubOnly = searchParams.get("hasSubstitution");

    let whereClause: any = {};

    if (source === "TRADING_ALL" || source === "TRADING") {
      whereClause.source = "TRADING";
    }

    if (hasSubOnly === "true") {
      whereClause.hasSubstitution = true;
    }

    const items = await prisma.sPBItem.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        typeMerk: true,
        hasSubstitution: true,
        substitutionStatus: true,
        originalName: true,
        originalTypeMerk: true,
        originalPrice: true,
        substitutedName: true,
        substitutedTypeMerk: true,
        substitutedPrice: true,
        substitutionReason: true,
        approvalEngineering: true,
        approvalPpic: true,
        approvalPm: true,
        status: true,
        spb: {
          select: {
            id: true,
            spbNumber: true,
            projectId: true,
            project: {
              select: {
                projectNumber: true,
                projectName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      typeMerk: item.typeMerk,
      hasSubstitution: item.hasSubstitution,
      substitutionStatus: item.substitutionStatus,
      originalName: item.originalName || item.name,
      originalTypeMerk: item.originalTypeMerk || item.typeMerk,
      originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
      substitutedName: item.substitutedName,
      substitutedTypeMerk: item.substitutedTypeMerk,
      substitutedPrice: item.substitutedPrice ? Number(item.substitutedPrice) : null,
      substitutionReason: item.substitutionReason,
      approvalEngineering: item.approvalEngineering,
      approvalPpic: item.approvalPpic,
      approvalPm: item.approvalPm,
      spbNumber: item.spb?.spbNumber,
      projectName: item.spb?.project?.projectName,
      projectNumber: item.spb?.project?.projectNumber,
    }));

    return NextResponse.json(formattedItems);
  } catch (error: any) {
    console.error("GET /api/spb error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data SPB" },
      { status: 500 }
    );
  }
}
