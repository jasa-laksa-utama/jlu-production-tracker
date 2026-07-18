"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";
import { requireAuth } from "@/lib/auth-guard";

export async function updateGlobalDriveLink(
  id: string,
  type: "LEAD" | "PROJECT",
  url: string | null
) {
  try {
    await requireAuth();
    let prevUrl: string | null = null;
    let targetName = "";
    let targetUrl = "";

    if (type === "LEAD") {
      const lead = await prisma.lead.findUnique({
        where: { id },
        select: { globalDriveUrl: true, projectName: true },
      });
      if (!lead) throw new Error("Lead not found");
      prevUrl = lead.globalDriveUrl;
      targetName = `Lead "${lead.projectName}"`;
      targetUrl = `/leads?search=${encodeURIComponent(lead.projectName)}`;
    } else {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { globalDriveUrl: true, projectNumber: true },
      });
      if (!project) throw new Error("Project not found");
      prevUrl = project.globalDriveUrl;
      targetName = `Proyek ${project.projectNumber || "-"}`;
      targetUrl = `/dashboard?search=${encodeURIComponent(project.projectNumber || "")}`;
    }

    if (type === "LEAD") {
      const lead = await prisma.lead.update({
        where: { id },
        data: { globalDriveUrl: url },
        include: { project: true }
      });
      
      // Sync to project if exists
      if (lead.project) {
        await prisma.project.update({
          where: { id: lead.project.id },
          data: { globalDriveUrl: url }
        });
      }
    } else {
      const project = await prisma.project.update({
        where: { id },
        data: { globalDriveUrl: url }
      });
      
      // Sync to lead if exists
      if (project.leadId) {
        await prisma.lead.update({
          where: { id: project.leadId },
          data: { globalDriveUrl: url }
        });
      }
    }

    revalidatePath("/leads");
    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/ppic");

    // Trigger notification if URL is changed/set/removed
    const prevClean = prevUrl?.trim() || null;
    const newClean = url?.trim() || null;

    if (prevClean !== newClean) {
      const isNew = !prevClean && newClean;
      const isChange = prevClean && newClean && prevClean !== newClean;
      const isDelete = prevClean && !newClean;

      try {
        const session = await auth();
        const uBy = session?.user?.name || "Seseorang";
        
        let title = "";
        let message = "";
        
        if (isNew) {
          title = "Set Link Google Drive";
          message = `${uBy} menyetel link Google Drive untuk ${targetName}.`;
        } else if (isChange) {
          title = "Ubah Link Google Drive";
          message = `${uBy} mengubah link Google Drive untuk ${targetName}.`;
        } else if (isDelete) {
          title = "Hapus Link Google Drive";
          message = `${uBy} menghapus link Google Drive dari ${targetName}.`;
        }

        if (title && message) {
          await createNotification({
            title,
            message,
            type: "INFO",
            module: "TRACKER",
            targetUrl,
          });
        }
      } catch (err) {
        console.error("Error creating Google Drive notification:", err);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Error updating drive link:", error);
    return { error: error.message || "Failed to update drive link" };
  }
}

