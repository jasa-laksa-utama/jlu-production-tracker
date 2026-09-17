"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { syncEngineeringMasterplanProgress } from "@/app/actions/masterplan";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export async function updateProjectEstimatedTonnage(
  projectId: string,
  estimatedTonnage: number
) {
  try {
    await requireAuth();

    if (!projectId) {
      return { success: false, error: "ID Proyek tidak valid" };
    }

    const val = Math.max(0, Number(estimatedTonnage) || 0);

    // Update Project via Prisma Client
    const updatedProj = await prisma.project.update({
      where: { id: projectId },
      data: { estimatedTonnage: val },
      select: { id: true, leadId: true },
    });

    // Juga update Lead jika terhubung
    if (updatedProj.leadId) {
      try {
        await prisma.lead.update({
          where: { id: updatedProj.leadId },
          data: { estimatedTonnage: val },
        });
      } catch (e) {
        console.error("Error updating lead estimatedTonnage:", e);
      }
    }

    // Trigger sync ke Masterplan
    await syncEngineeringMasterplanProgress(projectId);

    revalidatePath("/trackers/engineering");
    revalidatePath("/leads");
    revalidatePath("/masterplan");

    return {
      success: true,
      message: `Estimasi Total Tonase Proyek berhasil diperbarui menjadi ${val} Ton`,
      estimatedTonnage: val,
    };
  } catch (error: any) {
    console.error("Error updateProjectEstimatedTonnage:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memperbarui estimasi tonase proyek."),
    };
  }
}
