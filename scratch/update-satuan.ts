import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "structure_items" SET "satuan" = 'set' WHERE LOWER("satuan") = 'unit' OR "satuan" IS NULL OR "satuan" = ''`
  );
  console.log(`Berhasil memperbarui ${result} baris di tabel structure_items ke satuan 'set'.`);
}

main()
  .catch((err) => {
    console.error("Error updating structure satuan:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
