import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("=== CHECKING PURCHASE ORDER RECEIPTS FOR QC ===");
  const receipts = await prisma.purchaseOrderReceipt.findMany({
    include: {
      user: { select: { name: true } },
      purchaseOrder: { select: { nomorPO: true, kepada: true, projek: true } },
      items: {
        include: {
          purchaseOrderItem: { select: { namaBarang: true, qty: true, satuan: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  console.log("Total Receipts:", receipts.length);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
