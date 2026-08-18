import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("=== CHECKING ALL PURCHASE ORDERS ===");
  const pos = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      user: { select: { name: true } }
    }
  });

  console.log("Total PO count:", pos.length);
  pos.forEach((po, idx) => {
    console.log(`[${idx + 1}] ID: ${po.id}`);
    console.log(`     No PO: ${po.nomorPO} | Supplier: ${po.kepada} | Projek: ${po.projek || '-'}`);
    console.log(`     Status PO: ${po.status} | qcStatus: ${po.qcStatus} | RequestedAt: ${po.qcRequestedAt}`);
    console.log(`     ApprovedBy: ${po.qcApprovedBy} | ApprovedAt: ${po.qcApprovedAt}`);
    console.log(`     Items count: ${po.items.length}`);
    po.items.forEach((item, j) => {
      console.log(`       - Item ${j + 1}: ${item.namaBarang} (Qty: ${item.qty} ${item.satuan}) | Ukuran: ${item.ukuran || '-'}`);
    });
    console.log("---------------------------------------------------------");
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
