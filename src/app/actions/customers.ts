"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

export async function createCustomer(formData: FormData) {
  try {
    await requireAuth();
    const name = formData.get("name") as string;
    const company = formData.get("company") as string | null;
    const email = formData.get("email") as string | null;
    const phone = formData.get("phone") as string | null;
    const address = formData.get("address") as string | null;

    if (!name) return { error: "Name is required" };

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        company,
        email,
        phone,
        address,
      }
    });

    revalidatePath("/leads")
    return { success: true, data: newCustomer }
  } catch (error: any) {
    return { error: error.message || "Failed to create customer" }
  }
}

export async function updateCustomer(id: string, formData: FormData) {
  try {
    await requireAuth();
    const name = formData.get("name") as string;
    const company = formData.get("company") as string | null;
    const email = formData.get("email") as string | null;
    const phone = formData.get("phone") as string | null;
    const address = formData.get("address") as string | null;

    if (!name) return { error: "Name is required" };

    const updated = await prisma.customer.update({
      where: { id },
      data: { name, company, email, phone, address }
    });

    revalidatePath("/leads")
    return { success: true, data: updated }
  } catch (error: any) {
    return { error: error.message || "Failed to update customer" }
  }
}

export async function toggleCustomerStatus(id: string, isActive: boolean) {
  try {
    await requireAuth();
    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive }
    });
    
    revalidatePath("/leads")
    return { success: true, data: updated }
  } catch (error: any) {
    return { error: error.message || "Failed to update status" }
  }
}

export async function getCustomers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: string; // "true" | "false" | "ALL"
  hasLeads?: string; // "true" | "ALL"
  sortOrder?: "asc" | "desc";
} = {}) {
  try {
    await requireAuth();
    const {
      page = 1,
      pageSize = 10,
      search = "",
      isActive = "ALL",
      hasLeads = "ALL",
      sortOrder = "desc"
    } = params;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search } },
            { company: { contains: search } },
          ]
        } : {},
        isActive !== "ALL" ? { isActive: isActive === "true" } : {},
        hasLeads === "true" ? { leads: { some: {} } } : {},
      ]
    };

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: sortOrder },
        include: {
          _count: {
            select: { leads: true }
          }
        }
      }),
      prisma.customer.count({ where })
    ]);

    return { 
      success: true, 
      data: customers,
      meta: {
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      }
    };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch customers" };
  }
}

