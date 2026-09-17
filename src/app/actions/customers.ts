"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { sanitizeErrorMessage } from "@/lib/error-handler"

export async function createCustomer(formData: FormData) {
  try {
    await requireAuth();
    const name = (formData.get("name") as string)?.trim();
    const company = (formData.get("company") as string)?.trim() || null;
    const email = (formData.get("email") as string)?.trim() || null;
    const phone = (formData.get("phone") as string)?.trim() || null;
    const address = (formData.get("address") as string)?.trim() || null;
    const city = (formData.get("city") as string)?.trim() || null;
    const province = (formData.get("province") as string)?.trim() || null;

    if (!name) return { error: "Nama pelanggan wajib diisi." };

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        company,
        email,
        phone,
        address,
        city,
        province,
      }
    });

    revalidatePath("/leads")
    return { success: true, data: newCustomer }
  } catch (error: any) {
    console.error("createCustomer error:", error);
    return { error: sanitizeErrorMessage(error, "Gagal membuat pelanggan baru.") };
  }
}

export async function updateCustomer(id: string, formData: FormData) {
  try {
    await requireAuth();
    const name = (formData.get("name") as string)?.trim();
    const company = (formData.get("company") as string)?.trim() || null;
    const email = (formData.get("email") as string)?.trim() || null;
    const phone = (formData.get("phone") as string)?.trim() || null;
    const address = (formData.get("address") as string)?.trim() || null;
    const city = (formData.get("city") as string)?.trim() || null;
    const province = (formData.get("province") as string)?.trim() || null;

    if (!name) return { error: "Nama pelanggan wajib diisi." };

    const updated = await prisma.customer.update({
      where: { id },
      data: { name, company, email, phone, address, city, province }
    });

    revalidatePath("/leads")
    return { success: true, data: updated }
  } catch (error: any) {
    console.error("updateCustomer error:", error);
    return { error: sanitizeErrorMessage(error, "Gagal memperbarui data pelanggan.") };
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
    console.error("toggleCustomerStatus error:", error);
    return { error: sanitizeErrorMessage(error, "Gagal memperbarui status pelanggan.") };
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
            { name: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            { province: { contains: search, mode: "insensitive" } },
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
    console.error("getCustomers error:", error);
    return { error: sanitizeErrorMessage(error, "Gagal mengambil data pelanggan.") };
  }
}

