"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";
import { requireAuth } from "@/lib/auth-guard";

const DEFAULT_STAGES_CONFIG = [
  {
    name: "Fabrikasi",
    subSteps: ["Cutting", "Assembly", "Welding"],
  },
  {
    name: "Machining",
    subSteps: ["Lathe (Bubut)", "Milling (Frais)"],
  },
  {
    name: "Mechanical",
    subSteps: ["Assembly", "Alignment"],
  },
  {
    name: "Finishing",
    subSteps: ["Sandblasting", "Painting"],
  },
];

/**
 * Starts production by validating drawing, material checklist, leader, team, and memo.
 * Automatically initializes default components, stages, and sub-steps in the database.
 */
export async function startProduction(
  projectId: string,
  setupData: {
    drawingApproved: boolean;
    drawingLink: string;
    materialsReady: boolean;
    materialsNotes: string;
    instructionMemo: string;
    leader: string;
    team: string;
    components?: string[];
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new Error("Project not found");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update project status columns
      await tx.project.update({
        where: { id: projectId },
        data: {
          currentDivision: "PRODUCTION",
          currentStatus: "IN_PROGRESS",
          status: "IN_PROGRESS",
          prodStatus: "IN_PROGRESS",
        },
      });

      // 2. Create entry in project history (close previous active one if any)
      const lastHistory = await tx.projectHistory.findFirst({
        where: { projectId, exitDate: null },
        orderBy: { entryDate: "desc" },
      });
      if (lastHistory) {
        await tx.projectHistory.update({
          where: { id: lastHistory.id },
          data: { exitDate: new Date() },
        });
      }

      await tx.projectHistory.create({
        data: {
          projectId,
          division: "PRODUCTION",
          status: "IN_PROGRESS",
          entryDate: new Date(),
          notes: `Memulai Produksi - Leader: ${setupData.leader}, Team: ${setupData.team}. Memo: ${setupData.instructionMemo.substring(0, 50)}...`,
          updatedBy: userBy,
        },
      });

      // 3. Create Production Setup record
      const setup = await tx.productionSetup.create({
        data: {
          projectId,
          drawingApproved: setupData.drawingApproved,
          drawingLink: setupData.drawingLink,
          materialsReady: setupData.materialsReady,
          materialsNotes: setupData.materialsNotes,
          instructionMemo: setupData.instructionMemo,
          leader: setupData.leader,
          team: setupData.team,
          startedBy: userBy,
        },
      });

      // 4. Initialize default stages and sub-steps directly under the project
      for (const stageConfig of DEFAULT_STAGES_CONFIG) {
        const stage = await tx.productionStage.create({
          data: {
            projectId,
            name: stageConfig.name,
            progress: 0,
            status: "READY",
          },
        });

        for (const subStepName of stageConfig.subSteps) {
          await tx.productionSubStep.create({
            data: {
              stageId: stage.id,
              name: subStepName,
              checked: false,
            },
          });
        }
      }

      // 4.5. Initialize initial components if provided
      if (setupData.components && setupData.components.length > 0) {
        for (const compName of setupData.components) {
          if (!compName.trim()) continue;
          const component = await tx.projectComponent.create({
            data: {
              projectId,
              name: compName.trim(),
            },
          });

          // All 4 default stages are active for these initial components
          for (const stageConfig of DEFAULT_STAGES_CONFIG) {
            await tx.componentStage.create({
              data: {
                componentId: component.id,
                name: stageConfig.name,
                status: "READY",
                progress: 0,
                qcStatus: "PENDING",
              },
            });
          }
        }

        // Sync project stages to match the initial components (they are all at 0%)
        for (const stageConfig of DEFAULT_STAGES_CONFIG) {
          await syncProjectStageFromComponents(tx, projectId, stageConfig.name);
        }
      }

      // 5. Create production log entry
      await tx.productionLog.create({
        data: {
          projectId,
          message: "Persiapan Produksi selesai. Produksi Resmi Dimulai.",
          user: userBy,
        },
      });

      return setup;
    });

    // Send notifications
    try {
      await createNotification({
        title: `Produksi Dimulai: ${project.projectName}`,
        message: `${userBy} menyetujui persiapan produksi dan memulai pengerjaan fisik untuk proyek ${project.projectNumber || "-"}.`,
        type: "SUCCESS",
        module: "TRACKER",
        targetUrl: `/trackers/production?search=${encodeURIComponent(project.projectNumber || "")}`,
      });
    } catch (err) {
      console.error("Failed to trigger start production notification:", err);
    }

    revalidatePath("/trackers/production");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Failed to start production" };
  }
}

/**
 * Updates progress and checklist for a specific production stage.
 * Checks for Finishing stage constraint (all prior stages must be complete).
 */
export async function updateProductionStage(
  projectId: string,
  stageId: string,
  data: {
    progress: number;
    status: "READY" | "IN_PROGRESS" | "PAUSED" | "DONE" | "REVISION";
    notes?: string;
    assignedLeader?: string;
    assignedTeam?: string;
    subSteps: { id: string; checked: boolean }[];
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    const stage = await prisma.productionStage.findUnique({
      where: { id: stageId },
    });
    if (!stage) throw new Error("Stage not found");

    // Enforce Finishing Stage constraint:
    // Finishing can only be started/progressed if all other stages of the project are 100% DONE
    if (stage.name === "Finishing" && (data.progress > 0 || data.status === "IN_PROGRESS" || data.status === "DONE")) {
      const projectStages = await prisma.productionStage.findMany({
        where: { projectId: stage.projectId },
      });

      const otherStagesIncomplete = projectStages
        .filter((s) => s.id !== stageId)
        .filter((s) => s.status !== "DONE" && s.progress < 100);

      if (otherStagesIncomplete.length > 0) {
        const names = otherStagesIncomplete.map((s) => s.name).join(", ");
        throw new Error(
          `Pekerjaan Finishing tidak bisa dimulai karena tahapan lain pada proyek belum selesai: [ ${names} ].`
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update all sub-steps
      for (const step of data.subSteps) {
        await tx.productionSubStep.update({
          where: { id: step.id },
          data: { checked: step.checked },
        });
      }

      // 2. Update stage status & progress
      const updateStageData: any = {
        progress: data.progress,
        status: data.status,
        notes: data.notes,
        assignedLeader: data.assignedLeader,
        assignedTeam: data.assignedTeam,
      };

      if (stage.qcStatus === "REJECTED") {
        updateStageData.qcStatus = "PENDING";
      }

      const updatedStage = await tx.productionStage.update({
        where: { id: stageId },
        data: updateStageData,
      });

      // 3. Write a production log listing checked sub-steps and localized status
      const subSteps = await tx.productionSubStep.findMany({
        where: { stageId },
        orderBy: { createdAt: "asc" },
      });
      
      const statusMap: Record<string, string> = {
        READY: "Belum Mulai",
        IN_PROGRESS: "Dalam Proses",
        PAUSED: "Ditangguhkan",
        DONE: "Selesai",
        REVISION: "Revisi",
      };
      const statusText = statusMap[data.status] || data.status;

      let stepText = "";
      if (subSteps.length > 0) {
        const lastCheckedStep = [...subSteps].reverse().find((s) => s.checked);
        if (lastCheckedStep) {
          if (data.status === "DONE" || data.progress === 100) {
            stepText = "Selesai ";
          } else {
            stepText = `ada di tahap ${lastCheckedStep.name} `;
          }
        } else {
          stepText = "Belum Mulai ";
        }
      }

      const logMessage = `${stage.name} ${stepText}(${statusText}).${data.notes ? ` Catatan: ${data.notes}` : ""}`;

      await tx.productionLog.create({
        data: {
          projectId,
          message: logMessage,
          user: userBy,
        },
      });

      await syncProjectProdStatus(tx, projectId);
      await syncProjectQCStatus(tx, projectId);

      return updatedStage;
    });

    revalidatePath("/trackers/production");
    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Failed to update production stage" };
  }
}

/**
 * Hands over a completed project from Production to Quality Control.
 */
export async function handoverProductionToQC(projectId: string, notes: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new Error("Project not found");

    // Perform verification: Check if all stages (specifically finishing) are 100% DONE
    const stages = await prisma.productionStage.findMany({
      where: { projectId },
    });

    if (stages.length === 0) {
      throw new Error("Cannot handover to QC: Project has no production stages.");
    }

    const finishingStage = stages.find((s) => s.name === "Finishing");
    const finishingFinished = finishingStage ? (finishingStage.status === "DONE" || finishingStage.progress === 100) : false;

    if (!finishingFinished) {
      throw new Error("Cannot handover to QC: Project has not completed its finishing stage (Painting/Sandblasting).");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Close current active history
      const lastHistory = await tx.projectHistory.findFirst({
        where: { projectId, exitDate: null },
        orderBy: { entryDate: "desc" },
      });
      if (lastHistory) {
        await tx.projectHistory.update({
          where: { id: lastHistory.id },
          data: { exitDate: new Date() },
        });
      }

      // 2. Create new history entry for QC
      await tx.projectHistory.create({
        data: {
          projectId,
          division: "QUALITY_CONTROL",
          status: "IN_PROGRESS",
          entryDate: new Date(),
          notes: `Handover dari Produksi. Catatan: ${notes || "Seluruh komponen conveyor selesai diproduksi."}`,
          updatedBy: userBy,
        },
      });

      // 3. Update project division fields
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: {
          currentDivision: "QUALITY_CONTROL",
          currentStatus: "IN_PROGRESS",
          status: "IN_PROGRESS",
          prodStatus: "DONE",
          prodCompletedAt: new Date(),
        },
      });

      // 4. Create production log
      await tx.productionLog.create({
        data: {
          projectId,
          message: `Proyek diserahterimakan ke divisi Quality Control (QC). Catatan: ${notes || "-"}`,
          user: userBy,
        },
      });

      return updatedProject;
    });

    // Trigger notification
    try {
      await createNotification({
        title: `Proyek Siap QC: ${project.projectName}`,
        message: `${userBy} menyerahkan proyek ${project.projectNumber || "-"} ke Quality Control setelah selesai produksi.`,
        type: "SUCCESS",
        module: "TRACKER",
        targetUrl: `/trackers/quality-control?search=${encodeURIComponent(project.projectNumber || "")}`,
      });
    } catch (err) {
      console.error("Failed to trigger handover notification:", err);
    }

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Failed to handover project to QC" };
  }
}

/**
 * Hands over specific QC-approved stages/parts of a project to Logistics.
 */
export async function handoverProjectStagesToLogistics(
  projectId: string,
  stageNames: string[],
  notes: string,
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Quality Control", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Quality Control, Admin, atau Superadmin yang diizinkan.");
    }

    if (stageNames.length === 0) {
      throw new Error("Pilih minimal satu tahapan untuk diserahkan.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        productionStages: true,
      },
    });

    if (!project) throw new Error("Project not found");

    // Validate that all selected stages are approved by QC
    for (const name of stageNames) {
      const stage = project.productionStages.find((s) => s.name === name);
      if (!stage) {
        throw new Error(`Tahapan ${name} tidak ditemukan pada proyek.`);
      }
      if (stage.qcStatus !== "APPROVED") {
        throw new Error(`Tahapan ${name} belum lolos QC (status: ${stage.qcStatus}).`);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Handover entry
      const handover = await tx.projectHandover.create({
        data: {
          projectId,
          stages: stageNames.join(", "),
          notes: notes || "Serah terima parsial tahapan produksi.",
          handoverBy: userBy,
        },
      });

      // 2. Update Project Division & Status
      // Ensure that project is moved to LOGISTIC division and status is set to READY
      const updateData: any = {};
      if (
        project.currentDivision !== "LOGISTIC" ||
        project.currentStatus !== "READY" ||
        project.status !== "READY"
      ) {
        updateData.currentDivision = "LOGISTIC";
        updateData.currentStatus = "READY";
        updateData.status = "READY";
      }

      // Sync logistics-specific tracking fields
      updateData.logStatus = "READY";
      if (!project.logEntryDate) {
        updateData.logEntryDate = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        await tx.project.update({
          where: { id: projectId },
          data: updateData,
        });
      }

      // Sync the project's QC status as well
      await syncProjectQCStatus(tx, projectId);

      // 3. Create Project History Entry
      // Close last history entry
      const lastHistory = await tx.projectHistory.findFirst({
        where: { projectId, exitDate: null },
        orderBy: { entryDate: "desc" },
      });
      if (lastHistory) {
        await tx.projectHistory.update({
          where: { id: lastHistory.id },
          data: { exitDate: new Date() },
        });
      }

      await tx.projectHistory.create({
        data: {
          projectId,
          division: "LOGISTIC",
          status: "READY",
          entryDate: new Date(),
          notes: `Serah Terima Logistik (${stageNames.join(", ")}). Memo: ${notes || "-"}`,
          updatedBy: userBy,
        },
      });

      // 4. Create activity log in ProductionLogs
      await tx.productionLog.create({
        data: {
          projectId,
          message: `Tahapan [${stageNames.join(", ")}] diserahterimakan ke divisi Logistik. Catatan: ${notes || "-"}`,
          user: userBy,
        },
      });

      return handover;
    });

    // Trigger notification
    try {
      await createNotification({
        title: `Serah Terima Logistik: ${project.projectName}`,
        message: `${userBy} menyerahkan tahapan [${stageNames.join(", ")}] proyek ${project.projectNumber || "-"} ke divisi Logistik.`,
        type: "SUCCESS",
        module: "TRACKER",
        targetUrl: `/trackers/logistik?search=${encodeURIComponent(project.projectNumber || "")}`,
      });
    } catch (err) {
      console.error("Failed to trigger handover notification:", err);
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/logistik");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Gagal melakukan serah terima logistik." };
  }
}

/**
 * Updates QC status and QC notes for a specific production stage.
 * Automatically synchronizes production stage status and updates project-level QC status.
 */
export async function updateStageQCStatus(
  projectId: string,
  stageId: string,
  data: {
    qcStatus: "PENDING" | "APPROVED" | "REJECTED";
    qcNotes?: string;
    subSteps?: { id: string; qcStatus: "PENDING" | "APPROVED" | "REJECTED"; qcNotes?: string }[];
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Quality Control", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Only Quality Control, Admin, or Superadmin can update QC status.");
    }

    const stage = await prisma.productionStage.findUnique({
      where: { id: stageId },
    });
    if (!stage) throw new Error("Stage not found");

    const result = await prisma.$transaction(async (tx) => {
      let finalQCStatus = data.qcStatus;

      // 1. Update sub-steps if provided
      if (data.subSteps && data.subSteps.length > 0) {
        for (const step of data.subSteps) {
          await tx.productionSubStep.update({
            where: { id: step.id },
            data: {
              qcStatus: step.qcStatus,
              qcNotes: step.qcNotes || null,
            },
          });
        }

        // Fetch all sub-steps for this stage to compute overall status
        const allSubSteps = await tx.productionSubStep.findMany({
          where: { stageId },
        });

        const allApproved = allSubSteps.every((s) => s.qcStatus === "APPROVED");
        const anyRejected = allSubSteps.some((s) => s.qcStatus === "REJECTED");

        if (allApproved) {
          finalQCStatus = "APPROVED";
        } else if (anyRejected) {
          finalQCStatus = "REJECTED";
        } else {
          finalQCStatus = "PENDING";
        }
      } else {
        // If no subSteps updates are provided but the stage has sub-steps,
        // propagate the main status to all sub-steps.
        const allSubSteps = await tx.productionSubStep.findMany({
          where: { stageId },
        });
        if (allSubSteps.length > 0) {
          for (const step of allSubSteps) {
            await tx.productionSubStep.update({
              where: { id: step.id },
              data: {
                qcStatus: finalQCStatus,
              },
            });
          }
        }
      }

      // 2. Prepare stage update
      const updateData: any = {
        qcStatus: finalQCStatus,
        qcNotes: data.qcNotes || null,
      };

      // Auto-sync Production Stage status
      if (finalQCStatus === "REJECTED") {
        updateData.status = "REVISION";
      } else if (finalQCStatus === "APPROVED") {
        updateData.status = "DONE";
        updateData.progress = 100;
      } else if (finalQCStatus === "PENDING" && stage.status === "REVISION") {
        updateData.status = "IN_PROGRESS";
      }

      const updatedStage = await tx.productionStage.update({
        where: { id: stageId },
        data: updateData,
      });

      // 3. Create QC Log
      await tx.qCLog.create({
        data: {
          projectId,
          stageId,
          status: finalQCStatus,
          notes: data.qcNotes || "",
          user: userBy,
        },
      });

      // 4. Update project-level QC status
      await syncProjectQCStatus(tx, projectId);

      await syncProjectProdStatus(tx, projectId);

      return updatedStage;
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Failed to update stage QC status" };
  }
}

/**
 * Automatically synchronizes a project's prodStatus based on the completion of its production stages.
 * If all stages are DONE (100% progress), the project's prodStatus becomes DONE.
 * Otherwise, if it has been started, it becomes IN_PROGRESS.
 */
async function syncProjectProdStatus(tx: any, projectId: string) {
  const allStages = await tx.productionStage.findMany({
    where: {
      projectId: projectId,
    },
  });

  if (allStages.length === 0) return;

  const allDone = allStages.every((s: any) => s.status === "DONE" || s.progress === 100);
  const targetProdStatus = allDone ? "DONE" : "IN_PROGRESS";

  // Also update currentDivision if all stages are DONE and currentDivision was PRODUCTION
  const project = await tx.project.findUnique({
    where: { id: projectId },
  });

  if (project) {
    const updateData: any = {
      prodStatus: targetProdStatus,
    };

    if (allDone) {
      updateData.prodCompletedAt = project.prodCompletedAt || new Date();
    } else {
      updateData.prodCompletedAt = null;
    }

    if (allDone && project.currentDivision === "PRODUCTION") {
      updateData.currentDivision = "QUALITY_CONTROL";
      updateData.currentStatus = "IN_PROGRESS";
      updateData.status = "IN_PROGRESS";
      
      // Close last history entry and open one for Quality Control
      const lastHistory = await tx.projectHistory.findFirst({
        where: { projectId, exitDate: null },
        orderBy: { entryDate: "desc" },
      });

      if (lastHistory) {
        await tx.projectHistory.update({
          where: { id: lastHistory.id },
          data: { exitDate: new Date() },
        });
      }

      await tx.projectHistory.create({
        data: {
          projectId,
          division: "QUALITY_CONTROL",
          status: "IN_PROGRESS",
          entryDate: new Date(),
          notes: "Semua tahapan produksi telah selesai (100% DONE). Otomatis dialihkan ke Quality Control.",
          updatedBy: "System",
        },
      });
    } else if (!allDone && project.prodStatus === "DONE" && project.currentDivision === "QUALITY_CONTROL") {
      // Revert division if a stage is marked back to incomplete and was in QC
      updateData.currentDivision = "PRODUCTION";
      updateData.currentStatus = "IN_PROGRESS";
      updateData.status = "IN_PROGRESS";

      const lastHistory = await tx.projectHistory.findFirst({
        where: { projectId, exitDate: null },
        orderBy: { entryDate: "desc" },
      });

      if (lastHistory) {
        await tx.projectHistory.update({
          where: { id: lastHistory.id },
          data: { exitDate: new Date() },
        });
      }

      await tx.projectHistory.create({
        data: {
          projectId,
          division: "PRODUCTION",
          status: "IN_PROGRESS",
          entryDate: new Date(),
          notes: "Tahapan produksi dibuka kembali. Dialihkan ke Produksi.",
          updatedBy: "System",
        },
      });
    }

    await tx.project.update({
      where: { id: projectId },
      data: updateData,
    });
  }
}

/**
 * Automatically synchronizes a project's qcStatus based on the completion of its production stages.
 * If all stages are APPROVED, the project's qcStatus becomes APPROVED.
 * Otherwise, if any is REJECTED, it becomes REVISION.
 * If some are APPROVED but not all, it becomes IN_PROGRESS.
 * Otherwise, it becomes PENDING.
 */
async function syncProjectQCStatus(tx: any, projectId: string) {
  const allStages = await tx.productionStage.findMany({
    where: {
      projectId: projectId,
    },
  });

  if (allStages.length === 0) return;

  const allApproved = allStages.every((s: any) => s.qcStatus === "APPROVED");
  const anyRejected = allStages.some((s: any) => s.qcStatus === "REJECTED");

  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { qcCompletedAt: true, qcEntryDate: true },
  });

  if (project) {
    let projectQcStatus = "PENDING";
    let projectQcCompletedAt = project.qcCompletedAt;

    if (allApproved) {
      projectQcStatus = "APPROVED";
      projectQcCompletedAt = project.qcCompletedAt || new Date();
    } else if (anyRejected) {
      projectQcStatus = "REVISION";
    } else if (allStages.some((s: any) => s.qcStatus === "APPROVED")) {
      projectQcStatus = "IN_PROGRESS";
    }

    const updateProjectData: any = {
      qcStatus: projectQcStatus,
      qcCompletedAt: projectQcCompletedAt,
    };

    // Set qcEntryDate on first QC action
    const hasQcAction = allStages.some((s: any) => s.qcStatus === "APPROVED" || s.qcStatus === "REJECTED");
    if (!project.qcEntryDate && hasQcAction) {
      updateProjectData.qcEntryDate = new Date();
    }

    await tx.project.update({
      where: { id: projectId },
      data: updateProjectData,
    });
  }
}

/**
 * Adds a new component to a project and initializes its component stages.
 */
export async function addComponentToProject(
  projectId: string,
  name: string,
  activeStages: string[]
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    if (!name.trim()) throw new Error("Nama komponen wajib diisi");
    if (activeStages.length === 0) throw new Error("Pilih minimal satu tahapan produksi aktif");

    const result = await prisma.$transaction(async (tx) => {
      const component = await tx.projectComponent.create({
        data: {
          projectId,
          name: name.trim(),
        },
      });

      for (const stageName of activeStages) {
        await tx.componentStage.create({
          data: {
            componentId: component.id,
            name: stageName,
            status: "READY",
            progress: 0,
            qcStatus: "PENDING",
          },
        });
      }

      await tx.productionLog.create({
        data: {
          projectId,
          message: `Komponen baru ditambahkan: "${name.trim()}" (Tahapan: ${activeStages.join(", ")})`,
          user: userBy,
        },
      });

      for (const stageName of activeStages) {
        await syncProjectStageFromComponents(tx, projectId, stageName);
      }

      return component;
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Gagal menambahkan komponen" };
  }
}

/**
 * Updates a specific component stage's progress, status, and operator notes.
 */
export async function updateComponentStage(
  componentStageId: string,
  data: {
    progress: number;
    status: "READY" | "IN_PROGRESS" | "PAUSED" | "DONE" | "REVISION";
    notes?: string;
    assignedLeader?: string;
    assignedTeam?: string;
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    const compStage = await prisma.componentStage.findUnique({
      where: { id: componentStageId },
      include: { component: true },
    });
    if (!compStage) throw new Error("Component stage tidak ditemukan");

    const projectId = compStage.component.projectId;

    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        progress: data.progress,
        status: data.status,
        notes: data.notes || null,
        assignedLeader: data.assignedLeader || null,
        assignedTeam: data.assignedTeam || null,
      };

      if (compStage.qcStatus === "REJECTED") {
        updateData.qcStatus = "PENDING";
      }

      const updatedStage = await tx.componentStage.update({
        where: { id: componentStageId },
        data: updateData,
      });

      const statusMap: Record<string, string> = {
        READY: "Belum Mulai",
        IN_PROGRESS: "Dalam Proses",
        PAUSED: "Ditangguhkan",
        DONE: "Selesai",
        REVISION: "Revisi",
      };
      const statusText = statusMap[data.status] || data.status;
      const stepLabel = getComponentStageStepLabel(compStage.name, data.progress, data.status);
      const logMessage = `Komponen "${compStage.component.name}" - ${compStage.name} diperbarui ke langkah "${stepLabel}" (${statusText})`;
      
      await tx.productionLog.create({
        data: {
          projectId,
          message: logMessage,
          user: userBy,
        },
      });

      await syncProjectStageFromComponents(tx, projectId, compStage.name);

      return updatedStage;
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Gagal memperbarui progress komponen" };
  }
}

/**
 * Updates a specific component stage's QC status and QC notes.
 */
export async function updateComponentStageQC(
  componentStageId: string,
  data: {
    qcStatus: "PENDING" | "APPROVED" | "REJECTED";
    qcNotes?: string;
  }
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Quality Control", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Quality Control, Admin, atau Superadmin yang diizinkan.");
    }

    const compStage = await prisma.componentStage.findUnique({
      where: { id: componentStageId },
      include: { component: true },
    });
    if (!compStage) throw new Error("Component stage tidak ditemukan");

    const projectId = compStage.component.projectId;

    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        qcStatus: data.qcStatus,
        qcNotes: data.qcNotes || null,
      };

      if (data.qcStatus === "REJECTED") {
        updateData.status = "REVISION";
      } else if (data.qcStatus === "APPROVED") {
        updateData.status = "DONE";
        updateData.progress = 100;
      }

      const updatedStage = await tx.componentStage.update({
        where: { id: componentStageId },
        data: updateData,
      });

      const projStage = await tx.productionStage.findFirst({
        where: { projectId, name: compStage.name },
      });

      if (projStage) {
        await tx.qCLog.create({
          data: {
            projectId,
            stageId: projStage.id,
            status: data.qcStatus,
            notes: `Komponen "${compStage.component.name}": ${data.qcNotes || "Lolos Uji"}`,
            user: userBy,
          },
        });
      }

      await syncProjectStageFromComponents(tx, projectId, compStage.name);

      return updatedStage;
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Gagal memperbarui status QC komponen" };
  }
}

/**
 * Renames a specific project component.
 */
export async function renameComponent(componentId: string, newName: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    if (!newName || !newName.trim()) {
      throw new Error("Nama komponen tidak boleh kosong");
    }

    const component = await prisma.projectComponent.findUnique({
      where: { id: componentId },
    });
    if (!component) throw new Error("Komponen tidak ditemukan");

    await prisma.$transaction(async (tx) => {
      await tx.projectComponent.update({
        where: { id: componentId },
        data: { name: newName.trim() },
      });

      await tx.productionLog.create({
        data: {
          projectId: component.projectId,
          message: `Nama komponen "${component.name}" diubah menjadi "${newName.trim()}"`,
          user: userBy,
        },
      });
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Gagal mengubah nama komponen" };
  }
}

/**
 * Deletes a project component and triggers project-level stage progress recalculation.
 */
export async function deleteComponent(componentId: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    const component = await prisma.projectComponent.findUnique({
      where: { id: componentId },
      include: { stages: true },
    });
    if (!component) throw new Error("Komponen tidak ditemukan");

    const projectId = component.projectId;
    const stagesToSync = component.stages.map((s) => s.name);

    await prisma.$transaction(async (tx) => {
      await tx.projectComponent.delete({
        where: { id: componentId },
      });

      await tx.productionLog.create({
        data: {
          projectId,
          message: `Komponen dihapus: "${component.name}"`,
          user: userBy,
        },
      });

      for (const stageName of stagesToSync) {
        await syncProjectStageFromComponents(tx, projectId, stageName);
      }
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Gagal menghapus komponen" };
  }
}

/**
 * Helper to synchronize project stage progress based on component stage progress averages.
 */
export async function syncProjectStageFromComponents(tx: any, projectId: string, stageName: string) {
  const components = await tx.projectComponent.findMany({
    where: { projectId },
    include: {
      stages: {
        where: { name: stageName },
      },
    },
  });

  const activeCompStages = components
    .map((c: any) => c.stages[0])
    .filter(Boolean);

  if (activeCompStages.length === 0) return;

  const totalProgress = activeCompStages.reduce((sum: number, s: any) => sum + s.progress, 0);
  const averageProgress = Math.round(totalProgress / activeCompStages.length);

  const anyRejected = activeCompStages.some((s: any) => s.qcStatus === "REJECTED");
  const allApproved = activeCompStages.every((s: any) => s.qcStatus === "APPROVED");
  const anyInProgress = activeCompStages.some(
    (s: any) => s.progress > 0 || s.status === "IN_PROGRESS" || s.status === "REVISION"
  );

  let targetStatus = "READY";
  let targetQCStatus = "PENDING";

  if (anyRejected) {
    targetStatus = "REVISION";
    targetQCStatus = "REJECTED";
  } else if (allApproved && averageProgress === 100) {
    targetStatus = "DONE";
    targetQCStatus = "APPROVED";
  } else if (anyInProgress || averageProgress > 0) {
    targetStatus = "IN_PROGRESS";
    targetQCStatus = "PENDING";
  }

  const projStage = await tx.productionStage.findFirst({
    where: { projectId, name: stageName },
  });

  if (projStage) {
    await tx.productionStage.update({
      where: { id: projStage.id },
      data: {
        progress: averageProgress,
        status: targetStatus,
        qcStatus: targetQCStatus,
      },
    });
  }

  await syncProjectProdStatus(tx, projectId);
  await syncProjectQCStatus(tx, projectId);
}

/**
 * Excludes (deletes) a specific ComponentStage from a component, and recalculates stage progress.
 */
export async function excludeComponentStage(componentStageId: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    const compStage = await prisma.componentStage.findUnique({
      where: { id: componentStageId },
      include: { component: true },
    });
    if (!compStage) throw new Error("Component stage tidak ditemukan");

    const projectId = compStage.component.projectId;
    const stageName = compStage.name;
    const componentName = compStage.component.name;

    await prisma.$transaction(async (tx) => {
      // 1. Delete the component stage
      await tx.componentStage.delete({
        where: { id: componentStageId },
      });

      // 2. Create production log
      await tx.productionLog.create({
        data: {
          projectId,
          message: `Tahapan "${stageName}" diexclude/dihapus dari komponen "${componentName}"`,
          user: userBy,
        },
      });

      // 3. Recalculate project stage progress
      await syncProjectStageFromComponents(tx, projectId, stageName);
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Gagal mengexclude tahapan komponen" };
  }
}

const STAGE_STEPS: Record<string, string[]> = {
  "Fabrikasi": ["Cutting", "Assembly", "Welding"],
  "Machining": ["Lathe (Bubut)", "Milling (Frais)"],
  "Mechanical": ["Assembly", "Alignment"],
  "Finishing": ["Sandblasting", "Painting"],
};

function getComponentStageStepLabel(stageName: string, progress: number, status?: string) {
  const steps = STAGE_STEPS[stageName];
  if (!steps) return `${progress}%`;
  
  if (status === "DONE" || progress >= 100) return "Done";
  if (status === "READY" || progress <= 0) return "Belum Mulai";
  
  const M = steps.length;
  let bestIndex = 0;
  let minDiff = 101;
  for (let i = 0; i <= M + 1; i++) {
    const targetProgress = Math.round((i / (M + 1)) * 100);
    const diff = Math.abs(targetProgress - progress);
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = i;
    }
  }
  
  if (bestIndex === 0) return "Belum Mulai";
  if (bestIndex === M + 1) return "Done";
  return steps[bestIndex - 1];
}

/**
 * Hands over specific QC-approved components of a project to Logistics.
 */
export async function handoverComponentsToLogistics(
  projectId: string,
  componentIds: string[],
  notes: string,
) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Quality Control", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Quality Control, Admin, atau Superadmin yang diizinkan.");
    }

    if (componentIds.length === 0) {
      throw new Error("Pilih minimal satu komponen untuk diserahkan.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new Error("Project not found");

    const components = await prisma.projectComponent.findMany({
      where: { id: { in: componentIds }, projectId },
      include: { stages: true },
    });

    if (components.length === 0) {
      throw new Error("Komponen tidak ditemukan.");
    }

    // Verify all selected components are QC approved for all of their active stages
    for (const comp of components) {
      if (comp.handoverId) {
        throw new Error(`Komponen "${comp.name}" sudah diserahterimakan ke logistik sebelumnya.`);
      }
      if (comp.stages.length === 0) {
        throw new Error(`Komponen "${comp.name}" tidak memiliki tahapan produksi.`);
      }
      const allApproved = comp.stages.every((s) => s.qcStatus === "APPROVED");
      if (!allApproved) {
        throw new Error(`Komponen "${comp.name}" belum lolos QC pada seluruh tahapan.`);
      }
    }

    const componentNames = components.map((c) => c.name);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create ProjectHandover record
      const handover = await tx.projectHandover.create({
        data: {
          projectId,
          stages: `Komponen: ${componentNames.join(", ")}`,
          notes: notes || "Serah terima parsial komponen.",
          handoverBy: userBy,
        },
      });

      // 2. Link components to this handover
      await tx.projectComponent.updateMany({
        where: { id: { in: componentIds } },
        data: { handoverId: handover.id },
      });

      // 3. Update project division and status to LOGISTIC if not already there
      const updateData: any = {};
      if (
        project.currentDivision !== "LOGISTIC" ||
        project.currentStatus !== "READY" ||
        project.status !== "READY"
      ) {
        updateData.currentDivision = "LOGISTIC";
        updateData.currentStatus = "READY";
        updateData.status = "READY";
      }

      updateData.logStatus = "READY";
      if (!project.logEntryDate) {
        updateData.logEntryDate = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        await tx.project.update({
          where: { id: projectId },
          data: updateData,
        });
      }

      // 4. Create project history entry
      const lastHistory = await tx.projectHistory.findFirst({
        where: { projectId, exitDate: null },
        orderBy: { entryDate: "desc" },
      });
      if (lastHistory) {
        await tx.projectHistory.update({
          where: { id: lastHistory.id },
          data: { exitDate: new Date() },
        });
      }

      await tx.projectHistory.create({
        data: {
          projectId,
          division: "LOGISTIC",
          status: "READY",
          entryDate: new Date(),
          notes: `Serah Terima Parsial Komponen (${componentNames.join(", ")}). Memo: ${notes || "-"}`,
          updatedBy: userBy,
        },
      });

      // 5. Log activity
      await tx.productionLog.create({
        data: {
          projectId,
          message: `Komponen [${componentNames.join(", ")}] diserahterimakan ke divisi Logistik. Catatan: ${notes || "-"}`,
          user: userBy,
        },
      });

      return handover;
    });

    // Trigger notification
    try {
      await createNotification({
        title: `Serah Terima Komponen (Logistik): ${project.projectName}`,
        message: `${userBy} menyerahkan komponen [${componentNames.join(", ")}] proyek ${project.projectNumber || "-"} ke divisi Logistik.`,
        type: "SUCCESS",
        module: "TRACKER",
        targetUrl: `/trackers/logistik?search=${encodeURIComponent(project.projectNumber || "")}`,
      });
    } catch (err) {
      console.error("Failed to trigger partial handover notification:", err);
    }

    revalidatePath("/trackers/quality-control");
    revalidatePath("/trackers/logistik");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Gagal menyerahkan komponen ke divisi Logistik." };
  }
}

/**
 * Includes (adds) a specific ComponentStage back to a component, and recalculates stage progress.
 */
export async function includeComponentStage(componentId: string, stageName: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = session?.user?.roles || [];

    const isAuthorized = userRoles.some((role) =>
      ["Production", "Superadmin", "Admin"].includes(role)
    );
    if (!isAuthorized) {
      throw new Error("Unauthorized: Hanya divisi Produksi, Admin, atau Superadmin yang diizinkan.");
    }

    const component = await prisma.projectComponent.findUnique({
      where: { id: componentId },
      include: { stages: true },
    });
    if (!component) throw new Error("Component tidak ditemukan");

    // Check if stage already exists
    const exists = component.stages.some((s: any) => s.name === stageName);
    if (exists) throw new Error(`Tahapan "${stageName}" sudah aktif untuk komponen ini.`);

    const projectId = component.projectId;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the component stage
      const newStage = await tx.componentStage.create({
        data: {
          componentId,
          name: stageName,
          status: "READY",
          progress: 0,
          qcStatus: "PENDING",
        },
      });

      // 2. Create production log
      await tx.productionLog.create({
        data: {
          projectId,
          message: `Tahapan "${stageName}" diaktifkan/dimasukkan kembali ke komponen "${component.name}"`,
          user: userBy,
        },
      });

      // 3. Recalculate project stage progress
      await syncProjectStageFromComponents(tx, projectId, stageName);

      return newStage;
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message || "Gagal mengaktifkan tahapan komponen" };
  }
}


