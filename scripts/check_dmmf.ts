import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Testing PurchaseOrder query...");
  const res = await (prisma.purchaseOrder as any).findMany({
    where: { qcStatus: { in: ["PENDING_INSPECTION", "APPROVED", "REJECTED"] } },
    take: 1
  });
  console.log("QUERY SUCCESS! Returned:", res.length, "items");
}

main().catch(console.error).finally(() => prisma.$disconnect());
