"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";
import { auth } from "@/auth";

/**
 * Updates or creates weekly actual progress for a masterplan phase.
 */
export async function updatePhaseWeeklyProgressAction(params: {
  phaseId: string;
  projectId: string;
  weekNumber: number;
  actualPercent: number; // Kumulatif 0 - 100%
  deltaPercent?: number; // Capaian minggu ini
  notes?: string;
}) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    const { phaseId, projectId, weekNumber, notes } = params;
    const actualPercent = Math.min(100, Math.max(0, Number(params.actualPercent) || 0));

    const phase: any = await prisma.masterplanPhase.findUnique({
      where: { id: phaseId },
      include: {
        masterplan: true,
        weeklyProgresses: {
          orderBy: { weekNumber: "asc" },
        },
      } as any,
    });

    if (!phase) throw new Error("Fase masterplan tidak ditemukan");

    // Resolve delta
    let delta = params.deltaPercent;
    if (delta === undefined || delta === null) {
      // Find progress from previous week (weekNumber - 1)
      const prevEntry = (phase.weeklyProgresses || []).find(
        (wp: any) => wp.weekNumber === weekNumber - 1
      );
      const prevPercent = prevEntry ? Number(prevEntry.actualPercent) : 0;
      delta = Math.max(0, actualPercent - prevPercent);
    }
    delta = Math.round(delta * 100) / 100;

    // Upsert into PhaseWeeklyProgress
    const record = await (prisma as any).phaseWeeklyProgress.upsert({
      where: {
        phaseId_weekNumber: {
          phaseId,
          weekNumber,
        },
      },
      update: {
        actualPercent,
        deltaPercent: delta,
        notes: notes?.trim() || null,
        updatedBy: userBy,
      },
      create: {
        phaseId,
        weekNumber,
        actualPercent,
        deltaPercent: delta,
        notes: notes?.trim() || null,
        updatedBy: userBy,
      },
    });

    // Update phase.actualProgress with the total accumulated progress of all weeks
    const allProgresses = await (prisma as any).phaseWeeklyProgress.findMany({
      where: { phaseId },
      orderBy: { weekNumber: "asc" },
    });

    const totalAccumulatedProgress = allProgresses.reduce(
      (sum: number, p: any) => sum + Number(p.actualPercent || 0),
      0
    );
    const cappedProgress = Math.min(100, Math.round(totalAccumulatedProgress * 100) / 100);

    await prisma.masterplanPhase.update({
      where: { id: phaseId },
      data: {
        actualProgress: cappedProgress,
        status: cappedProgress >= 100 ? "COMPLETED" : cappedProgress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      },
    });

    // Log to Production Log
    const phaseWeight = Number(phase.weightPercent || 0);
    const weekWeightVal = ((actualPercent / 100) * phaseWeight).toFixed(2);
    const totalWeightVal = ((cappedProgress / 100) * phaseWeight).toFixed(2);

    let logMsg = `Update progres mingguan "${phase.name}" Minggu #${weekNumber} sebesar ${actualPercent.toFixed(2)}% (Bobot: ${weekWeightVal}%, Total Capaian: ${cappedProgress.toFixed(2)}% / ${totalWeightVal}% proyek).`;
    if (notes && notes.trim()) {
      logMsg += ` Catatan: "${notes.trim()}".`;
    }

    await prisma.productionLog.create({
      data: {
        projectId,
        message: logMsg,
        user: userBy,
      },
    });

    const serializedRecord = {
      ...record,
      actualPercent: record.actualPercent !== undefined && record.actualPercent !== null ? Number(record.actualPercent) : 0,
      deltaPercent: record.deltaPercent !== undefined && record.deltaPercent !== null ? Number(record.deltaPercent) : 0,
    };

    revalidatePath("/trackers/production");
    return { success: true, data: serializedRecord };
  } catch (error: any) {
    console.error("updatePhaseWeeklyProgressAction error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memperbarui progres mingguan fase."),
    };
  }
}

/**
 * Gets all weekly progress history for a phase.
 */
export async function getPhaseWeeklyProgressHistoryAction(phaseId: string) {
  try {
    const records = await (prisma as any).phaseWeeklyProgress.findMany({
      where: { phaseId },
      orderBy: { weekNumber: "asc" },
    });

    const serializedRecords = (records || []).map((r: any) => ({
      ...r,
      actualPercent: r.actualPercent !== undefined && r.actualPercent !== null ? Number(r.actualPercent) : 0,
      deltaPercent: r.deltaPercent !== undefined && r.deltaPercent !== null ? Number(r.deltaPercent) : 0,
    }));

    return { success: true, data: serializedRecords };
  } catch (error: any) {
    console.error("getPhaseWeeklyProgressHistoryAction error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil riwayat progres mingguan."), data: [] };
  }
}
