import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Checking SPB items in database via Raw SQL...");

  const items: any[] = await prisma.$queryRaw`
    SELECT id, name, "vendorSelectionStatus", "approvalEngineering", "approvalPm", "candidateSuppliers", "vendorSelectionNote"
    FROM spb_items
  `;

  console.log(`Total items found: ${items.length}`);
  console.dir(items, { depth: null });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
