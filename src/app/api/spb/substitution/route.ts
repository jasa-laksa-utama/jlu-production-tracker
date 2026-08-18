import { NextResponse } from "next/server";
import { updateSPBItemSubstitution } from "@/app/actions/spb";

export async function PATCH(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Payload request JSON tidak valid" },
        { status: 400 }
      );
    }

    const { spbItemId, stage, action } = body || {};

    if (!spbItemId || !stage || !action) {
      return NextResponse.json(
        { error: "Parameter spbItemId, stage, dan action wajib diisi" },
        { status: 400 }
      );
    }

    const result = await updateSPBItemSubstitution({
      spbItemId,
      stage,
      action,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json(
      {
        message: result.message,
        spbItem: result.spbItem,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("PATCH /api/spb/substitution error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui status approval substitusi" },
      { status: 500 }
    );
  }
}
