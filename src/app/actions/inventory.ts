"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function getWarehouseItems() {
  try {
    await requireAuth();
    const items = await prisma.item.findMany({
      include: {
        unit: true,
        itemType: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    return JSON.parse(JSON.stringify(items));
  } catch (error) {
    console.error("Error fetching warehouse items:", error);
    return [];
  }
}

export async function getUnits() {
  try {
    await requireAuth();
    const units = await prisma.unit.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return JSON.parse(JSON.stringify(units));
  } catch (error) {
    console.error("Error fetching units:", error);
    return [];
  }
}

export async function getLowStockItems() {
  try {
    await requireAuth();
    const items = await prisma.item.findMany({
      include: {
        unit: true,
      },
    });

    const lowStockItems = items
      .filter((item) => (item.currentStock - (item.reservedStock || 0)) <= item.minStock)
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name || "Unnamed Item",
        currentStock: item.currentStock,
        reservedStock: item.reservedStock || 0,
        minStock: item.minStock,
        unit: item.unit?.name || "pcs",
      }))
      .sort((a, b) => {
        const aRatio = (a.currentStock - a.reservedStock) - a.minStock;
        const bRatio = (b.currentStock - b.reservedStock) - b.minStock;
        return aRatio - bRatio;
      });

    return JSON.parse(JSON.stringify(lowStockItems.slice(0, 5)));
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    return [];
  }
}
