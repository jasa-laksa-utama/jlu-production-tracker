"use server";

import prisma from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { parseSPBImageUrls } from "@/lib/utils";
import { sanitizeErrorMessage } from "@/lib/error-handler";

const BUCKET_NAME = "project-documents";

// Category-to-folder mapping for organized storage
const CATEGORY_FOLDERS: Record<string, string> = {
  BRIEF: "brief",
  DRAWING: "drawing",
  BOQ: "boq",
  MECH_PART_LIST: "mechanical-part-list",
  ASSEMBLY_LIST: "assembly-list",
  RAB: "rab",
  RAP: "rap",
  PO: "po",
  SPB: "spb",
  SPJ: "spj",
  PRODUCTION: "production",
  QC: "qc",
  BERITA_ACARA: "berita-acara",
  OTHER: "other",
};

const CATEGORY_LABELS: Record<string, string> = {
  BRIEF: "Brief",
  DRAWING: "Drawing",
  BOQ: "Bill of Quantities (BoQ)",
  MECH_PART_LIST: "Mechanical Part List",
  ASSEMBLY_LIST: "Assembly List",
  RAB: "RAB",
  RAP: "RAP",
  PO: "Purchase Order (PO)",
  OFFERING: "Bukti Penawaran",
  SPB: "Surat Permintaan Barang (SPB)",
  SPJ: "Surat Pertanggungjawaban (SPJ)",
  PRODUCTION: "Dokumen Produksi",
  QC: "Dokumen QC / Kualitas",
  BERITA_ACARA: "Berita Acara & Hasil Uji Site",
  OTHER: "Dokumen Lainnya",
};

const NOTIF_DOC_TITLES: Record<string, string> = {
  BRIEF: "Dokumen Brief",
  DRAWING: "Drawing",
  BOQ: "Dokumen BOQ",
  MECH_PART_LIST: "Mech Part List",
  ASSEMBLY_LIST: "Assembly List",
  RAB: "Dokumen RAB",
  RAP: "Dokumen RAP",
  PO: "Dokumen PO",
  OFFERING: "Bukti Penawaran",
  SPB: "Dokumen SPB",
  SPJ: "Dokumen SPJ",
  PRODUCTION: "Dokumen Produksi",
  QC: "Dokumen QC",
  BERITA_ACARA: "Berita Acara Closing Proyek",
  OTHER: "Dokumen",
};

const NOTIF_DOC_LABELS: Record<string, string> = {
  BRIEF: "dokumen brief",
  DRAWING: "drawing",
  BOQ: "dokumen BOQ",
  MECH_PART_LIST: "mech part list",
  ASSEMBLY_LIST: "assembly list",
  RAB: "dokumen RAB",
  RAP: "dokumen RAP",
  PO: "dokumen PO",
  OFFERING: "bukti penawaran",
  SPB: "dokumen SPB",
  SPJ: "dokumen SPJ",
  PRODUCTION: "dokumen produksi",
  QC: "dokumen QC",
  BERITA_ACARA: "berita acara closing",
  OTHER: "dokumen",
};

/**
 * Creates a presigned upload URL for a document.
 * Path structure: {category}/{ownerId}/v{version}_{safeFileName}
 */
export async function createDocumentUploadUrl(
  ownerId: string,
  ownerType: "LEAD" | "PROJECT",
  category: string,
  originalFileName: string
) {
  try {
    await requireRole(["Superadmin", "Admin", "PPIC", "PM", "Engineering", "Production"]);
    
    // Whitelist file extensions to prevent malicious upload (M3)
    const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"];
    const fileExt = originalFileName.substring(originalFileName.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      throw new Error("Tipe file tidak diizinkan.");
    }

    const folder = CATEGORY_FOLDERS[category] || "other";

    // Get latest version for this owner + category
    const whereClause: any = { category };
    if (ownerType === "LEAD") {
      whereClause.leadId = ownerId;
    } else {
      whereClause.projectId = ownerId;
    }

    const lastDoc = await prisma.document.findFirst({
      where: whereClause,
      orderBy: { version: "desc" },
    });

    const newVersion = (lastDoc?.version || 0) + 1;

    // Fetch descriptive info for folder name
    let companyName = "Unknown";
    let projectName = "Unknown";
    let projectCode = "";

    if (ownerType === "LEAD") {
      const lead = await prisma.lead.findUnique({
        where: { id: ownerId },
        include: { customer: true },
      });
      if (lead) {
        companyName = lead.customer.company || "Personal";
        projectName = lead.projectName;
        projectCode = lead.leadNumber || "";
      }
    } else {
      const project = await prisma.project.findUnique({
        where: { id: ownerId },
        include: { customer: true },
      });
      if (project) {
        companyName = project.customer.company || "Personal";
        projectName = project.projectName;
        projectCode = project.projectNumber || "";
      }
    }

    // Clean names for URL/Path safety (readable project identifier)
    const cleanCompany = companyName.replace(/[^a-zA-Z0-9]/g, "_");
    const cleanProject = projectName.replace(/[^a-zA-Z0-9]/g, "_");
    const cleanCode = projectCode.replace(/[^a-zA-Z0-9]/g, "_");
    const folderId =
      [cleanCode, cleanCompany, cleanProject]
        .filter(Boolean)
        .join("-")
        .replace(/_+/g, "_")
        .replace(/-+/g, "-") || ownerId;

    // Construct safe file path
    const safeFileName = originalFileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `${folder}/${folderId}/v${newVersion}_${safeFileName}`;

    const supabase = createAdminClient();

    // Create presigned upload URL valid for 30 minutes
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase createSignedUploadUrl error:", error);
      return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat URL upload dokumen.") };
    }

    return {
      success: true,
      uploadUrl: data.signedUrl,
      path: data.path,
      token: data.token,
      version: newVersion,
    };
  } catch (error: any) {
    console.error("createDocumentUploadUrl error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal membuat URL upload dokumen."),
    };
  }
}

/**
 * Saves a document record to the database after file upload or link input.
 */
export async function saveDocumentRecord(data: {
  leadId?: string;
  projectId?: string;
  category: string;
  label?: string;
  url: string;
  fileName?: string;
  isExternal?: boolean;
  version: number;
  uploadedBy?: string;
  notes?: string;
  tonnage?: number;
}) {
  try {
    await requireRole(["Superadmin", "Admin", "PPIC", "PM", "Engineering", "Production"]);
    const session = await auth();
    const uBy = session?.user?.name || data.uploadedBy || "Seseorang";
    const docTonnage = Math.max(0, Number(data.tonnage) || 0);

    const document = await prisma.document.create({
      data: {
        leadId: data.leadId || null,
        projectId: data.projectId || null,
        category: data.category,
        label: data.label || null,
        url: data.url,
        name: data.fileName || null,
        fileName: data.fileName || null,
        isExternal: data.isExternal || false,
        version: data.version,
        uploadedBy: uBy,
        notes: data.notes || null,
        tonnage: docTonnage,
      },
    });

    // Revalidate relevant pages
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    revalidatePath("/trackers/engineering");

    // Trigger sync masterplan progress jika pada proyek
    if (data.projectId) {
      try {
        const { syncEngineeringMasterplanProgress } = await import("@/app/actions/masterplan");
        await syncEngineeringMasterplanProgress(data.projectId);
      } catch (syncErr) {
        console.error("Error trigger syncEngineeringMasterplanProgress in saveDocumentRecord:", syncErr);
      }
    }

    // Fetch parent info and log notification
    try {
      let targetName = "";
      let targetUrl = "";
      if (data.projectId) {
        const proj = await prisma.project.findUnique({
          where: { id: data.projectId },
          select: { projectNumber: true },
        });
        if (proj) {
          targetName = `Proyek ${proj.projectNumber || "-"}`;
          targetUrl = `/dashboard?search=${encodeURIComponent(proj.projectNumber || "")}`;
        }
      } else if (data.leadId) {
        const ld = await prisma.lead.findUnique({
          where: { id: data.leadId },
          select: { projectName: true },
        });
        if (ld) {
          targetName = `Lead "${ld.projectName}"`;
          targetUrl = `/leads?search=${encodeURIComponent(ld.projectName)}`;
        }
      }

      const isRevision = data.version > 1;
      const titleLabel = NOTIF_DOC_TITLES[data.category] || "Dokumen";
      const docLabel = NOTIF_DOC_LABELS[data.category] || "dokumen";
      const title = `${isRevision ? "Revisi" : "Upload"} ${titleLabel}`;
      const message = `${uBy} mengunggah ${isRevision ? "revisi " : ""}${docLabel} (v${data.version}) untuk ${targetName || "proyek/lead"}.`;

      await createNotification({
        title,
        message,
        type: isRevision ? "WARNING" : "SUCCESS",
        module: "TRACKER",
        targetUrl,
      });
    } catch (notifErr) {
      console.error("Error creating document notification:", notifErr);
    }

    return { success: true, document };
  } catch (error: any) {
    console.error("saveDocumentRecord error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal menyimpan data dokumen."),
    };
  }
}

/**
 * Fetches all documents for a specific owner (Lead or Project).
 */
export async function getDocumentsByOwner(
  ownerId: string,
  ownerType: "LEAD" | "PROJECT",
  leadId?: string,
  includePO: boolean = false
) {
  try {
    await requireAuth();
    const whereClause: any = {};
    if (ownerType === "LEAD") {
      whereClause.leadId = ownerId;
    } else {
      // If it's a project, show documents linked to this project OR its lead
      whereClause.OR = [
        { projectId: ownerId },
        { leadId: leadId || undefined }
      ].filter(condition => Object.values(condition)[0] !== undefined);
    }

    // Exclude PO documents unless explicitly requested
    if (!includePO) {
      if (whereClause.OR) {
        whereClause.AND = [
          { category: { not: "PO" } }
        ];
      } else {
        whereClause.category = { not: "PO" };
      }
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });

    return { success: true, data: documents };
  } catch (error: any) {
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memuat dokumen proyek."),
    };
  }
}

/**
 * Fetches only Sales-related documents (PO and OFFERING).
 */
export async function getSalesDocuments(
  ownerId: string,
  ownerType: "LEAD" | "PROJECT",
  leadId?: string
) {
  try {
    await requireAuth();
    const whereClause: any = {
      category: { in: ["PO", "OFFERING"] }
    };
    
    if (ownerType === "LEAD") {
      whereClause.leadId = ownerId;
    } else {
      whereClause.OR = [
        { projectId: ownerId },
        { leadId: leadId || undefined }
      ].filter(condition => Object.values(condition)[0] !== undefined);
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });

    return { success: true, data: documents };
  } catch (error: any) {
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memuat dokumen sales.") };
  }
}

/**
 * Fetches version history for a specific category within an owner.
 */
export async function getDocumentHistory(
  ownerId: string,
  ownerType: "LEAD" | "PROJECT",
  category: string,
  leadId?: string
) {
  try {
    await requireAuth();
    const whereClause: any = { category };
    if (ownerType === "LEAD") {
      whereClause.leadId = ownerId;
    } else {
      whereClause.OR = [
        { projectId: ownerId },
        { leadId: leadId || undefined }
      ].filter(condition => Object.values(condition)[0] !== undefined);
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });

    return { success: true, data: documents };
  } catch (error: any) {
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memuat riwayat dokumen.") };
  }
}

/**
 * Generates a signed download URL for a document stored in Supabase.
 */
export async function getDocumentDownloadUrl(documentId: string, download: boolean = true) {
  try {
    await requireAuth();
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) return { success: false, error: "Dokumen tidak ditemukan." };

    // If it's an external link, just return it
    if (doc.isExternal) {
      return { success: true, url: doc.url };
    }

    const supabase = createAdminClient();

    // Create a presigned download URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(doc.url, 3600, download ? { download: true } : undefined);

    if (error) {
      console.error("Supabase getDownloadUrl error:", error);
      return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat link download dokumen.") };
    }

    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    console.error("getDocumentDownloadUrl error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal membuat link download dokumen."),
    };
  }
}

/**
 * When a Lead is converted to a Project, link all Lead documents
 * to the new Project as well (documents become dual-owned).
 */
export async function migrateLeadDocsToProject(
  leadId: string,
  projectId: string
) {
  try {
    await requireAuth();
    // Update all documents that belong to this lead to also belong to the project
    const result = await prisma.document.updateMany({
      where: { leadId, projectId: null },
      data: { projectId },
    });

    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("migrateLeadDocsToProject error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal memigrasi dokumen."),
    };
  }
}

/**
 * Generates a presigned upload URL for SPB attachment images.
 */
export async function createSPBImageUploadUrl(
  projectId: string,
  originalFileName: string
) {
  try {
    await requireRole(["Engineering", "Superadmin", "Admin", "PPIC", "PM"]);
    
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const fileExt = originalFileName.substring(originalFileName.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      throw new Error("Tipe file gambar tidak diizinkan. Hanya file JPG, PNG, dan WEBP yang diperbolehkan.");
    }

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

    const timestamp = Date.now();
    const safeFileName = originalFileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `spb_attachments/${projectIdentifier}/${timestamp}_${safeFileName}`;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase createSignedUploadUrl error:", error);
      return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat URL upload foto SPB.") };
    }

    return {
      success: true,
      uploadUrl: data.signedUrl,
      path: data.path,
    };
  } catch (error: any) {
    console.error("createSPBImageUploadUrl error:", error);
    return {
      success: false,
      error: sanitizeErrorMessage(error, "Gagal membuat URL upload gambar SPB."),
    };
  }
}

/**
 * Gets a signed download/view URL for an SPB image attachment.
 */
export async function getSPBImageUrl(imagePath: string) {
  try {
    if (!imagePath) return { success: false, error: "Path gambar tidak ada" };
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return { success: true, url: imagePath };
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(imagePath, 3600);

    if (error) {
      return { success: false, error: sanitizeErrorMessage(error, "Gagal memuat file gambar SPB.") };
    }
    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    return { success: false, error: sanitizeErrorMessage(error, "Gagal memuat file gambar SPB.") };
  }
}

/**
 * Gets signed download/view URLs for multiple SPB image attachment paths.
 */
export async function getSPBImageUrls(imageUrlOrPaths: string | string[]) {
  try {
    const paths = Array.isArray(imageUrlOrPaths)
      ? imageUrlOrPaths
      : parseSPBImageUrls(imageUrlOrPaths);

    if (!paths || paths.length === 0) {
      return { success: true, urls: [] };
    }

    const supabase = createAdminClient();
    const urls: string[] = [];

    for (const path of paths) {
      if (!path) continue;
      if (path.startsWith("http://") || path.startsWith("https://")) {
        urls.push(path);
      } else {
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) {
          urls.push(data.signedUrl);
        }
      }
    }

    return { success: true, urls };
  } catch (error: any) {
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil URL gambar lampiran.") };
  }
}
