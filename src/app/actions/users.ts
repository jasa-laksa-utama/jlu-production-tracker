"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export async function getUsers() {
  await requireAuth();
  return await prisma.user.findMany({
    include: { roles: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRoles() {
  await requireAuth();
  return await prisma.role.findMany();
}

export async function createUser(data: any) {
  try {
    await requireRole(["Superadmin", "Admin"]);
    const { username, email, name, password, position, roleIds } = data;
    
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        name,
        password: hashedPassword,
        position,
        roles: {
          connect: roleIds.map((id: string) => ({ id })),
        },
      },
    });
    revalidatePath("/settings/users");
    return { success: true, user };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "Username atau email sudah terdaftar" };
    }
    return { error: sanitizeErrorMessage(error, "Gagal membuat user baru.") };
  }
}

export async function updateUser(id: string, data: any) {
  try {
    await requireRole(["Superadmin", "Admin"]);
    const { username, email, name, password, position, roleIds, isActive } = data;
    
    const updateData: any = {
      username,
      email,
      name,
      position,
      isActive,
      roles: {
        set: roleIds.map((id: string) => ({ id })),
      },
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    revalidatePath("/settings/users");
    return { success: true, user };
  } catch (error: any) {
    return { error: sanitizeErrorMessage(error, "Gagal memperbarui data user.") };
  }
}

export async function deleteUser(id: string) {
  try {
    await requireRole(["Superadmin", "Admin"]);
    await prisma.user.delete({
      where: { id },
    });
    revalidatePath("/settings/users");
    return { success: true };
  } catch (error: any) {
    return { error: sanitizeErrorMessage(error, "Gagal menghapus user.") };
  }
}

export async function toggleUserStatus(id: string, isActive: boolean) {
  try {
    await requireRole(["Superadmin", "Admin"]);
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
    });
    revalidatePath("/settings/users");
    return { success: true, user };
  } catch (error: any) {
    return { error: sanitizeErrorMessage(error, "Gagal memperbarui status user.") };
  }
}

