"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { sanitizeErrorMessage } from "@/lib/error-handler";

export interface CreateNotificationInput {
  title: string;
  message: string;
  type?: string;        // INFO, SUCCESS, WARNING, ERROR
  module?: string;      // TRACKER, INVENTORY
  targetUrl?: string;
}

/**
 * Creates a notification and enforces a maximum of 500 notifications per module.
 * The oldest notifications for that module are automatically deleted.
 */
export async function createNotification(data: CreateNotificationInput) {
  try {
    await requireAuth();
    const moduleName = data.module || "TRACKER";
    const notificationType = data.type || "INFO";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the notification
      const notif = await tx.notification.create({
        data: {
          title: data.title,
          message: data.message,
          type: notificationType,
          module: moduleName,
          targetUrl: data.targetUrl || null,
        },
      });

      // 2. Count current notifications for this module
      const count = await tx.notification.count({
        where: { module: moduleName },
      });

      // 3. Delete oldest if exceeds 500
      if (count > 500) {
        const oldestToKeep = await tx.notification.findMany({
          where: { module: moduleName },
          orderBy: { createdAt: "desc" },
          skip: 499,
          take: 1,
          select: { createdAt: true },
        });

        if (oldestToKeep.length > 0) {
          await tx.notification.deleteMany({
            where: {
              module: moduleName,
              createdAt: {
                lt: oldestToKeep[0].createdAt,
              },
            },
          });
        }
      }

      return notif;
    });

    revalidatePath("/dashboard");
    return { 
      success: true, 
      data: {
        ...result,
        createdAt: result.createdAt.toISOString()
      } 
    };
  } catch (error: any) {
    console.error("Error creating notification:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal membuat notifikasi.") };
  }
}

/**
 * Fetches the latest 5 notifications for a specific module.
 */
export async function getLatestNotifications(moduleName: string = "TRACKER") {
  try {
    await requireAuth();
    const list = await prisma.notification.findMany({
      where: {
        module: {
          in: [moduleName, "DEFAULT"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    
    // Explicitly serialize Date objects to ISO strings for Next.js Server Action compatibility
    const serializedList = list.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    }));

    return { success: true, data: serializedList };
  } catch (error: any) {
    console.error("Error fetching latest notifications:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal mengambil notifikasi."), data: [] };
  }
}

/**
 * Fetches the total count of unread notifications for a specific module.
 */
export async function getUnreadCount(moduleName: string = "TRACKER") {
  try {
    await requireAuth();
    const count = await prisma.notification.count({
      where: {
        module: {
          in: [moduleName, "DEFAULT"],
        },
        isRead: false,
      },
    });
    return { success: true, data: count };
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menghitung notifikasi belum dibaca."), data: 0 };
  }
}

/**
 * Marks a notification as read.
 */
export async function markAsRead(id: string) {
  try {
    await requireAuth();
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return { 
      success: true, 
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString()
      } 
    };
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menandai notifikasi telah dibaca.") };
  }
}

/**
 * Marks all notifications in a specific module as read.
 */
export async function markAllAsRead(moduleName: string = "TRACKER") {
  try {
    await requireAuth();
    await prisma.notification.updateMany({
      where: {
        module: {
          in: [moduleName, "DEFAULT"],
        },
        isRead: false,
      },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return { success: false, error: sanitizeErrorMessage(error, "Gagal menandai semua notifikasi telah dibaca.") };
  }
}

