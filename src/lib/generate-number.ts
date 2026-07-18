import prisma from "@/lib/prisma";

export async function generateTrackingNumber(
  type: "LEAD" | "PROJECT",
  projectType: string
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Map projectType to code
  let typeCode = "PRJ";
  if (projectType === "PO_PROJECT") typeCode = "PROJECT";
  else if (projectType === "PO_SPAREPART") typeCode = "SPAREPART";
  else if (projectType === "OM") typeCode = "OM";

  // Count existing leads/projects in the current year to determine sequence
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  let sequence = 1;

  if (type === "LEAD") {
    const count = await prisma.lead.count({
      where: {
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    });
    sequence = count + 1;
    return `PO-${typeCode}-${month}-${year}-${String(sequence).padStart(3, "0")}`;
  } else {
    const count = await prisma.project.count({
      where: {
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    });
    sequence = count + 1;
    return `${typeCode}-${month}-${year}-${String(sequence).padStart(3, "0")}`;
  }
}
