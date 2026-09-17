"use server";

import prisma from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";
import {
  updateStructureItemChecklist,
  updateMechanicalItemChecklist,
} from "@/app/actions/conveyor-progress";

const BUCKET_NAME = "project-documents";

/**
 * Resolves a storage path or URL to an active Supabase signed/public URL
 */
export async function getStoragePhotoUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  
  // Extract relative storage path if full URL contains bucket name
  let storagePath = pathOrUrl;
  if (pathOrUrl.includes(`${BUCKET_NAME}/`)) {
    const parts = pathOrUrl.split(`${BUCKET_NAME}/`);
    if (parts.length > 1) {
      storagePath = parts[1].split("?")[0];
    }
  }

  try {
    const supabase = createAdminClient();
    
    // Create signed URL valid for 1 year (31536000 seconds)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 31536000);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    // Fallback to public URL
    const { data: pubData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return pubData?.publicUrl || pathOrUrl;
  } catch (err) {
    console.warn("getStoragePhotoUrl error:", err);
    return pathOrUrl;
  }
}

/**
 * Creates signed upload URL for progress photo upload
 */
export async function createProgressPhotoUploadUrl(
  projectId: string,
  fileName: string,
  unitId?: string,
  category: string = "FABRICATION",
  componentId?: string,
  componentType?: "STRUCTURE" | "MECHANICAL",
  componentName?: string,
  stage?: string,
) {
  try {
    await requireAuth();

    const allowedExtensions = [".webp", ".jpg", ".jpeg", ".png", ".heic"];
    const fileExt = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      throw new Error("Format foto tidak didukung (harus WebP, JPG, PNG).");
    }

    // Fetch human-readable Project Number / Name
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectNumber: true, projectName: true },
    });

    const projectIdentifier = project
      ? `${project.projectNumber || ""}_${project.projectName || ""}`
          .replace(/[^a-zA-Z0-9.\-_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "")
      : projectId;

    // Fetch human-readable Unit Name (if unitId provided)
    let subFolder = "general";
    if (unitId) {
      const unit = await prisma.conveyorUnit.findUnique({
        where: { id: unitId },
        select: { name: true },
      });
      if (unit?.name) {
        subFolder = unit.name
          .replace(/[^a-zA-Z0-9.\-_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "");
      }
    }

    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    
    // Separate folder path for QC photos vs Production photos with clean structured hierarchy
    const folderPrefix = category === "QC_INSPECTION" ? "qc-photos" : "progress-photos";
    const folderParts = [folderPrefix, projectIdentifier];
    if (subFolder && subFolder !== "general") {
      folderParts.push(subFolder);
    }
    if (componentType) {
      folderParts.push(componentType);
    }
    if (componentName) {
      const safeComp = componentName
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 40);
      folderParts.push(safeComp);
    }
    if (stage) {
      const safeStage = stage.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      folderParts.push(safeStage);
    }

    const folderPath = folderParts.join("/");
    const filePath = `${folderPath}/${timestamp}_${safeFileName}`;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed upload error:", error);
      return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat URL upload foto.") };
    }

    return {
      success: true,
      uploadUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    };
  } catch (error: any) {
    console.error("createProgressPhotoUploadUrl error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat URL upload foto.") };
  }
}

/**
 * Saves photo record to database
 */
export async function saveProgressPhotoRecord(data: {
  projectId: string;
  unitId?: string;
  phaseId?: string;
  componentId?: string;
  componentType?: "STRUCTURE" | "MECHANICAL";
  stage?: string;
  category?: string;
  caption?: string;
  url: string;
  fileName?: string;
  fileSize?: number;
}) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";

    // Resolve URL to active signed URL if needed
    let finalUrl = data.url;
    if (!finalUrl.startsWith("http")) {
      finalUrl = await getStoragePhotoUrl(data.url);
    }

    const photo = await (prisma as any).progressPhoto.create({
      data: {
        projectId: data.projectId,
        unitId: data.unitId || null,
        phaseId: data.phaseId || null,
        componentId: data.componentId || null,
        componentType: data.componentType || null,
        stage: data.stage || null,
        category: data.category || (data.componentType ? `FABRICATION_${data.componentType}` : "FABRICATION"),
        caption: data.caption?.trim() || null,
        url: finalUrl,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        uploadedBy: userBy,
      },
    });

    // Also create production log
    const categoryLabel = data.category === "QC_INSPECTION" ? "Foto QC" : "Foto dokumentasi progres";
    let logMessage = `${categoryLabel} diunggah`;
    if (data.caption) {
      logMessage += `: "${data.caption.substring(0, 40)}..."`;
    }
    await prisma.productionLog.create({
      data: {
        projectId: data.projectId,
        message: logMessage,
        user: userBy,
      },
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true, data: photo };
  } catch (error: any) {
    console.error("saveProgressPhotoRecord error:", error);
    return { success: false, error: error.message || "Gagal menyimpan data foto" };
  }
}

/**
 * Gets progress photos with optional filters
 */
export async function getProgressPhotos(params: {
  projectId: string;
  unitId?: string;
  phaseId?: string;
  componentId?: string;
  componentType?: string;
  stage?: string;
  category?: string;
}) {
  try {
    const whereClause: any = {
      projectId: params.projectId,
    };

    if (params.unitId) {
      whereClause.unitId = params.unitId;
    }
    if (params.phaseId) {
      whereClause.phaseId = params.phaseId;
    }
    if (params.componentId) {
      whereClause.componentId = params.componentId;
    }
    if (params.stage) {
      whereClause.stage = params.stage;
    }
    if (params.category && params.category !== "ALL") {
      if (params.category === "QC_INSPECTION") {
        whereClause.category = "QC_INSPECTION";
      } else if (params.category === "PRODUCTION_ONLY") {
        whereClause.category = {
          not: "QC_INSPECTION",
        };
      } else {
        whereClause.category = params.category;
      }
    }

    const rawPhotos = await (prisma as any).progressPhoto.findMany({
      where: whereClause,
      include: {
        unit: {
          select: { id: true, name: true },
        },
        phase: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Resolve working signed URLs for every photo
    const photos = await Promise.all(
      rawPhotos.map(async (p: any) => {
        let validUrl = p.url;
        if (!validUrl.startsWith("http") || validUrl.includes("supabase.co/storage/v1/object/sign/")) {
          validUrl = await getStoragePhotoUrl(p.url);
        }
        const isQC = p.category === "QC_INSPECTION";
        return {
          ...p,
          url: validUrl,
          isQC,
          source: isQC ? "QC" : "PRODUCTION",
          sourceDepartment: isQC ? "QC" : "PRODUCTION",
        };
      }),
    );

    return { success: true, data: photos };
  } catch (error: any) {
    console.error("getProgressPhotos error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memuat foto progres."), data: [] };
  }
}

/**
 * Gets project conveyor units and masterplan phases for photo categorization
 */
export async function getProjectUnitsAndPhasesAction(projectId: string) {
  try {
    await requireAuth();
    const [units, phases] = await Promise.all([
      prisma.conveyorUnit.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          structureItems: {
            select: { id: true, name: true, qty: true, satuan: true },
            orderBy: { name: "asc" },
          },
          mechanicalItems: {
            select: { id: true, name: true, qty: true, satuan: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      (prisma as any).masterplanPhase.findMany({
        where: {
          masterplan: { projectId },
        },
        select: { id: true, name: true, code: true },
        orderBy: { phaseOrder: "asc" },
      }),
    ]);

    return {
      success: true,
      units: units || [],
      phases: phases || [],
    };
  } catch (err: any) {
    console.error("getProjectUnitsAndPhasesAction error:", err);
    return { success: false, units: [], phases: [] };
  }
}

/**
 * Deletes progress photo from database & storage with role-based validation
 * - Tim QC tidak bisa menghapus foto Produksi
 * - Tim Produksi tidak bisa menghapus foto QC
 * - Admin/Superadmin memiliki akses penuh
 */
export async function deleteProgressPhotoAction(photoId: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "System";
    const userRoles = ((session?.user as any)?.roles || []).map((r: string) => r.toLowerCase());

    const photo = await (prisma as any).progressPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) throw new Error("Foto tidak ditemukan");

    // Role-based Access Control
    const isSuperOrAdmin = userRoles.some((r: string) =>
      ["superadmin", "admin"].includes(r)
    );
    const isQC = userRoles.some((r: string) =>
      ["quality control", "qc"].includes(r)
    );
    const isProduction = userRoles.some((r: string) =>
      ["production", "produksi"].includes(r)
    );
    const isQCPhoto = photo.category === "QC_INSPECTION";

    if (!isSuperOrAdmin) {
      if (isQCPhoto && !isQC) {
        throw new Error(
          "Akses ditolak: Foto ini adalah dokumentasi inspeksi QC. Hanya tim Quality Control atau Admin yang dapat menghapusnya."
        );
      }
      if (!isQCPhoto && !isProduction) {
        throw new Error(
          "Akses ditolak: Foto ini adalah dokumentasi hasil Produksi. Hanya tim Produksi atau Admin yang dapat menghapusnya."
        );
      }
    }

    // If storage path exists in url, attempt deletion
    try {
      const supabase = createAdminClient();
      if (photo.url.includes(BUCKET_NAME)) {
        const pathParts = photo.url.split(`${BUCKET_NAME}/`);
        if (pathParts.length > 1) {
          const storagePath = pathParts[1].split("?")[0];
          await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        }
      } else if (!photo.url.startsWith("http")) {
        await supabase.storage.from(BUCKET_NAME).remove([photo.url]);
      }
    } catch (err) {
      console.warn("Could not delete from storage bucket:", err);
    }

    await (prisma as any).progressPhoto.delete({
      where: { id: photoId },
    });

    await prisma.productionLog.create({
      data: {
        projectId: photo.projectId,
        message: `Foto (${photo.caption || photo.fileName || "Foto"}) [${isQCPhoto ? "QC" : "Produksi"}] dihapus oleh ${userBy}.`,
        user: userBy,
      },
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    console.error("deleteProgressPhotoAction error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghapus foto.") };
  }
}

/**
 * Records progress on a component stage with optional notes & photo(s)
 */
export async function recordStageProgressWithDoc(data: {
  projectId: string;
  unitId: string;
  componentId: string;
  componentType: "STRUCTURE" | "MECHANICAL";
  componentName: string;
  stage: string;
  isDone: boolean;
  qty?: number;
  notes?: string;
  photoUrl?: string;
  fileName?: string;
  fileSize?: number;
  photos?: Array<{ photoUrl: string; fileName?: string; fileSize?: number }>;
}) {
  try {
    await requireAuth();
    const session = await auth();
    const userBy = session?.user?.name || "Tim Produksi";

    // 1. Update checklist progress in DB
    if (data.componentType === "STRUCTURE") {
      const stageFieldMap: Record<string, { qtyField: string; doneField: string }> = {
        CUTTING: { qtyField: "cuttingQty", doneField: "cuttingDone" },
        SETTING: { qtyField: "settingQty", doneField: "settingDone" },
        WELDING: { qtyField: "weldingQty", doneField: "weldingDone" },
        FINISHING: { qtyField: "finishingQty", doneField: "finishingDone" },
        PAINTING: { qtyField: "paintingQty", doneField: "paintingDone" },
        PACKAGING: { qtyField: "packagingQty", doneField: "packagingDone" },
      };

      const fieldCfg = stageFieldMap[data.stage.toUpperCase()];
      if (fieldCfg) {
        await updateStructureItemChecklist(data.componentId, {
          [fieldCfg.qtyField]: data.isDone ? data.qty : 0,
          [fieldCfg.doneField]: data.isDone,
        });
      }
    } else {
      const stageFieldMap: Record<string, { qtyField: string; doneField: string }> = {
        PROCUREMENT: { qtyField: "procurementQty", doneField: "procurementDone" },
        PO: { qtyField: "poQty", doneField: "poDone" },
        FABRICATION: { qtyField: "fabricationQty", doneField: "fabricationDone" },
        PACKAGING: { qtyField: "packagingQty", doneField: "packagingDone" },
      };

      const fieldCfg = stageFieldMap[data.stage.toUpperCase()];
      if (fieldCfg) {
        await updateMechanicalItemChecklist(data.componentId, {
          [fieldCfg.qtyField]: data.isDone ? data.qty : 0,
          [fieldCfg.doneField]: data.isDone,
        });
      }
    }

    // 2. Prepare photo list (supports both multiple photos array and single photoUrl fallback)
    const photoList: Array<{ photoUrl: string; fileName?: string; fileSize?: number }> = [];
    if (data.photos && data.photos.length > 0) {
      photoList.push(...data.photos.filter((p) => !!p.photoUrl));
    } else if (data.photoUrl) {
      photoList.push({
        photoUrl: data.photoUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
      });
    }

    const createdPhotos: any[] = [];

    if (photoList.length > 0) {
      for (let i = 0; i < photoList.length; i++) {
        const item = photoList[i];
        let finalUrl = item.photoUrl;
        if (!finalUrl.startsWith("http")) {
          finalUrl = await getStoragePhotoUrl(finalUrl);
        }

        const compTag = `[${data.componentName}]`;
        const userNote = data.notes?.trim();
        let captionText: string | null = null;
        if (i === 0 && userNote) {
          captionText = `${compTag} ${userNote}`;
        } else {
          captionText = `${compTag} Foto Progres ${data.stage}`;
        }

        const photoRecord = await (prisma as any).progressPhoto.create({
          data: {
            projectId: data.projectId,
            unitId: data.unitId,
            componentId: data.componentId,
            componentType: data.componentType,
            stage: data.stage.toUpperCase(),
            category: `FABRICATION_${data.componentType}`,
            caption: captionText,
            url: finalUrl,
            fileName: item.fileName || null,
            fileSize: item.fileSize || null,
            uploadedBy: userBy,
          },
        });
        createdPhotos.push(photoRecord);
      }

      // Production log
      const photoText = photoList.length === 1 ? "1 foto bukti" : `${photoList.length} foto bukti`;
      await prisma.productionLog.create({
        data: {
          projectId: data.projectId,
          message: `Tahap ${data.stage} "${data.componentName}" dicatat selesai dengan ${photoText}${data.notes ? `: "${data.notes.substring(0, 40)}"` : ""}`,
          user: userBy,
        },
      });
    } else if (data.notes && data.notes.trim()) {
      // Notes only without photos
      const noteRecord = await (prisma as any).progressPhoto.create({
        data: {
          projectId: data.projectId,
          unitId: data.unitId,
          componentId: data.componentId,
          componentType: data.componentType,
          stage: data.stage.toUpperCase(),
          category: `FABRICATION_${data.componentType}`,
          caption: `[${data.componentName}] ${data.notes.trim()}`,
          url: "",
          uploadedBy: userBy,
        },
      });
      createdPhotos.push(noteRecord);

      await prisma.productionLog.create({
        data: {
          projectId: data.projectId,
          message: `Tahap ${data.stage} "${data.componentName}" dicatat selesai: "${data.notes.substring(0, 40)}"`,
          user: userBy,
        },
      });
    }

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true, data: createdPhotos[0] || null, photos: createdPhotos };
  } catch (error: any) {
    console.error("recordStageProgressWithDoc error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mencatat progres tahapan.") };
  }
}

/**
 * Updates progress photo caption with role-based validation
 */
export async function updateProgressPhotoCaptionAction(photoId: string, caption: string) {
  try {
    await requireAuth();
    const session = await auth();
    const userRoles = ((session?.user as any)?.roles || []).map((r: string) => r.toLowerCase());

    const photo = await (prisma as any).progressPhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo) throw new Error("Foto tidak ditemukan");

    const isSuperOrAdmin = userRoles.some((r: string) =>
      ["superadmin", "admin"].includes(r)
    );
    const isQC = userRoles.some((r: string) =>
      ["quality control", "qc"].includes(r)
    );
    const isProduction = userRoles.some((r: string) =>
      ["production", "produksi"].includes(r)
    );
    const isQCPhoto = photo.category === "QC_INSPECTION";

    if (!isSuperOrAdmin) {
      if (isQCPhoto && !isQC) {
        throw new Error(
          "Akses ditolak: Tim Produksi tidak dapat mengubah foto yang diunggah oleh bagian QC."
        );
      }
      if (!isQCPhoto && !isProduction) {
        throw new Error(
          "Akses ditolak: Tim QC tidak dapat mengubah foto yang diunggah oleh bagian Produksi."
        );
      }
    }

    await (prisma as any).progressPhoto.update({
      where: { id: photoId },
      data: { caption: caption.trim() || null },
    });

    revalidatePath("/trackers/production");
    revalidatePath("/trackers/quality-control");
    return { success: true };
  } catch (error: any) {
    console.error("updateProgressPhotoCaptionAction error:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memperbarui keterangan foto.") };
  }
}
