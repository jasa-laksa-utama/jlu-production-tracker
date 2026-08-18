import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const pos = await prisma.purchaseOrder.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      items: true
    }
  });

  console.log("=== PO TERBARU (MAX 5) ===");
  console.log(JSON.stringify(pos, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
