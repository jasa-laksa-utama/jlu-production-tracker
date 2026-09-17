import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Applying stage photo columns migration...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "progress_photos" ADD COLUMN IF NOT EXISTS "componentId" UUID;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "progress_photos" ADD COLUMN IF NOT EXISTS "componentType" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "progress_photos" ADD COLUMN IF NOT EXISTS "stage" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "progress_photos_component_stage_idx" ON "progress_photos"("componentId", "stage");
  `);

  console.log("Stage photo columns migration applied successfully!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
