"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { generateTrackingNumber } from "@/lib/generate-number";
import { createNotification } from "@/app/actions/notifications";
import { auth } from "@/auth";
import { requireAuth } from "@/lib/auth-guard";

export async function createLead(formData: FormData) {
  try {
    await requireAuth();
    const customerId = formData.get("customerId") as string;
    const projectName = formData.get("projectName") as string;
    const description = formData.get("description") as string | null;
    const valueRaw = formData.get("value") as string | null;
    const status = (formData.get("status") as string) || "NEW";
    const projectType = (formData.get("projectType") as string) || "PO_PROJECT";
    const salesPerson = formData.get("salesPerson") as string | null;
    const expectedDateStr = formData.get("expectedDate") as string | null;

    if (!customerId || !projectName) {
      return { error: "Customer and Project Name are required" };
    }

    const value = valueRaw ? new Prisma.Decimal(valueRaw) : null;

    const leadNumber = await generateTrackingNumber("LEAD", projectType);

    const newLead = await prisma.lead.create({
      data: {
        customerId,
        projectName,
        description,
        value,
        status,
        projectType,
        leadNumber,
        salesPerson,
        expectedDate: expectedDateStr ? new Date(expectedDateStr) : null,
      },
    });

    revalidatePath("/leads");
    return { 
      success: true, 
      data: {
        ...newLead,
        value: newLead.value ? newLead.value.toString() : null
      }
    };
  } catch (error: any) {
    return { error: error.message || "Failed to create lead" };
  }
}

export async function updateLead(id: string, formData: FormData) {
  try {
    await requireAuth();
    const projectName = formData.get("projectName") as string;
    const description = formData.get("description") as string | null;
    const valueRaw = formData.get("value") as string | null;
    const projectType = formData.get("projectType") as string | null;
    const salesPerson = formData.get("salesPerson") as string | null;
    const customerId = formData.get("customerId") as string | null;

    if (!projectName) return { error: "Project Name is required" };
    const value = valueRaw ? new Prisma.Decimal(valueRaw) : null;

    const updateData: any = { 
      projectName, 
      description, 
      value 
    };

    const expectedDateStr = formData.get("expectedDate") as string | null;

    if (projectType) updateData.projectType = projectType;
    if (customerId) updateData.customerId = customerId;
    
    if (salesPerson !== null) updateData.salesPerson = salesPerson;
    if (expectedDateStr !== null) {
      updateData.expectedDate = expectedDateStr ? new Date(expectedDateStr) : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const leadResult = await tx.lead.update({
        where: { id },
        data: updateData,
      });

      // Find if there is an associated active project
      const project = await tx.project.findUnique({
        where: { leadId: id },
      });

      if (project) {
        const projectUpdateData: any = {
          projectName: updateData.projectName,
          description: updateData.description,
          value: updateData.value,
          expectedDate: updateData.expectedDate,
        };
        if (updateData.customerId) {
          projectUpdateData.customerId = updateData.customerId;
        }

        await tx.project.update({
          where: { id: project.id },
          data: projectUpdateData,
        });
      }

      return leadResult;
    });

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    revalidatePath("/trackers/engineering");
    revalidatePath("/trackers/ppic");
    
    return { 
      success: true, 
      data: {
        ...updated,
        value: updated.value ? updated.value.toString() : null
      }
    };
  } catch (error: any) {
    return { error: error.message || "Failed to update lead" };
  }
}

export async function deleteLead(id: string) {
  try {
    await requireAuth();
    await prisma.lead.delete({
      where: { id },
    });
    revalidatePath("/leads");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete lead" };
  }
}

export async function updateLeadStatus(
  id: string,
  status: string,
  notes?: string | null,
  lostReason?: string | null,
) {
  try {
    await requireAuth();
    const updateData: any = { status };
    if (notes !== undefined) {
      updateData.followUpNote = notes;
    }
    if (lostReason !== undefined) {
      updateData.lostReason = lostReason;
    }

    // Validation: LOST requires lostReason
    if (status === "LOST" && !lostReason) {
      return { error: "Alasan lost harus diisi" };
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

     revalidatePath("/leads");

    // Trigger notification
    try {
      const session = await auth();
      const uBy = session?.user?.name || "Seseorang";

      await createNotification({
        title: `Perubahan Status Lead: ${status}`,
        message: `${uBy} mengubah status lead "${updated.projectName}" menjadi ${status}${lostReason ? ` (Alasan: ${lostReason})` : ""}.`,
        type: status === "LOST" ? "WARNING" : "INFO",
        module: "TRACKER",
        targetUrl: `/leads?search=${encodeURIComponent(updated.projectName)}`,
      });
    } catch (err) {
      console.error("Error creating notification:", err);
    }

    return { 
      success: true, 
      data: {
        ...updated,
        value: updated.value ? updated.value.toString() : null
      }
    };
  } catch (error: any) {
    return { error: error.message || "Failed to update status" };
  }
}

export async function getLeads(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  projectType?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: "asc" | "desc";
} = {}) {
  try {
    await requireAuth();
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status = "ALL",
      projectType = "ALL",
      startDate,
      endDate,
      sortOrder = "desc"
    } = params;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const parseDateSafely = (dStr: any) => {
      if (!dStr || dStr === "undefined" || dStr === "null") return undefined;
      const parsed = new Date(dStr);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const parsedStart = parseDateSafely(startDate);
    const parsedEnd = parseDateSafely(endDate);

    const where: Prisma.LeadWhereInput = {
      AND: [
        search ? {
          OR: [
            { projectName: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
            { customer: { company: { contains: search, mode: "insensitive" } } },
            { salesPerson: { contains: search, mode: "insensitive" } },
          ]
        } : {},
        status !== "ALL" ? { status } : {},
        projectType !== "ALL" ? { projectType } : {},
        parsedStart ? { createdAt: { gte: parsedStart } } : {},
        parsedEnd ? { createdAt: { lte: parsedEnd } } : {},
      ]
    };

    const [leads, totalCount] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: sortOrder },
        include: {
          customer: true,
          project: {
            include: {
              history: {
                orderBy: { entryDate: "desc" },
              },
              masterplan: {
                include: {
                  phases: {
                    orderBy: { orderIndex: "asc" },
                  },
                },
              },
              productionStages: {
                include: {
                  subSteps: true,
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
              conveyorUnits: {
                include: {
                  structureItems: true,
                  mechanicalItems: true,
                },
              },
            },
          },
          documents: {
            orderBy: [{ category: "asc" }, { version: "desc" }],
          },
        },
      }),
      prisma.lead.count({ where })
    ]);

    const serializedLeads = leads.map(lead => ({
      ...lead,
      value: lead.value ? lead.value.toString() : null,
      project: lead.project ? {
        ...lead.project,
        value: lead.project.value ? lead.project.value.toString() : null
      } : null,
      hasRevisedDocs: lead.documents?.some((doc: any) => doc.version > 1) || false
    }));

    return { 
      success: true, 
      data: JSON.parse(JSON.stringify(serializedLeads)),
      meta: {
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      }
    };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch leads" };
  }
}

