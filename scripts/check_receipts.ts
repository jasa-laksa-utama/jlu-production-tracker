import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
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

  console.log("\n========================================================");
  console.log("=== JUMLAH PENERIMAAN BARANG PO DI DATABASE:", receipts.length, "===");
  console.log("========================================================\n");

  if (receipts.length === 0) {
    console.log("Belum ada data penerimaan barang PO dari gudang.");
  } else {
    receipts.forEach((r, i) => {
      console.log(`[${i + 1}] SJ: ${r.noSuratJalanSupplier} | PO: ${r.purchaseOrder?.nomorPO || '-'} | Status QC: ${r.qcStatus}`);
      console.log(`    Supplier: ${r.purchaseOrder?.kepada || '-'} | Proyek: ${r.purchaseOrder?.projek || '-'}`);
      console.log(`    Penerima Gudang: ${r.user?.name || '-'} | Tanggal Terima: ${r.receivedAt}`);
      console.log(`    Jumlah Item Diterima: ${r.items.length}`);
      r.items.forEach((item, j) => {
        console.log(`      - Item ${j + 1}: ${item.purchaseOrderItem?.namaBarang || 'Item'} (Qty Diterima: ${item.qtyReceived} ${item.purchaseOrderItem?.satuan || 'pcs'}) | Status QC: ${item.qcStatus}`);
      });
      console.log("--------------------------------------------------------");
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
