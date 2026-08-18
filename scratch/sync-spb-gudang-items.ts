import "dotenv/config";
import prisma from "../src/lib/prisma";

async function syncSpbGudangItems() {
  console.log("Synchronizing spb_gudang_items approvalPpic status...");

  // 1. Update items for spbGudang with approvedByPpic = true or status in ['PENDING_DIREKSI', 'APPROVED']
  const approvedSpbs = await (prisma as any).spbGudang.findMany({
    where: {
      OR: [
        { approvedByPpic: true },
        { status: { in: ["PENDING_DIREKSI", "APPROVED"] } },
      ],
    },
    include: { items: true },
  });

  let updatedCount = 0;
  for (const spb of approvedSpbs) {
    for (const item of spb.items || []) {
      const needPpicFix = !item.approvalPpic || item.approvalPpic === "NONE";
      const needDireksiFix = spb.status === "APPROVED" && (!item.approvalDireksi || item.approvalDireksi === "NONE");

      if (needPpicFix || needDireksiFix) {
        await (prisma as any).spbGudangItem.update({
          where: { id: item.id },
          data: {
            approvalPpic: "APPROVED",
            ...(spb.status === "APPROVED" ? { approvalDireksi: "APPROVED" } : {}),
          },
        });
        updatedCount++;
      }
    }
  }

  console.log(`Successfully synchronized ${updatedCount} items in spb_gudang_items!`);
}

syncSpbGudangItems()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error syncing spb_gudang_items:", err);
    process.exit(1);
  });
